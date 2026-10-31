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
} from '../../../shared/narration';
import { NarratorRefused } from '../infrastructure/minimax';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import type { Clock, Narrator, NarratorRecord, NarratorRepository, SecretRepository, Tokens, VoiceTuning } from './ports';
import type { RecordingService } from './recording-service';

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
      recordings: RecordingService;
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

  /** One sentence of a text read by the narrator and kept; the id Listen offers it under. */
  async line(userId: string, narratorId: string, text: string): Promise<string> {
    const key = await this.keyOf(userId);
    const n = await this.find(userId, narratorId);
    const line = text.trim();
    if (!line) throw new ValidationError('Nothing to read.');
    const sound = soundOf(line);
    const mp3 = await this.call(() => this.narrator().read(key, sound ? `${line} ${sound}` : line, n.voiceId, tuningOf(n)));
    const id = narratorRecordingId(n.id);
    await this.deps.recordings.keep({ id, name: n.name, gender: 'female' }, 'teaching', line, mp3);
    return id;
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
