import { narratorRecordingId, soundOf, type NarrationStatus, type NarratorVoice } from '../../../shared/narration';
import { NarratorRefused } from '../infrastructure/minimax';
import { AppError, ValidationError } from '../domain/errors';
import type { Clock, Narrator, SecretRepository } from './ports';
import type { RecordingService } from './recording-service';

const KEY = 'minimax';

/**
 * Texts read aloud by MiniMax with the learner's own key, a sentence at a
 * time, each kept as that voice's recording of the sentence — so Listen plays
 * it like any recorded voice, line by line, on every device.
 *
 * The key is the learner's and costs them money: it is kept on the server,
 * tried before it is kept, and never sent back to a page — only its last
 * characters, so they can tell which key it is.
 */
export class NarrationService {
  private readonly voiceCache = new Map<string, { at: number; voices: NarratorVoice[] }>();

  constructor(
    private readonly deps: { secrets: SecretRepository; narrator: Narrator | null; recordings: RecordingService; clock: Clock },
  ) {}

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

  async voices(userId: string): Promise<NarratorVoice[]> {
    return this.voicesFor(await this.keyOf(userId));
  }

  /** One sentence read aloud and kept; the voice's id in Listen. */
  async line(userId: string, voice: string, text: string): Promise<string> {
    const key = await this.keyOf(userId);
    const line = text.trim();
    if (!line) throw new ValidationError('Nothing to read.');
    const info = (await this.voicesFor(key)).find((v) => v.id === voice);
    if (!info) throw new ValidationError(`MiniMax has no voice ${voice}.`);
    const sound = soundOf(line);
    const mp3 = await this.call(() => this.narrator().read(key, sound ? `${line} ${sound}` : line, voice, 1));
    const id = narratorRecordingId(voice);
    await this.deps.recordings.keep({ id, name: `${info.name.replace(/\s*\((?:Female|Male)\)\s*/i, '')} · MiniMax`, gender: info.gender }, 'teaching', line, mp3);
    return id;
  }

  private narrator() {
    if (!this.deps.narrator) throw new AppError('unavailable', 'This server cannot reach MiniMax.');
    return this.deps.narrator;
  }

  private async keyOf(userId: string) {
    const key = await this.deps.secrets.get(userId, KEY);
    if (!key) throw new AppError('not_found', 'Add your MiniMax API key in Settings first.');
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

const genderOf = (s: string): 'female' | 'male' => (/\b(male|man|boy|gentleman|uncle|executive|lord)\b/i.test(s) && !/\b(female|woman|girl|lady)\b/i.test(s) ? 'male' : 'female');
