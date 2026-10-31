import type {
  DesignNarratorResponse,
  NarrateLineResponse,
  NarrationStatus,
  NarratorChange,
  NarratorDto,
  NarratorVoice,
} from '../../shared/narration';
import { request } from './http';

export const narrationStatus = () => request<NarrationStatus>('GET', '/api/narration');
export const saveNarrationKey = (key: string) => request<NarrationStatus>('PUT', '/api/narration/key', { body: { key } });
export const forgetNarrationKey = () => request<NarrationStatus>('DELETE', '/api/narration/key');
/** MiniMax's own Mandarin voices */
export const narratorVoices = () => request<{ voices: NarratorVoice[] }>('GET', '/api/narration/voices').then((r) => r.voices);

export const listNarrators = () => request<{ narrators: NarratorDto[] }>('GET', '/api/narration/narrators').then((r) => r.narrators);
/** A narrator with a new voice made from a description: MiniMax takes several seconds. */
export const designNarrator = (name: string, prompt: string, previewText: string) =>
  request<DesignNarratorResponse>('POST', '/api/narration/narrators/design', { body: { name, prompt, previewText }, timeoutMs: 90_000 });
export const adoptNarrator = (name: string, voice: string) =>
  request<{ narrator: NarratorDto }>('POST', '/api/narration/narrators', { body: { name, voice } }).then((r) => r.narrator);
export const changeNarrator = (id: string, change: NarratorChange) =>
  request<{ narrator: NarratorDto }>('PATCH', `/api/narration/narrators/${encodeURIComponent(id)}`, { body: change }).then((r) => r.narrator);
export const removeNarrator = (id: string) => request<{ ok: true }>('DELETE', `/api/narration/narrators/${encodeURIComponent(id)}`);

/** A sentence read by the narrator as it is now, as an object URL to play; nothing is kept. */
export async function previewNarrator(id: string, text: string): Promise<string> {
  const res = await fetch(`/api/narration/narrators/${encodeURIComponent(id)}/preview`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'MiniMax did not answer.');
  }
  return URL.createObjectURL(await res.blob());
}

/** One sentence read by a narrator and kept; a sentence takes a few seconds. */
export const narrateLine = (narrator: string, text: string) =>
  request<NarrateLineResponse>('POST', '/api/narration/line', { body: { narrator, text }, timeoutMs: 60_000 });

/** The narrator Listen reads with, kept on this device. */
const CHOSEN = 'hanzi.narrator';
export function chosenNarrator(): string | null {
  try {
    return localStorage.getItem(CHOSEN);
  } catch {
    return null;
  }
}
export function chooseNarrator(id: string) {
  try {
    localStorage.setItem(CHOSEN, id);
  } catch {
    // forgotten between visits, that is all
  }
}
