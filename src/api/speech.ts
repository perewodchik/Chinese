import { send } from './http';

export interface NaturalVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
}

let voices: Promise<NaturalVoice[]> | null = null;

/**
 * The natural voices the server can read with — none when it has no key for
 * a speech service, or when it cannot be reached. Asked once per page load.
 */
export function naturalVoices(): Promise<NaturalVoice[]> {
  voices ??= send<{ voices: NaturalVoice[] }>('GET', '/api/speech')
    .then((a) => a.data.voices)
    .catch(() => []);
  return voices;
}

/**
 * The MP3 of some Mandarin, read by one of those voices.
 *
 * Fetched directly rather than through `send`, which turns the HTTP cache off
 * for JSON: here the cache is the point. The server marks each clip private
 * and good for a year, so the browser keeps it and a word practised every
 * day is downloaded once.
 */
export async function speechAudio(text: string, voice: string, slow: boolean): Promise<ArrayBuffer> {
  const q = new URLSearchParams({ text, voice, ...(slow ? { slow: '1' } : {}) });
  const res = await fetch(`/api/speech/audio?${q}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`speech ${res.status}`);
  return res.arrayBuffer();
}
