import {
  EMOTIONS,
  narratorRecordingId,
  PITCH_RANGE,
  soundOf,
  SPEED_RANGE,
  type NarrationStatus,
  type NarratorChange,
  type NarratorDto,
  type NarratorVoice,
  type OwnTextDto,
  type TextNarrationDto,
} from '../../../shared/narration';
import { createHash } from 'node:crypto';
import { NarratorRefused } from '../infrastructure/minimax';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import type { UsageMeter } from './usage-service';
import type { Clock, Narrator, NarratorRecord, NarratorRepository, OwnText, OwnTextRepository, SecretRepository, TextNarration, TextNarrationRepository, Tokens, VoiceTuning } from './ports';

const KEY = 'minimax';
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/**
 * Texts read aloud by MiniMax with the learner's own key.
 *
 * The learner keeps narrators: a voice — made from a description, or one of
 * MiniMax's own — with a name and how it sounds (speed, pitch, emotion).
 * A text is read by a narrator a sentence at a time, each sentence kept as
 * that narrator's recording of it, so Listen plays it like any recorded voice,
 * line by line, on every device.
 *
 * The key is the learner's and costs them money: it is kept on the server,
 * tried before it is kept, and never sent back to a page — only its last
 * characters, so they can tell which key it is.
 */
export class NarrationService {
  private readonly voiceCache = new Map<string, { at: number; voices: NarratorVoice[] }>();

  constructor(
    private readonly deps: {
      secrets: SecretRepository;
      narrators: NarratorRepository;
      narrator: Narrator | null;
      narrations: TextNarrationRepository;
      ownTexts: OwnTextRepository;
      tokens: Tokens;
      clock: Clock;
      /** counts what the key is spent on; left out, nothing is counted */
      meter?: UsageMeter;
    },
  ) {}

  /* ------------------------------------------------------------ the key */

  async status(userId: string): Promise<NarrationStatus> {
    const key = await this.deps.secrets.get(userId, KEY);
    return { key: { set: Boolean(key), hint: key ? `…${key.slice(-4)}` : null } };
  }

  async setKey(userId: string, raw: string): Promise<NarrationStatus> {
    const key = raw.trim();
    if (key.length < 16 || /\s/.test(key)) throw new ValidationError('That does not look like a MiniMax API key.', { key: 'Not a key.' });
    await this.voicesFor(key, true);
    await this.deps.secrets.set(userId, KEY, key, this.deps.clock.now());
    return this.status(userId);
  }

  async deleteKey(userId: string): Promise<NarrationStatus> {
    await this.deps.secrets.delete(userId, KEY);
    return this.status(userId);
  }

  /** MiniMax's own Mandarin voices. */
  async voices(userId: string): Promise<NarratorVoice[]> {
    return this.voicesFor(await this.keyOf(userId));
  }

  /* ------------------------------------------------------- the narrators */

  async narrators(userId: string): Promise<NarratorDto[]> {
    return (await this.deps.narrators.list(userId)).map(toDto);
  }

  /**
   * Voices made from a description, several at once, to choose among — as
   * MiniMax's own site offers three. Nothing is kept: each comes back with
   * its first words read in it, and the one chosen is kept with `keepDesigned`.
   * One that fails does not lose the others; all failing says why.
   */
  async tryDesigns(userId: string, input: { prompt: string; previewText: string; count?: number }): Promise<{ voices: Array<{ voiceId: string; trial: Uint8Array }>; failed: number }> {
    const key = await this.keyOf(userId);
    const prompt = input.prompt.trim();
    const previewText = input.previewText.trim();
    if (prompt.length < 10) throw new ValidationError('Describe the voice in a sentence or two.', { prompt: 'Too short.' });
    if (!previewText) throw new ValidationError('A sentence for it to read first.', { previewText: 'A sentence.' });
    const count = Math.min(3, Math.max(1, input.count ?? 3));
    const tries = await Promise.allSettled(Array.from({ length: count }, () => this.paid(userId, previewText, () => this.narrator().design(key, prompt, previewText))));
    const voices = tries.flatMap((t) => (t.status === 'fulfilled' ? [t.value] : []));
    if (!voices.length) throw (tries[0] as PromiseRejectedResult).reason;
    return { voices, failed: count - voices.length };
  }

  /**
   * The account's voices made from descriptions that no narrator of the
   * learner's uses — tries not chosen, narrators since removed — given up, so
   * their slots are free for new ones. A voice a narrator reads with is never
   * touched.
   */
  async freeSlots(userId: string): Promise<{ freed: string[]; kept: number }> {
    const key = await this.keyOf(userId);
    const narrator = this.narrator();
    if (!narrator.designed || !narrator.forget) throw new AppError('unavailable', 'This server cannot free MiniMax voice slots.');
    const used = new Set((await this.deps.narrators.list(userId)).map((n) => n.voiceId));
    const all = await this.call(() => narrator.designed!(key));
    const freed: string[] = [];
    for (const id of all.filter((v) => !used.has(v))) {
      await this.call(() => narrator.forget!(key, id));
      freed.push(id);
    }
    return { freed, kept: all.length - freed.length };
  }

  /** The voice chosen among those tried, kept as a narrator. */
  async keepDesigned(userId: string, input: { name: string; prompt: string; previewText: string; voiceId: string }): Promise<NarratorDto> {
    const name = input.name.trim();
    if (!name) throw new ValidationError('Give the voice a name.', { name: 'A name.' });
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(input.voiceId)) throw new ValidationError('That is not one of the voices just made.');
    const now = this.deps.clock.now();
    const record: NarratorRecord = {
      id: this.deps.tokens.id(),
      userId,
      name,
      kind: 'designed',
      voiceId: input.voiceId,
      prompt: input.prompt.trim(),
      previewText: input.previewText.trim(),
      speed: 1,
      pitch: 0,
      emotion: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.narrators.save(record);
    return toDto(record);
  }

  /** A narrator with one of MiniMax's own voices. */
  async adopt(userId: string, input: { name: string; voice: string }): Promise<NarratorDto> {
    const key = await this.keyOf(userId);
    const voice = (await this.voicesFor(key)).find((v) => v.id === input.voice);
    if (!voice) throw new ValidationError(`MiniMax has no voice ${input.voice}.`);
    const now = this.deps.clock.now();
    const record: NarratorRecord = {
      id: this.deps.tokens.id(),
      userId,
      name: input.name.trim() || voice.name.replace(/\s*\((?:Female|Male)\)\s*/i, ''),
      kind: 'system',
      voiceId: voice.id,
      prompt: voice.description,
      previewText: '',
      speed: 1,
      pitch: 0,
      emotion: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.narrators.save(record);
    return toDto(record);
  }

  async change(userId: string, id: string, change: NarratorChange): Promise<NarratorDto> {
    const n = await this.find(userId, id);
    if (change.emotion !== undefined && change.emotion !== null && !(EMOTIONS as readonly string[]).includes(change.emotion)) {
      throw new ValidationError(`An emotion is one of ${EMOTIONS.join(', ')}.`);
    }
    const next: NarratorRecord = {
      ...n,
      name: change.name?.trim() || n.name,
      speed: change.speed === undefined ? n.speed : Math.round(clamp(change.speed, SPEED_RANGE) * 100) / 100,
      pitch: change.pitch === undefined ? n.pitch : Math.round(clamp(change.pitch, PITCH_RANGE)),
      emotion: change.emotion === undefined ? n.emotion : change.emotion,
      updatedAt: this.deps.clock.now(),
    };
    await this.deps.narrators.save(next);
    return toDto(next);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.deps.narrators.delete(userId, id))) throw new NotFoundError('That narrator');
  }

  /** A sentence read by the narrator as it is now; nothing kept. */
  async preview(userId: string, id: string, text: string): Promise<Uint8Array> {
    const key = await this.keyOf(userId);
    const n = await this.find(userId, id);
    const line = text.trim() || n.previewText || '你好，我们今天一起读一个小故事。';
    return this.paid(userId, line, () => this.narrator().read(key, line, n.voiceId, tuningOf(n)));
  }

  /**
   * A text read whole by a narrator, in one request, and kept: found when it
   * was read before by the narrator as it is now (its voice, speed, pitch and
   * mood), read only when asked to, and read again only when asked again.
   */
  async text(userId: string, narratorId: string, lines: string[], o: { generate?: boolean; again?: boolean; speed?: number } = {}): Promise<TextNarrationDto | null> {
    const found = await this.find(userId, narratorId);
    // A speed asked for (a line read slowly to copy) is the narrator at that speed: a reading of its own, kept under its own key.
    const n = o.speed === undefined ? found : { ...found, speed: Math.min(2, Math.max(0.5, o.speed)) };
    const said = lines.map((l) => l.trim());
    if (!said.some(Boolean)) throw new ValidationError('Nothing to read.');
    const key = narrationKey(n, said);
    const [kept] = await this.deps.narrations.have([key]);
    if (kept && !o.again) return toNarrationDto(kept);
    if (!o.generate && !o.again) return null;
    const apiKey = await this.keyOf(userId);
    const script = said
      .filter(Boolean)
      .map((l) => {
        const sound = soundOf(l);
        return sound ? `${l} ${sound}` : l;
      })
      .join(' <#0.6#> ');
    if (script.length > 9000) throw new ValidationError('The text is too long to read in one go.');
    const read = await this.paid(userId, script, () => this.narrator().readText(apiKey, script, n.voiceId, tuningOf(n)));
    // MiniMax's MP3 is a constant 64 kbit/s, so its length is its size.
    const durationMs = Math.round((read.audio.length * 8) / 64);
    const record: TextNarration = {
      key,
      userId,
      narratorId: n.id,
      mp3: read.audio,
      timings: timingsFor(said, read.segments, durationMs),
      durationMs,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.narrations.save(record);
    return toNarrationDto(record);
  }

  /**
   * A reading made elsewhere, kept as this narrator's reading of the text:
   * a text read by a cast (the narrator and each character in their own
   * voice), its clips joined off the server, played in Listen like any other.
   * The narrator is the one it is shown under; its timings are the caller's.
   */
  async importReading(userId: string, narratorId: string, lines: string[], input: { mp3: Uint8Array; durationMs: number; timings: Array<[number, number]> }): Promise<TextNarrationDto> {
    const n = await this.find(userId, narratorId);
    const said = lines.map((l) => l.trim());
    if (!said.some(Boolean)) throw new ValidationError('Nothing to read.');
    if (input.timings.length !== said.length) throw new ValidationError('A start and an end for every line.');
    const { mp3, durationMs, timings } = input;
    const isMp3 = mp3.length > 3 && ((mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33) || (mp3[0] === 0xff && (mp3[1]! & 0xe0) === 0xe0));
    if (!isMp3) throw new ValidationError('That is not an MP3.');
    let at = 0;
    for (const [a, b] of timings) {
      if (!(a >= at - 1 && b >= a && b <= durationMs + 1)) throw new ValidationError('The lines’ times must run in order within the reading.');
      at = b;
    }
    // A narrator whose readings come in made by a cast is a cast's: its texts are heard in their characters' voices first.
    if (n.kind !== 'cast') await this.deps.narrators.save({ ...n, kind: 'cast', updatedAt: this.deps.clock.now() });
    const record: TextNarration = { key: narrationKey(n, said), userId, narratorId: n.id, mp3, timings, durationMs, createdAt: this.deps.clock.now() };
    await this.deps.narrations.save(record);
    return toNarrationDto(record);
  }

  /** Every reading of this text the learner's narrators have, as each sounds now. */
  async readingsOf(userId: string, lines: string[]): Promise<TextNarrationDto[]> {
    const said = lines.map((l) => l.trim());
    const narrators = await this.deps.narrators.list(userId);
    const kept = await this.deps.narrations.have(narrators.map((n) => narrationKey(n, said)));
    return kept.filter((k) => k.userId === userId).map(toNarrationDto);
  }

  /** The audio of a kept reading, for its owner. */
  async audio(userId: string, key: string): Promise<Uint8Array> {
    const kept = /^[0-9a-f]{64}$/.test(key) ? await this.deps.narrations.find(key) : null;
    if (!kept || kept.userId !== userId) throw new NotFoundError('That reading');
    return kept.mp3;
  }

  /* ------------------------------------------------------------ own texts */

  /** The learner's own texts read aloud, newest first, each with its reading. */
  async ownTexts(userId: string): Promise<OwnTextDto[]> {
    const list = await this.deps.ownTexts.list(userId);
    const kept = new Map((await this.deps.narrations.have(list.map((t) => t.narrationKey))).map((k) => [k.key, k]));
    return list.map((t) => ownDto(t, kept.get(t.narrationKey) ?? null));
  }

  /**
   * A text the learner wrote, read now by one of their narrators and kept.
   * The reading is the same as any text's: a Read text with the same
   * sentences finds it in Listen without being read again.
   */
  async readOwn(userId: string, input: { title: string; narrator: string; lines: string[] }): Promise<OwnTextDto> {
    const lines = input.lines.map((l) => l.trim()).filter(Boolean);
    if (!lines.length) throw new ValidationError('Write something to read.', { text: 'Some Chinese.' });
    const narration = await this.text(userId, input.narrator, lines, { generate: true });
    if (!narration) throw new AppError('unavailable', 'MiniMax sent nothing back.');
    const record: OwnText = {
      id: this.deps.tokens.id(),
      userId,
      title: input.title.trim() || lines[0]!.slice(0, 20),
      lines,
      narratorId: input.narrator,
      narrationKey: narration.key,
      textId: null,
      createdAt: this.deps.clock.now(),
    };
    await this.deps.ownTexts.save(record);
    return ownDto(record, narration);
  }

  async changeOwn(userId: string, id: string, change: { title?: string; textId?: string | null }): Promise<OwnTextDto> {
    const t = await this.deps.ownTexts.find(userId, id);
    if (!t) throw new NotFoundError('That text');
    const next: OwnText = {
      ...t,
      title: change.title?.trim() || t.title,
      textId: change.textId === undefined ? t.textId : change.textId,
    };
    await this.deps.ownTexts.save(next);
    const [kept] = await this.deps.narrations.have([next.narrationKey]);
    return ownDto(next, kept ?? null);
  }

  async removeOwn(userId: string, id: string): Promise<void> {
    if (!(await this.deps.ownTexts.delete(userId, id))) throw new NotFoundError('That text');
  }

  /* ------------------------------------------------------------ helpers */

  private async find(userId: string, id: string) {
    const n = await this.deps.narrators.find(userId, id);
    if (!n) throw new NotFoundError('That narrator');
    return n;
  }

  private narrator() {
    if (!this.deps.narrator) throw new AppError('unavailable', 'This server cannot reach MiniMax.');
    return this.deps.narrator;
  }

  private async keyOf(userId: string) {
    const key = await this.deps.secrets.get(userId, KEY);
    if (!key) throw new AppError('not_found', 'Add your MiniMax API key first.');
    return key;
  }

  private async voicesFor(key: string, fresh = false): Promise<NarratorVoice[]> {
    const kept = this.voiceCache.get(key);
    if (kept && !fresh && this.deps.clock.now() - kept.at < 3_600_000) return kept.voices;
    const list = await this.call(() => this.narrator().voices(key));
    const voices = list.map((v) => ({ ...v, gender: genderOf(`${v.name} ${v.description}`) }));
    this.voiceCache.set(key, { at: this.deps.clock.now(), voices });
    return voices;
  }

  /** A call MiniMax charges for, counted once it has gone through: a character of what it was given to read is a unit. */
  private async paid<T>(userId: string, said: string, fn: () => Promise<T>): Promise<T> {
    const out = await this.call(fn);
    await this.deps.meter?.record(userId, 'minimax', [...said].length);
    return out;
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof NarratorRefused) {
        if (err.reason === 'key') throw new ValidationError(err.message, { key: 'MiniMax did not accept it.' });
        throw new AppError('unavailable', err.message);
      }
      if (err instanceof AppError) throw err;
      throw new AppError('unavailable', 'MiniMax did not answer. Try again in a minute.');
    }
  }
}

const tuningOf = (n: VoiceTuning): VoiceTuning => ({ speed: n.speed, pitch: n.pitch, emotion: n.emotion });

/** A reading's key: the narrator as it sounds now, and the sentences. A change to either is a new reading. */
const narrationKey = (n: NarratorRecord, lines: string[]) =>
  createHash('sha256').update(`${n.id}|${n.voiceId}|${n.speed}|${n.pitch}|${n.emotion ?? ''}\n${lines.join('\n')}`).digest('hex');

const toNarrationDto = (k: Omit<TextNarration, 'mp3' | 'userId'>): TextNarrationDto => ({
  key: k.key,
  narratorId: k.narratorId,
  durationMs: k.durationMs,
  timings: k.timings,
  createdAt: k.createdAt,
});

const ownDto = (t: OwnText, kept: Omit<TextNarration, 'mp3'> | TextNarrationDto | null): OwnTextDto => ({
  id: t.id,
  title: t.title,
  lines: t.lines,
  narratorId: t.narratorId,
  narration: kept ? toNarrationDto(kept) : null,
  textId: t.textId,
  createdAt: t.createdAt,
});

const counted = (s: string) => [...s].filter((c) => /[\p{Script=Han}\p{N}]/u.test(c)).length;

/**
 * Where each line is in the reading. The service's sentences, with their
 * times, are laid end to end as one run of characters; a line starts and ends
 * where its characters fall in that run, time read off within the sentence it
 * falls in. Without the service's times, the whole reading is one sentence.
 * Only characters and digits count, so punctuation and sound tags do not
 * shift anything.
 */
export function timingsFor(lines: string[], segments: Array<{ text: string; start: number; end: number }> | null, durationMs: number): Array<[number, number]> {
  const segs = segments?.length ? segments : [{ text: lines.join(''), start: 0, end: durationMs }];
  const runs: Array<{ from: number; to: number; start: number; end: number }> = [];
  let at = 0;
  for (const sg of segs) {
    const n = counted(sg.text) || 1;
    runs.push({ from: at, to: at + n, start: sg.start, end: sg.end });
    at += n;
  }
  const total = at;
  // A line starting where a sentence ends starts with the next sentence, after the pause.
  const timeAt = (c: number, edge: 'start' | 'end') => {
    const x = Math.min(Math.max(c, 0), total);
    const r = runs.find((r) => (edge === 'start' ? x < r.to : x <= r.to)) ?? runs[runs.length - 1]!;
    return Math.round(r.start + ((x - r.from) / (r.to - r.from || 1)) * (r.end - r.start));
  };
  // The lines' own characters, scaled to the run's in case the counts differ.
  const lineCounts = lines.map(counted);
  const sum = lineCounts.reduce((a, b) => a + b, 0) || 1;
  const scale = total / sum;
  let c = 0;
  return lineCounts.map((n) => {
    const from = c;
    c += n * scale;
    return [timeAt(from, 'start'), timeAt(c, 'end')];
  });
}

const toDto = (n: NarratorRecord): NarratorDto => ({
  id: n.id,
  name: n.name,
  kind: n.kind,
  voiceId: n.voiceId,
  prompt: n.prompt,
  previewText: n.previewText,
  speed: n.speed,
  pitch: n.pitch,
  emotion: (EMOTIONS as readonly string[]).includes(n.emotion ?? '') ? (n.emotion as NarratorDto['emotion']) : null,
  recordingId: narratorRecordingId(n.id),
  createdAt: n.createdAt,
});

const genderOf = (s: string): 'female' | 'male' => (/\b(male|man|boy|gentleman|uncle|executive|lord)\b/i.test(s) && !/\b(female|woman|girl|lady)\b/i.test(s) ? 'male' : 'female');
