import { createHash } from 'node:crypto';
import type { TalkMode, TalkVoice } from '../../../shared/talk';
import { AppError, ValidationError } from '../domain/errors';
import type { Clock, RecordingRepository, TalkSynthesizer, VoiceInfo } from './ports';

/** What a recording is filed under: the voice, the way it reads, and the sentence exactly. */
export const recordingKey = (voice: string, mode: TalkMode, text: string) =>
  createHash('sha256').update(`${voice}\n${mode}\n${text}`).digest('hex');

/**
 * Mandarin read aloud in the app's own voices, on the website as well as at
 * home.
 *
 * The voices are open models that run on the home computer and nowhere else
 * (local-voices.ts). Safari, which is where the learner reads, offers a web
 * page only the robotic voice the system ships with — never the natural ones
 * downloaded in Settings. So whatever the home computer reads for a text is
 * kept, and the website plays those recordings: a text read once at home, or
 * by `npm run voices:texts`, is a text the iPhone can hear in that voice.
 */
export class RecordingService {
  constructor(private readonly deps: { recordings: RecordingRepository; live: TalkSynthesizer | null; clock: Clock }) {}

  /**
   * The voices to offer. Where the models are on this machine, those: they
   * read anything. Elsewhere, the voices something has been recorded in,
   * marked as reading only what was recorded.
   */
  async voices(): Promise<TalkVoice[]> {
    const live = this.deps.live?.voices ?? [];
    if (live.length) return live;
    return (await this.deps.recordings.voices()).map((v) => ({ ...v, recorded: true }));
  }

  /**
   * One sentence as MP3: the recording if there is one, otherwise read now by
   * the model — and kept, when `keep` says it is a sentence of a text rather
   * than a turn of a conversation that will never be said again.
   */
  async read(text: string, voice: string, mode: TalkMode, keep: boolean): Promise<Uint8Array> {
    const key = recordingKey(voice, mode, text);
    const kept = await this.deps.recordings.find(key);
    if (kept) return kept;
    const live = this.deps.live;
    if (!live) throw new AppError('not_found', 'This sentence has not been recorded in that voice yet.');
    const info = live.voices.find((v) => v.id === voice);
    if (!info) throw new ValidationError(`There is no voice called ${voice}.`);
    let mp3: Uint8Array;
    try {
      mp3 = await live.synthesize(text, voice, mode);
    } catch {
      throw new AppError('unavailable', 'The voice did not answer. The system voice will have to do for now.');
    }
    if (keep) await this.deps.recordings.save({ key, voice: info, text, mp3, createdAt: this.deps.clock.now() });
    return mp3;
  }

  /**
   * A sentence someone recorded elsewhere — read by a voice service on its
   * own site and cut out of the whole passage — kept as this voice's reading
   * of it, in place of any reading kept before.
   */
  async keep(voice: VoiceInfo, mode: TalkMode, text: string, mp3: Uint8Array): Promise<void> {
    const line = text.trim();
    if (!line) throw new ValidationError('Which sentence is this a recording of?');
    if (!/^[a-z0-9-]{2,64}$/.test(voice.id)) throw new ValidationError('A voice is named in lower-case letters, digits and dashes.');
    if (mp3.length < 200) throw new ValidationError('The recording is empty.');
    await this.deps.recordings.replace({ key: recordingKey(voice.id, mode, line), voice, text: line, mp3, createdAt: this.deps.clock.now() });
  }

  /** For each sentence, whether it has been recorded in this voice. */
  async have(voice: string, mode: TalkMode, texts: readonly string[]): Promise<boolean[]> {
    const keys = texts.map((t) => recordingKey(voice, mode, t.trim()));
    const kept = await this.deps.recordings.have([...new Set(keys)]);
    return keys.map((k) => kept.has(k));
  }

  /**
   * Records every sentence of these passages that is not recorded in this
   * voice yet. One at a time, as the model reads about as fast as it speaks:
   * a shelf of texts is minutes. Says how far it has got after each passage.
   */
  async recordAll(
    passages: ReadonlyArray<{ title: string; lines: readonly string[] }>,
    voice: string,
    say: (line: string) => void,
  ): Promise<{ recorded: number; already: number }> {
    let recorded = 0;
    let already = 0;
    for (const p of passages) {
      const lines = [...new Set(p.lines.map((l) => l.trim()).filter(Boolean))];
      const have = await this.have(voice, 'teaching', lines);
      const missing = lines.filter((_, i) => !have[i]);
      already += lines.length - missing.length;
      for (const line of missing) {
        await this.read(line, voice, 'teaching', true);
        recorded += 1;
      }
      say(`${p.title}: ${missing.length ? `${missing.length} of ${lines.length} sentences recorded` : 'recorded already'}`);
    }
    return { recorded, already };
  }
}
