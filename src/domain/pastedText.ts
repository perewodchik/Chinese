import type { Library } from '../data/types';
import { firstSense } from './library';
import { pinyinOf } from './ownText';
import { segment } from './segment';
import { isHanzi, type GeneratedText, type TextLine, type TextWord } from './text';

/**
 * A Chinese text pasted or scanned in, made readable at once with no AI (T2,
 * T3): cut into sentences and paragraphs, its pinyin a word at a time, its
 * words glossed from the site's own dictionary. What only a writer can give —
 * the English of each line, grammar, questions — is left empty, and the text
 * says so where it is read.
 *
 * Its mark is `model: 'paste'`: nothing else in the workspace changes shape.
 */

export const PASTED = 'paste';

/** How many characters a text holds; past this, a paste becomes chapters at its blank lines. */
export const CHAPTER_CHARS = 3000;

/** Words glossed for one text: enough to learn from, not the whole dictionary. */
const VOCAB_MAX = 60;

const hanCount = (s: string) => [...s].filter(isHanzi).length;

/**
 * The sentences, each marked where a paragraph begins: Chinese ends a
 * sentence with 。！？ (a closing quote kept with its sentence), and a new line
 * starts a new paragraph.
 */
export function linesOf(raw: string): Array<{ zh: string; p: boolean }> {
  const out: Array<{ zh: string; p: boolean }> = [];
  for (const para of raw.split(/\n+/)) {
    const parts = para.trim().match(/[^。！？!?]+(?:[。！？!?]+[”’」』"）)]*)?/g) ?? [];
    parts
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((zh, i) => out.push({ zh, p: i === 0 }));
  }
  return out;
}

/**
 * A long paste as chapters: whole paragraphs (split at blank lines) gathered
 * until the next would pass `max` characters; a paragraph longer than that on
 * its own is split between sentences.
 */
export function chaptersOf(raw: string, max = CHAPTER_CHARS): string[] {
  const text = raw.replace(/\r\n?/g, '\n').trim();
  if (hanCount(text) <= max) return text ? [text] : [];
  const pieces: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    if (hanCount(para) <= max) pieces.push(para.trim());
    else {
      let run = '';
      for (const { zh } of linesOf(para)) {
        if (run && hanCount(run) + hanCount(zh) > max) {
          pieces.push(run);
          run = '';
        }
        run += zh;
      }
      if (run) pieces.push(run);
    }
  }
  const out: string[] = [];
  let run = '';
  for (const piece of pieces.filter(Boolean)) {
    if (run && hanCount(run) + hanCount(piece) > max) {
      out.push(run);
      run = '';
    }
    run = run ? `${run}\n\n${piece}` : piece;
  }
  if (run) out.push(run);
  return out;
}

/**
 * Whether it was written in traditional characters: some of its characters
 * are the traditional form of one the library has, and are not themselves in
 * it. Said before adding, as the dictionary knows simplified ones best.
 */
export function looksTraditional(raw: string, lib: Library): boolean {
  const traditional = new Set<string>();
  for (const e of lib.characters) if (e.trad && e.trad !== e.c) for (const t of e.trad) traditional.add(t);
  const seen = new Set([...raw].filter(isHanzi));
  let hits = 0;
  for (const c of seen) if (traditional.has(c) && !lib.byChar.has(c)) hits++;
  return hits >= 3 || (seen.size > 0 && hits / seen.size >= 0.1);
}

/** What a paste comes to before it is added (T8): its size, how much of it is known, and its new words. */
export interface PasteSummary {
  chars: number;
  distinct: number;
  /** distinct characters known, of `distinct` */
  known: number;
  /** words the dictionary has with a character not known in them */
  newWords: number;
  chapters: number;
}

export function summarize(raw: string, lib: Library, isKnown: (c: string) => boolean): PasteSummary {
  const distinct = new Set([...raw].filter(isHanzi));
  return {
    chars: hanCount(raw),
    distinct: distinct.size,
    known: [...distinct].filter(isKnown).length,
    newWords: wordsOf(raw, lib, isKnown).length,
    chapters: chaptersOf(raw).length,
  };
}

/**
 * The words worth knowing in it: each the dictionary has, with a character
 * not known yet in it, in the order they come — the syllabus word's reading
 * and meaning, or a lone character's first reading and first sense.
 */
export function wordsOf(raw: string, lib: Library, isKnown: (c: string) => boolean): TextWord[] {
  const out: TextWord[] = [];
  const seen = new Set<string>();
  for (const { zh } of linesOf(raw)) {
    for (const t of segment(zh, lib)) {
      if (!t.word || seen.has(t.text) || ![...t.text].some((c) => isHanzi(c) && !isKnown(c))) continue;
      seen.add(t.text);
      const listed = lib.byWord.get(t.text);
      const char = [...t.text].length === 1 ? lib.byChar.get(t.text) : undefined;
      if (listed) out.push({ w: t.text, py: listed.py, d: listed.d, isNew: true });
      else if (char) out.push({ w: t.text, py: char.py[0] ?? '', d: firstSense(char.def), isNew: true });
    }
  }
  return out;
}

/**
 * The texts a paste becomes: one, or a chapter for each piece of a long one,
 * each with its pinyin, its new characters and its words, and no English.
 */
export function pastedTexts(
  raw: string,
  title: string,
  lib: Library,
  isKnown: (c: string) => boolean,
): Array<Omit<GeneratedText, 'id' | 'createdAt' | 'read'>> {
  const chapters = chaptersOf(raw);
  const given = title.trim();
  return chapters.map((body, i) => {
    const lines: TextLine[] = linesOf(body).map(({ zh, p }) => ({ zh, py: pinyinOf(zh, lib), en: '', ...(p ? { p: true } : {}) }));
    // Untitled, it is called by its opening words, as a letter is.
    const opening = [...(lines[0]?.zh ?? '')].filter((c) => !/[。！？!?，、,.“”"‘’「」『』]/.test(c)).slice(0, 10).join('');
    const base = given || opening || 'My text';
    const name = chapters.length > 1 ? `${base} (${i + 1})` : base;
    const han = /\p{Script=Han}/u.test(name);
    const chars = [...new Set([...body].filter(isHanzi))];
    return {
      // A Chinese name is its Chinese title; an English one its English title.
      title: name,
      titleZh: han ? name : '',
      topic: 'Pasted text',
      length: lines.length <= 6 ? 'short' : lines.length <= 12 ? 'medium' : 'long',
      level: 'edge',
      genre: 'story',
      model: PASTED,
      lines,
      vocab: wordsOf(body, lib, isKnown).slice(0, VOCAB_MAX),
      questions: [],
      grammar: [],
      note: '',
      teach: chars.filter((c) => !isKnown(c)),
      glosses: {},
      basis: chars.filter(isKnown),
    };
  });
}

/** A text added from a paste, still without the English of its lines. */
export const isPasted = (t: Pick<GeneratedText, 'model' | 'lines'>) => t.model === PASTED && !t.lines.some((l) => l.en);
