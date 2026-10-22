import type { StrokeOutline } from '../../../shared/strokes';

/**
 * The stroke outlines of a character that is not on the syllabus — 圳 in
 * 深圳 — from the same source the built data was made from (Make Me a Hanzi,
 * as packaged by hanzi-writer-data), fetched when a page first needs one.
 *
 * The app ships outlines for the syllabus only; a text from a real book has
 * place names and rarer characters in it, and copying it out stroke by stroke
 * needs them too. The browser may not reach the CDN itself (the site's
 * content policy allows its own server only), so the server asks, and keeps
 * what it got: an outline never changes.
 */

const SOURCE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
const TIMEOUT_MS = 10_000;

/** What was found, and what was looked for and is not there (null), for as long as the process lives. */
const kept = new Map<string, StrokeOutline | null>();

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export async function lookUpOutlines(chars: readonly string[], get: Fetch = fetch): Promise<Record<string, StrokeOutline>> {
  const out: Record<string, StrokeOutline> = {};
  await Promise.all(
    chars.map(async (c) => {
      if (!kept.has(c)) {
        const found = await fetchOne(c, get);
        // A failed fetch is not kept: it may work next time.
        if (found !== 'failed') kept.set(c, found);
      }
      const found = kept.get(c);
      if (found) out[c] = found;
    }),
  );
  return out;
}

async function fetchOne(c: string, get: Fetch): Promise<StrokeOutline | null | 'failed'> {
  try {
    const r = await get(SOURCE + encodeURIComponent(c) + '.json', { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.status === 404) return null;
    if (!r.ok) return 'failed';
    const d = (await r.json()) as { strokes?: unknown; medians?: unknown };
    if (!Array.isArray(d.strokes) || !d.strokes.every((s) => typeof s === 'string')) return null;
    return { s: d.strokes as string[], m: Array.isArray(d.medians) ? (d.medians as number[][][]) : undefined };
  } catch {
    return 'failed';
  }
}

/** For tests: forget what was looked up. */
export function forgetOutlines() {
  kept.clear();
}
