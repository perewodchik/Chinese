import type { AttemptIn, EvalKeys, EvalResult, EvalStatus, SpeechHistory, Strictness } from '../../shared/speechEval';
import { request } from './http';

export const evalStatus = () => request<EvalStatus>('GET', '/api/eval');
export const saveEvalKeys = (keys: EvalKeys) => request<EvalStatus>('PUT', '/api/eval/key', { body: keys, timeoutMs: 40_000 });
export const forgetEvalKeys = () => request<EvalStatus>('DELETE', '/api/eval/key');
export const setStrictness = (strictness: Strictness) => request<EvalStatus>('PATCH', '/api/eval/settings', { body: { strictness } });

/** The microphone's samples (16 kHz, −1…1) as the services take them: 16-bit little-endian PCM, base64. */
export function pcmBase64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A phrase as it was said, scored; `pinyin`, a numbered reading per character, settles the characters with two readings. */
export const evaluatePhrase = (text: string, samples: Float32Array, pinyin?: string[]) =>
  request<{ result: EvalResult }>('POST', '/api/eval', { body: { text, ...(pinyin ? { pinyin } : {}), audio: pcmBase64(samples) }, timeoutMs: 45_000 }).then((r) => r.result);

/** Tries to keep for every device; one already kept (by its id) is left as it is. */
export const keepAttempts = (items: AttemptIn[]) => request<{ kept: number }>('POST', '/api/eval/attempts', { body: { items }, timeoutMs: 30_000 });
/** Every device's tries, as Phrases and the drills need them. */
export const speechHistory = () => request<SpeechHistory>('GET', '/api/eval/history');
