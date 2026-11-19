import { paragraphs } from './reading';
import type { GeneratedText, ShelfEntry, TextLine } from './text';

/**
 * The companion to a book: a chapter already read, lived again as scenes.
 *
 * It is built from the chapter itself, so nothing has to be written for it
 * and the book is never changed: a paragraph is a scene (with the
 * paragraph's picture), a sentence is a beat, and what is said in quotation
 * marks is a line spoken by someone — the person the sentence (or the
 * paragraph before it) last named. The companion counts for nothing: it reads
 * which chapters are read, and writes nothing back.
 */

export type CastId = 'wukong' | 'old' | 'troop' | 'bodhi' | 'emperor' | 'woodcutter' | 'disciples';

export interface CastMember {
  id: CastId;
  /** every name the book calls them by, longest first when matched */
  names: string[];
  /** who they are, in English */
  en: string;
  /** a face cut from the book's own pictures, under /companion/faces/ */
  face?: string;
}

/** The people of 西游记 as the chapters on the shelf name them (see books/xiyouji.md in the add-text skill). */
const XIYOUJI: CastMember[] = [
  { id: 'wukong', names: ['美猴王', '孙悟空', '悟空', '石猴', '猴王'], en: 'the stone monkey', face: 'wukong' },
  { id: 'old', names: ['老猴子', '老猴'], en: 'the old monkey', face: 'old' },
  { id: 'troop', names: ['猴子们', '众猴', '群猴', '小猴子'], en: 'the monkeys', face: 'monkey' },
  { id: 'bodhi', names: ['菩提祖师', '祖师', '老祖', '师父'], en: 'the master', face: 'bodhi' },
  { id: 'emperor', names: ['玉皇大帝', '玉帝'], en: 'the Jade Emperor' },
  { id: 'woodcutter', names: ['打柴人', '樵夫', '老人'], en: 'the woodcutter' },
  { id: 'disciples', names: ['师兄们', '师兄', '徒弟们', '众徒弟'], en: 'the other disciples' },
];

const BOOKS: Record<string, CastMember[]> = { 西游记: XIYOUJI };

/** The cast of a book, by its title on the shelf (either version); null when it has no companion. */
export function castOf(bookTitle: string): CastMember[] | null {
  return BOOKS[bookTitle.trim()] ?? null;
}

/** A chapter can be lived again once it has been read in the book, in either version. */
export const canRelive = (entry: Pick<ShelfEntry, 'main' | 'easier'>): boolean =>
  Boolean(entry.main.read || entry.easier?.read);

/** A stretch of one sentence: told, or said by someone. `from` and `to` index its characters. */
export interface BeatPart {
  kind: 'told' | 'said';
  from: number;
  to: number;
  /** who says it, when the book names them; with the name it used */
  who: { id: CastId; name: string } | null;
}

export interface Beat {
  /** the sentence, by its index in the text's lines */
  line: number;
  parts: BeatPart[];
}

export interface CompanionScene {
  /** the paragraph, from 0 — the picture above it is the scene's */
  para: number;
  beats: Beat[];
}

const OPEN = new Set(['“', '「', '『']);
const CLOSE = new Set(['”', '」', '』']);

/** Every mention of a cast member in a stretch of text, in order, the longest name winning where two overlap. */
function mentions(chars: string[], from: number, to: number, cast: CastMember[]): Array<{ at: number; id: CastId; name: string }> {
  const names = cast.flatMap((c) => c.names.map((n) => ({ id: c.id, n: [...n] }))).sort((a, b) => b.n.length - a.n.length);
  const out: Array<{ at: number; id: CastId; name: string }> = [];
  for (let i = from; i < to; ) {
    const hit = names.find(({ n }) => n.every((ch, k) => chars[i + k] === ch) && i + n.length <= to);
    if (hit) {
      out.push({ at: i, id: hit.id, name: hit.n.join('') });
      i += hit.n.length;
    } else i += 1;
  }
  return out;
}

/** The last person a stretch names, as a speaker. */
const lastOf = (seen: Array<{ id: CastId; name: string }>): { id: CastId; name: string } | null => {
  const last = seen[seen.length - 1];
  return last ? { id: last.id, name: last.name } : null;
};

/** The writer's `who` on a line, when it names a cast member. */
function named(who: string | undefined, cast: CastMember[]): { id: CastId; name: string } | null {
  if (!who) return null;
  const c = cast.find((m) => m.names.includes(who.trim()));
  return c ? { id: c.id, name: who.trim() } : null;
}

/**
 * One sentence cut into what is told and what is said. A quotation is said
 * by the last person named before it — in this sentence, else earlier in the
 * paragraph (`lastNamed`). The marks themselves stay with the words they
 * open and close, so the sentence reads the same put back together.
 */
export function partsOf(line: Pick<TextLine, 'zh' | 'who'>, cast: CastMember[], lastNamed: { id: CastId; name: string } | null): { parts: BeatPart[]; lastNamed: { id: CastId; name: string } | null } {
  const chars = [...line.zh];
  const parts: BeatPart[] = [];
  const writer = named(line.who, cast);
  let speaker = lastNamed;
  let i = 0;
  while (i < chars.length) {
    const open = chars.findIndex((c, k) => k >= i && OPEN.has(c));
    if (open < 0) {
      parts.push({ kind: 'told', from: i, to: chars.length, who: null });
      speaker = lastOf(mentions(chars, i, chars.length, cast)) ?? speaker;
      break;
    }
    if (open > i) {
      parts.push({ kind: 'told', from: i, to: open, who: null });
      speaker = lastOf(mentions(chars, i, open, cast)) ?? speaker;
    }
    let close = chars.findIndex((c, k) => k > open && CLOSE.has(c));
    if (close < 0) close = chars.length - 1;
    // the full stop or mark after the closing quote belongs to what was said
    let end = close + 1;
    while (end < chars.length && /[。！？!?，,]/.test(chars[end]!)) end += 1;
    parts.push({ kind: 'said', from: open, to: end, who: writer ?? speaker });
    i = end;
  }
  // A line the writer gave a speaker and no quotation marks is said whole.
  if (writer && parts.every((p) => p.kind === 'told')) return { parts: [{ kind: 'said', from: 0, to: chars.length, who: writer }], lastNamed: writer };
  return { parts: parts.filter((p) => p.to > p.from), lastNamed: speaker };
}

/** The chapter as scenes: one a paragraph, a beat a sentence. */
export function scenesOf(text: Pick<GeneratedText, 'lines' | 'genre'>, cast: CastMember[]): CompanionScene[] {
  return paragraphs(text).map((lines, para) => {
    let lastNamed: { id: CastId; name: string } | null = null;
    const beats = lines.map((line) => {
      const r = partsOf(text.lines[line]!, cast, lastNamed);
      lastNamed = r.lastNamed;
      return { line, parts: r.parts };
    });
    return { para, beats };
  });
}

/** Where a beat is in the chapter, counted across scenes from 0, and back. */
export function beatCount(scenes: CompanionScene[]): number {
  return scenes.reduce((n, s) => n + s.beats.length, 0);
}
export function beatAt(scenes: CompanionScene[], n: number): { scene: number; beat: number } | null {
  let left = n;
  for (let s = 0; s < scenes.length; s++) {
    const len = scenes[s]!.beats.length;
    if (left < len) return { scene: s, beat: left };
    left -= len;
  }
  return null;
}
