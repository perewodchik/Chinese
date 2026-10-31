import type {
  NarrationStatus,
  NarratorChange,
  NarratorDto,
  NarratorVoice,
  OwnTextDto,
  TextNarrationDto,
  TriedVoicesResponse,
} from '../../shared/narration';
import { request } from './http';

export const narrationStatus = () => request<NarrationStatus>('GET', '/api/narration');
export const saveNarrationKey = (key: string) => request<NarrationStatus>('PUT', '/api/narration/key', { body: { key } });
export const forgetNarrationKey = () => request<NarrationStatus>('DELETE', '/api/narration/key');
/** MiniMax's own Mandarin voices */
export const narratorVoices = () => request<{ voices: NarratorVoice[] }>('GET', '/api/narration/voices').then((r) => r.voices);

export const listNarrators = () => request<{ narrators: NarratorDto[] }>('GET', '/api/narration/narrators').then((r) => r.narrators);
/** Up to three new voices made from a description, to choose among; MiniMax takes several seconds. Nothing is kept. */
export const tryVoices = (prompt: string, previewText: string, count = 3) =>
  request<TriedVoicesResponse>('POST', '/api/narration/narrators/try', { body: { prompt, previewText, count }, timeoutMs: 90_000 });
/** The voice chosen, kept as a narrator. */
export const keepVoice = (name: string, prompt: string, previewText: string, voiceId: string) =>
  request<{ narrator: NarratorDto }>('POST', '/api/narration/narrators/keep', { body: { name, prompt, previewText, voiceId } }).then((r) => r.narrator);
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

/**
 * A narrator's reading of a whole text: the kept one, or null; made in one
 * request when `generate` (MiniMax takes up to a minute), made again when `again`.
 */
export const narrationOf = (narrator: string, lines: string[], o: { generate?: boolean; again?: boolean } = {}) =>
  request<{ narration: TextNarrationDto | null }>('POST', '/api/narration/texts', { body: { narrator, lines, ...o }, timeoutMs: 120_000 }).then((r) => r.narration);

/** Every kept reading of this text, by any of the learner's narrators as they sound now. */
export const readingsOf = (lines: string[]) =>
  request<{ narrations: TextNarrationDto[] }>('POST', '/api/narration/texts/of', { body: { lines } }).then((r) => r.narrations);

export const ownTexts = () => request<{ texts: OwnTextDto[] }>('GET', '/api/narration/own').then((r) => r.texts);
/** A text of the learner's own, read now: up to a minute, like any whole text. */
export const readOwnText = (title: string, narrator: string, lines: string[]) =>
  request<{ text: OwnTextDto }>('POST', '/api/narration/own', { body: { title, narrator, lines }, timeoutMs: 120_000 }).then((r) => r.text);
export const changeOwnText = (id: string, change: { title?: string; textId?: string | null }) =>
  request<{ text: OwnTextDto }>('PATCH', `/api/narration/own/${encodeURIComponent(id)}`, { body: change }).then((r) => r.text);
export const removeOwnText = (id: string) => request<{ ok: true }>('DELETE', `/api/narration/own/${encodeURIComponent(id)}`);

const audioUrls = new Map<string, Promise<string>>();
/** A kept reading's audio as an object URL, fetched once a page: a blob seeks in every browser, Safari too. */
export function narrationAudio(n: TextNarrationDto): Promise<string> {
  const id = `${n.key}:${n.createdAt}`;
  let p = audioUrls.get(id);
  if (!p) {
    p = fetch(`/api/narration/texts/${n.key}/audio?v=${n.createdAt}`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('The reading could not be fetched.');
        return r.blob();
      })
      .then((b) => URL.createObjectURL(b));
    p.catch(() => audioUrls.delete(id));
    audioUrls.set(id, p);
  }
  return p;
}

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
