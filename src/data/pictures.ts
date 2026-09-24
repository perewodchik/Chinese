import manifest from './pictures.json';

/**
 * Real photos for words, and the literal parts of compounds: 火 fire + 车 car
 * = 火车 train.
 *
 * The manifest (src/data/pictures.json, written by scripts/images/build.py)
 * is part of the bundle rather than fetched, so whether a word has a picture
 * is known the moment the word is — its box is laid out before the photo
 * arrives, and nothing below it moves when it does. The photos themselves are
 * in public/images/words/, one per concept, shared between every word and
 * part that means that thing.
 */

export interface Picture {
  /** where it is served from */
  src: string;
  w: number;
  h: number;
  /** the author, as the source credits them */
  by: string;
  /** licence, short: "CC BY-SA 4.0" */
  lic: string;
  /** the page it came from, for the credit link */
  page: string;
}

/** One character of a compound, read literally: 火 "fire". */
export interface WordPart {
  ch: string;
  gloss: string;
  /** a gloss in brackets is grammar rather than a thing — "(plural)" — and has no picture */
  grammar: boolean;
  picture: Picture | null;
}

export interface WordPictures {
  picture: Picture | null;
  /** present for compounds: what each character means on its own */
  parts: WordPart[] | null;
}

interface Manifest {
  pictures: Record<string, { w: number; h: number; by: string; lic: string; src: string }>;
  words: Record<string, { img?: string; parts?: string[][] }>;
}

const data = manifest as Manifest;

function picture(slug: string | undefined): Picture | null {
  if (!slug) return null;
  const p = data.pictures[slug];
  if (!p) return null;
  return { src: `/images/words/${slug}.jpg`, w: p.w, h: p.h, by: p.by, lic: p.lic, page: p.src };
}

/** The picture for a word and its parts, or null when there is neither. */
export function picturesFor(word: string): WordPictures | null {
  const e = data.words[word];
  if (!e) return null;
  const parts =
    e.parts?.map(([ch, gloss, slug]) => ({
      ch,
      gloss: gloss.replace(/^\((.*)\)$/, '$1'),
      grammar: gloss.startsWith('('),
      picture: picture(slug),
    })) ?? null;
  const out = { picture: picture(e.img), parts };
  return out.picture || out.parts ? out : null;
}

/** Whether a word has a photo of its own — for the places that only want to know. */
export const hasPicture = (word: string): boolean => Boolean(data.words[word]?.img && data.pictures[data.words[word].img!]);
