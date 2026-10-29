import type { GeneratedText } from './text';

/**
 * A picture beside a paragraph of a text.
 *
 * The writer describes what each paragraph shows (`prompt`); a picture is then
 * drawn for it away from the app (`npm run texts -- illustrate`) and kept on
 * the server under the digest of its bytes (`key`). Until it has been drawn a
 * picture is only its description, and the page shows nothing for it.
 */
export interface TextPicture {
  /** the paragraph it goes above, 0 for the first (`paragraphs` in reading.ts) */
  para: number;
  /** what it shows, as it was asked of the painter */
  prompt: string;
  /** the server's name for the drawn picture: the SHA-256 of its bytes */
  key?: string;
  /** its size in pixels, so its box is laid out before it loads */
  w?: number;
  h?: number;
  /** when it was drawn */
  at?: number;
}

/** Longer than any description a painter needs; shorter than a runaway paste. */
const PROMPT_MAX = 1200;

const size = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 8192 ? v : undefined);

/**
 * The pictures out of whatever was stored or sent: one a paragraph, in order.
 * A malformed one is dropped; of two for one paragraph the drawn one is kept.
 */
export function picturesOf(raw: unknown): TextPicture[] {
  if (!Array.isArray(raw)) return [];
  const byPara = new Map<number, TextPicture>();
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const para = typeof o.para === 'number' && Number.isInteger(o.para) && o.para >= 0 && o.para < 500 ? o.para : -1;
    const prompt = typeof o.prompt === 'string' ? o.prompt.trim().slice(0, PROMPT_MAX) : '';
    if (para < 0 || !prompt) continue;
    const key = typeof o.key === 'string' && /^[0-9a-f]{64}$/.test(o.key) ? o.key : undefined;
    const w = size(o.w);
    const h = size(o.h);
    const pic: TextPicture = {
      para,
      prompt,
      ...(key && w && h ? { key, w, h } : {}),
      ...(key && typeof o.at === 'number' && Number.isFinite(o.at) ? { at: o.at } : {}),
    };
    const had = byPara.get(para);
    if (!had || better(pic, had)) byPara.set(para, pic);
  }
  return [...byPara.values()].sort((a, b) => a.para - b.para);
}

/** A drawn picture beats a description; of two drawn, the later. */
const better = (a: TextPicture, b: TextPicture) => (a.key ? !b.key || (a.at ?? 0) > (b.at ?? 0) : false);

/**
 * Two devices' pictures for one text, paragraph by paragraph: what was drawn
 * on either stays drawn, whichever copy of the text is kept otherwise.
 */
export function mergePictures(ours: TextPicture[] | undefined, theirs: TextPicture[] | undefined): TextPicture[] | undefined {
  if (!theirs?.length) return ours;
  if (!ours?.length) return theirs;
  const out = picturesOf([...ours, ...theirs]);
  return out.length ? out : undefined;
}

/** The drawn picture above paragraph `para`, if there is one. */
export const pictureAbove = (text: Pick<GeneratedText, 'pictures'>, para: number) =>
  text.pictures?.find((p) => p.para === para && p.key);
