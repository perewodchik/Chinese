import type { TalkLine, TalkMode, TalkOptions, TalkReply, TalkStatusResponse } from '../../shared/talk';
import { request } from './http';

/**
 * Whether the server can ask Claude by itself, and which voices it can read
 * the answers with. Naming the voice about to be used gets its model loading.
 */
export function talkStatus(voice?: string): Promise<TalkStatusResponse> {
  return request<TalkStatusResponse>('GET', `/api/talk${voice ? `?voice=${encodeURIComponent(voice)}` : ''}`);
}

/** Claude's next turn. Slow by nature — Claude is writing — so it is given two minutes. */
export function talkReply(lines: TalkLine[], options: TalkOptions): Promise<TalkReply> {
  return request<TalkReply>('POST', '/api/talk/reply', { body: { lines, options }, timeoutMs: 120_000 });
}

/** The model may have to load before the first sentence of a sitting; after that it is seconds. */
const VOICE_TIMEOUT_MS = 90_000;
/** Bumped whenever a voice changes how it sounds, to leave the old clips behind. */
const VOICE_VERSION = '3';

/**
 * One sentence in a local voice, as MP3. Fetched directly, like the speech
 * clips, so the browser's cache keeps each one for a replay.
 */
export async function talkAudio(text: string, voice: string, mode: TalkMode, signal?: AbortSignal): Promise<ArrayBuffer> {
  // The clips a browser kept from before the voices were retuned sound like
  // the old ones for a year; the version tells them apart.
  const q = new URLSearchParams({ text, voice, mode, v: VOICE_VERSION });
  // Either the caller cutting in or the clock gives up on it. Built by hand
  // rather than with AbortSignal.any, which older iPads do not have.
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), VOICE_TIMEOUT_MS);
  const cutIn = () => stop.abort();
  signal?.addEventListener('abort', cutIn, { once: true });
  try {
    const res = await fetch(`/api/talk/audio?${q}`, { credentials: 'same-origin', signal: stop.signal });
    if (!res.ok) throw new Error(`voice ${res.status}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cutIn);
  }
}
