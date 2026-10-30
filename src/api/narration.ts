import type { NarrateLineResponse, NarrationStatus, NarratorVoice } from '../../shared/narration';
import { request } from './http';

export const narrationStatus = () => request<NarrationStatus>('GET', '/api/narration');
export const saveNarrationKey = (key: string) => request<NarrationStatus>('PUT', '/api/narration/key', { body: { key } });
export const forgetNarrationKey = () => request<NarrationStatus>('DELETE', '/api/narration/key');
export const narratorVoices = () => request<{ voices: NarratorVoice[] }>('GET', '/api/narration/voices').then((r) => r.voices);
/** One sentence read by MiniMax and kept; a sentence takes a few seconds. */
export const narrateLine = (voice: string, text: string) =>
  request<NarrateLineResponse>('POST', '/api/narration/line', { body: { voice, text }, timeoutMs: 60_000 });
