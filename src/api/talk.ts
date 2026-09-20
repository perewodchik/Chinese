import type { TalkLevel, TalkLine, TalkReply, TalkStatusResponse } from '../../shared/talk';
import { request } from './http';

/**
 * Whether the server can ask Claude by itself, and which voices it can read
 * the answers with. Naming the voice about to be used gets its model loading.
 */
export function talkStatus(voice?: string): Promise<TalkStatusResponse> {
  return request<TalkStatusResponse>('GET', `/api/talk${voice ? `?voice=${encodeURIComponent(voice)}` : ''}`);
}

/** Claude's next turn. Slow by nature — Claude is writing — so it is given two minutes. */
export function talkReply(lines: TalkLine[], level: TalkLevel): Promise<TalkReply> {
  return request<TalkReply>('POST', '/api/talk/reply', { body: { lines, level }, timeoutMs: 120_000 });
}

/**
 * One sentence in a local voice, as MP3. Fetched directly, like the speech
 * clips, so the browser's cache keeps each one for a replay.
 */
export async function talkAudio(text: string, voice: string, slow: boolean, signal?: AbortSignal): Promise<ArrayBuffer> {
  const q = new URLSearchParams({ text, voice, ...(slow ? { slow: '1' } : {}) });
  const res = await fetch(`/api/talk/audio?${q}`, {
    credentials: 'same-origin',
    signal: signal ?? AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`voice ${res.status}`);
  return res.arrayBuffer();
}
