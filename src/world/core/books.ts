/**
 * Books (§13 B1): short graded readers about the culture the story walks
 * through — read in Chinese, checked against a faithful English page by
 * page, ending on 「今天的北京 · In Beijing today」, the bridge from the game to
 * the real city. A book is given on the main route, and the next step needs
 * something it says (兔儿爷 answers too — reading is encouraged, never forced).
 *
 * Pure: the format and its zod schema, the level check (the §5 budget's `book`
 * rules), and the save's books.
 */

import { z } from 'zod';
import type { Leveler } from './budget';
import type { Scene, WorldSave } from './types';

export interface BookPage {
  zh: string;
  /** a faithful translation, sentence by sentence — not a summary */
  en: string;
  /** a picture: a frame of the props atlas, or a woodcut (`figures/<id>`) */
  pic?: string;
}

export interface Book {
  id: string;
  /** the title, without 《》 */
  zh: string;
  en: string;
  /** 1–2: HSK 1–2 only (+ up to three glossed words); 3: HSK 3 up to a tenth, harder words glossed */
  level: 1 | 2 | 3;
  /** the cover picture (as `pic`) */
  cover: string;
  /** how it comes to you */
  source: 'gift' | 'shop' | 'found';
  /** who gives it, or where to find it, for the shelf's grey spine: "王阿姨 gives it when the lantern breaks" */
  where: string;
  pages: BookPage[];
  /** the last page: what you can still see or do in real Beijing */
  today: { zh: string; en: string };
  /** the map the book is about, if one */
  place?: string;
  /** facts.md ids the book relies on */
  facts: string[];
  /** words above the level, glossed at first use (tap shows them) */
  words?: { w: string; en: string }[];
  /** proper names that do not count against the level */
  names?: string[];
}

const text = z.string().min(1);
export const bookSchema: z.ZodType<Book> = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  zh: text,
  en: text,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  cover: text,
  source: z.enum(['gift', 'shop', 'found']),
  where: text,
  pages: z.array(z.strictObject({ zh: text, en: text, pic: text.optional() })).min(6).max(10),
  today: z.strictObject({ zh: text, en: text }),
  place: z.string().optional(),
  facts: z.array(z.string()),
  words: z.array(z.strictObject({ w: text, en: text })).optional(),
  names: z.array(text).optional(),
});

/**
 * Glossed words a level 1–2 book may use (the brief said three; the 2026 HSK
 * lists put 灯 and 马 at HSK 3 and 红 at HSK 5, so a book about lanterns needs
 * a few more — each glossed, tappable, on the shelf's word list).
 */
export const MAX_GLOSSED = 6;

/** the most Chinese characters a page holds */
export const PAGE_CHARS = 60;
const HAN = /[㐀-鿿]/g;

/**
 * What is wrong with a book: a page too long, words above its level that are
 * not glossed, too many glossed words for levels 1–2, HSK 3 over a tenth at
 * level 3, facts not in the register, a place that is no map.
 */
export function checkBook(b: Book, ctx: { leveler: Leveler; names: ReadonlySet<string>; facts: ReadonlySet<string>; maps: ReadonlySet<string> }): string[] {
  const out: string[] = [];
  const at = (s: string) => `book ${b.id}: ${s}`;
  const glossed = new Set((b.words ?? []).map((w) => w.w));
  if (b.level <= 2 && glossed.size > MAX_GLOSSED) out.push(at(`${glossed.size} glossed words — at most ${MAX_GLOSSED} at level ${b.level}`));
  const names = new Set([...ctx.names, ...(b.names ?? [])]);
  const whole = new Set([...names, ...glossed]);
  let total = 0;
  let three = 0;
  const pages = [...b.pages, b.today];
  pages.forEach((p, i) => {
    const n = (p.zh.match(HAN) ?? []).length;
    if (n > PAGE_CHARS) out.push(at(`page ${i + 1} has ${n} characters — at most ${PAGE_CHARS}`));
    for (const w of ctx.leveler(p.zh, whole)) {
      if (names.has(w.w) || glossed.has(w.w)) continue;
      total++;
      const hi = w.level >= 3 || w.level === 0;
      if (b.level <= 2 && hi) out.push(at(`page ${i + 1}: ${w.w} [HSK ${w.level || '?'}] is above the book's level — use an easier word or gloss it`));
      if (b.level === 3) {
        if (w.level === 3) three++;
        else if (w.level > 3 || w.level === 0) out.push(at(`page ${i + 1}: ${w.w} [HSK ${w.level || '?'}] is above HSK 3 — gloss it`));
      }
    }
  });
  if (b.level === 3 && total && three / total > 0.1) out.push(at(`HSK 3 is ${Math.round((three / total) * 100)} % of the words — at most 10 %`));
  for (const f of b.facts) if (!ctx.facts.has(f)) out.push(at(`fact "${f}" is not in docs/world-game/facts.md`));
  if (b.place && !ctx.maps.has(b.place)) out.push(at(`place "${b.place}" is not a map`));
  for (const w of glossed) if (!pages.some((p) => p.zh.includes(w))) out.push(at(`glossed word ${w} is on no page`));
  return out;
}

// --- the save --------------------------------------------------------------------------

export interface BookState {
  /** the game minute it came to you */
  got: number;
  /** pages read (0-based; the "today" page is `pages.length`) */
  read: number[];
}

/** A book's pages including "today". */
export const pageCount = (b: Pick<Book, 'pages'>) => b.pages.length + 1;

/** Whether every page of a book has been read. */
export const finished = (s: WorldSave, b: Pick<Book, 'id' | 'pages'>) => (s.books?.[b.id]?.read.length ?? 0) >= pageCount(b);

/** The books you have, in the order they came. */
export const shelf = (s: WorldSave, all: readonly Book[]) =>
  all.filter((b) => s.books?.[b.id]).sort((a, b) => s.books![a.id]!.got - s.books![b.id]!.got);

/** Remember the English toggle per device (the reader's choice), never in the save. */
export const ENGLISH_KEY = 'zouzou:book-english';

/** The page to open a book on: the first one not read yet, else the first. */
export const openAt = (s: WorldSave, b: Pick<Book, 'id' | 'pages'>) => {
  const read = new Set(s.books?.[b.id]?.read ?? []);
  for (let i = 0; i < pageCount(b); i++) if (!read.has(i)) return i;
  return 0;
};

/** One spine on the shelf: a book you have (with how far you are), or a grey one that says where to get it. */
export interface ShelfRow {
  book: Book;
  have: boolean;
  read: number;
  pages: number;
  done: boolean;
}

/** Every book, yours first in the order they came, then the rest in the story's order (the file order). */
export function shelfRows(s: WorldSave, all: readonly Book[]): ShelfRow[] {
  const row = (b: Book): ShelfRow => {
    const read = s.books?.[b.id]?.read.length ?? 0;
    return { book: b, have: !!s.books?.[b.id], read, pages: pageCount(b), done: read >= pageCount(b) };
  };
  return [...shelf(s, all).map(row), ...all.filter((b) => !s.books?.[b.id]).map(row)];
}

/**
 * The glossed words that appear for the first time on each page (the reader
 * shows them under the page: "灯笼 lantern"). A word inside a longer glossed
 * word on the same page (灯 in 灯笼) is not shown again.
 */
export function glossesByPage(b: Book): { w: string; en: string }[][] {
  const seen = new Set<string>();
  const words = [...(b.words ?? [])].sort((x, y) => y.w.length - x.w.length);
  return [...b.pages, b.today].map((p) => {
    let rest = p.zh;
    const out: { w: string; en: string }[] = [];
    for (const w of words) {
      if (!rest.includes(w.w)) continue;
      rest = rest.split(w.w).join('　');
      if (seen.has(w.w)) continue;
      seen.add(w.w);
      out.push(w);
    }
    return out;
  });
}

/** The heading of the last page; a book whose "today" text starts with it does not repeat it. */
export const TODAY_HEAD = { zh: '今天的北京', en: 'In Beijing today' };
export const todayText = (zh: string) => zh.replace(/^今天的北京[：:]\s*/, '');

/**
 * Books a scene you have already seen gives, that you don't have: a chapter
 * deepened later (S1–S10) puts a book into a scene an older save has played
 * past, and the book should still be on its shelf. The page gives them on load.
 */
export function owedBooks(s: WorldSave, scenes: readonly Scene[], all: readonly Pick<Book, 'id'>[]): string[] {
  const seen = new Set(s.scenes);
  const exists = new Set(all.map((b) => b.id));
  const out = new Set<string>();
  for (const sc of scenes) {
    if (!seen.has(sc.id)) continue;
    for (const n of sc.nodes) for (const a of n.onEnter ?? []) if (a.do === 'book' && exists.has(a.id) && !s.books?.[a.id]) out.add(a.id);
  }
  return [...out];
}
