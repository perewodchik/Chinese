import type { StrokesResponse } from '../../shared/strokes';
import { request } from './http';

/** Outlines for characters off the syllabus, looked up by the server. */
export function lookUpStrokes(chars: readonly string[]): Promise<StrokesResponse> {
  return request<StrokesResponse>('GET', `/api/strokes?c=${encodeURIComponent(chars.join(''))}`, { timeoutMs: 20_000 });
}
