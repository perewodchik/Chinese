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
  type TextNarrationDto,
} from '../../../shared/narration';
import { createHash } from 'node:crypto';
import { NarratorRefused } from '../infrastructure/minimax';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import type { Clock, Narrator, NarratorRecord, NarratorRepository, SecretRepository, TextNarration, TextNarrationRepository, Tokens, VoiceTuning } from './ports';

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
      tokens: Tokens;
      clock: Clock;
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

  /** A narrator with a new voice made from a description, and the preview sentence read in it. */
  async design(userId: string, input: { name: string; prompt: string; previewText: string }): Promise<{ narrator: NarratorDto; trial: Uint8Array }> {
    const key = await this.keyOf(userId);
    const name = input.name.trim();
    const prompt = input.prompt.trim();
    const previewText = input.previewText.trim();
    if (!name) throw new ValidationError('Give the voice a name.', { name: 'A name.' });
    if (prompt.length < 10) throw new ValidationError('Describe the voice in a sentence or two.', { prompt: 'Too short.' });
    if (!previewText) throw new ValidationError('A sentence for it to read first.', { previewText: 'A sentence.' });
    const made = await this.call(() => this.narrator().design(key, prompt, previewText));
    const now = this.deps.clock.now();
    const record: NarratorRecord = {
      id: this.deps.tokens.id(),
      userId,
      name,
      kind: 'designed',
      voiceId: made.voiceId,
      prompt,
      previewText,
      speed: 1,
      pitch: 0,
      emotion: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.narrators.save(record);
    return { narrator: toDto(record), trial: made.trial };
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
    return this.call(() => this.narrator().read(key, line, n.voiceId, tuningOf(n)));
  }

  /**
   * A text read whole by a narrator, in one request, and kept: found when it
   * was read before by the narrator as it is now (its voice, speed, pitch and
   * mood), read only when asked to, and read again only when asked again.
   */
  async text(userId: string, narratorId: string, lines: string[], o: { generate?: boolean; again?: boolean } = {}): Promise<TextNarrationDto | null> {
    const n = await this.find(userId, narratorId);
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
    const read = await this.call(() => this.narrator().readText(apiKey, script, n.voiceId, tuningOf(n)));
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

const toNarrationDto = (k: Omit<TextNarration, 'mp3'>): TextNarrationDto => ({
  key: k.key,
  narratorId: k.narratorId,
  durationMs: k.durationMs,
  timings: k.timings,
  createdAt: k.createdAt,
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
