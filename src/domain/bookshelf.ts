import { fromBook, isRetelling, plainTitle, type GeneratedText, type TextSet } from './text';

/**
 * Read as a bookcase: shelves, books on them, chapters in the books.
 *
 * A book is what the app has always called a set: a story in chapters, a book
 * from a real shelf, or a batch of texts Claude wrote. A shelf is a name the
 * book carries (`TextSet.shelf`), set from the book's menu; until it is set,
 * the book goes where its kind puts it. Everything here is worked out from the
 * books themselves, so nothing new has to be stored for a cover.
 */

export type CoverArt = 'tree' | 'mountain' | 'lantern' | 'water' | 'city' | 'snow' | 'food' | 'night';

export interface Book {
  set: TextSet;
  /** its title on the cover: the set's name without "(easier)" or "(original)" */
  title: string;
  /** a story gets a drawn cover; anything else is an exercise book with a label */
  kind: 'story' | 'plain';
  /** an easier retelling: a sticker on its cover says so */
  easier: boolean;
  art: CoverArt;
  /** the cover's colour and its spine's, a darker shade */
  color: { bg: string; spine: string };
  shelf: string;
}

export const SHELF_STORIES = 'Stories';
export const SHELF_FROM_BOOKS = 'From books';
export const SHELF_MINE = 'My texts';

/** "西游记 (easier)" → 西游记: the edition is the sticker's to say. */
export const bookTitle = (name: string) => name.replace(/\s*\((easier|original)\)\s*$/i, '').trim();

/** The page before a story's chapters (who is who, the key words): not a chapter, not counted as one. */
export const isFrontMatter = (t: GeneratedText) => /^before you read/i.test(t.title) || t.titleZh.trim() === '人物和词语';
const isChapter = (t: GeneratedText) => /^第.{1,4}[章话回节]/.test(t.titleZh.trim()) || /^chapter\b/i.test(t.title);

/**
 * A story, drawn on its cover, when most of its texts are stories and it reads
 * as a book: chapters, a page of who is who before them, or pictures. A few
 * short stories written for practice stay an exercise book.
 */
export function kindOf(texts: GeneratedText[]): Book['kind'] {
  if (!texts.length) return 'plain';
  const stories = texts.filter((t) => t.genre === 'story').length;
  if (stories * 2 < texts.length) return 'plain';
  const bookLike = texts.some((t) => isChapter(t) || isFrontMatter(t) || (t.pictures?.length ?? 0) > 0);
  return bookLike ? 'story' : 'plain';
}

/** An easier edition: named so, or every text in it a retelling. */
export const isEasier = (set: TextSet, texts: GeneratedText[]) =>
  /\(easier\)\s*$/i.test(set.name) || (texts.length > 0 && texts.filter((t) => !isFrontMatter(t)).every(isRetelling));

// What a cover can show, and the words, Chinese or English, that call for it.
const ART: Array<[CoverArt, RegExp]> = [
  ['lantern', /灯|神|仙|鬼|天官|庙|lantern|heaven|god|ghost|spirit|temple/i],
  ['mountain', /山|西游|猴|路|mountain|monkey|journey|road|climb/i],
  ['water', /河|海|鱼|船|湖|水|river|sea|fish|boat|lake|swim/i],
  ['snow', /雪|冬|冰|snow|winter|ice|ski/i],
  ['city', /城|车|机场|楼|街|city|taxi|airport|train|street|shop/i],
  ['food', /饭|面包|吃|菜|饿|茶|food|bread|eat|cook|hungry|tea/i],
  ['tree', /森林|树|苹果|花|果|forest|tree|apple|flower|garden/i],
];

/**
 * What a book's cover shows, from the words in its title, its chapters' titles
 * and topics: the title's own motif when it names one, else the one its
 * chapters name most; a story about nothing on the list gets a night sky.
 */
export function coverArt(name: string, texts: GeneratedText[]): CoverArt {
  // The book's own title decides when it names a motif: 皮卡丘饿了 is about being hungry, wherever its chapters go.
  const fromTitle = ART.find(([, re]) => re.test(name));
  if (fromTitle) return fromTitle[0];
  const words = texts.flatMap((t) => [t.titleZh, t.title, t.topic]).join(' ');
  let best: CoverArt = 'night';
  let most = 0;
  for (const [art, re] of ART) {
    const n = words.match(new RegExp(re.source, 'gi'))?.length ?? 0;
    if (n > most) {
      most = n;
      best = art;
    }
  }
  return best;
}

// Muted cloth colours, each with a darker spine; light text sits on all of them.
const COLORS: Array<{ bg: string; spine: string }> = [
  { bg: '#2f6f57', spine: '#24584a' },
  { bg: '#2b4a7a', spine: '#223c63' },
  { bg: '#9a4a3a', spine: '#7d3a2d' },
  { bg: '#a67c2e', spine: '#8a6626' },
  { bg: '#4b3f63', spine: '#3b3150' },
  { bg: '#5d6b78', spine: '#4b5763' },
  { bg: '#6b5a3e', spine: '#574830' },
  { bg: '#3d6470', spine: '#30515b' },
];

/** The same title, the same colour, on every device and every visit; both editions of a book alike. */
export function coverColor(title: string): { bg: string; spine: string } {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return COLORS[h % COLORS.length]!;
}

/** Where a book goes until it is put somewhere: stories together, a real book's pages, then your own texts. */
export function defaultShelf(kind: Book['kind'], texts: GeneratedText[]): string {
  if (kind === 'story') return SHELF_STORIES;
  return texts.some((t) => fromBook(t)) ? SHELF_FROM_BOOKS : SHELF_MINE;
}

export function bookOf(set: TextSet, texts: GeneratedText[]): Book {
  const kind = kindOf(texts);
  const title = bookTitle(set.name) || set.name;
  return {
    set,
    title,
    kind,
    easier: isEasier(set, texts),
    art: coverArt(title, texts),
    color: coverColor(title),
    shelf: set.shelf?.trim() || defaultShelf(kind, texts),
  };
}

/**
 * The bookcase: each shelf with its books. Stories first, then the shelves
 * in the order their newest book was made; in a shelf, both editions of a
 * book side by side, the original first.
 */
export function bookcase(sets: TextSet[], bySet: Map<string, GeneratedText[]>): Array<{ name: string; books: Book[] }> {
  const shelves = new Map<string, Book[]>();
  for (const set of sets) {
    const b = bookOf(set, bySet.get(set.id) ?? []);
    const list = shelves.get(b.shelf);
    if (list) list.push(b);
    else shelves.set(b.shelf, [b]);
  }
  const newest = (books: Book[]) => Math.max(...books.map((b) => b.set.createdAt));
  return [...shelves.entries()]
    .map(([name, books]) => {
      // By title, newest first; within a title the original, then the easier edition.
      const byTitle = new Map<string, Book[]>();
      for (const b of books) byTitle.set(b.title, [...(byTitle.get(b.title) ?? []), b]);
      const ordered = [...byTitle.values()]
        .sort((x, y) => newest(y) - newest(x))
        .flatMap((eds) => [...eds].sort((a, b) => Number(a.easier) - Number(b.easier) || b.set.createdAt - a.set.createdAt));
      return { name, books: ordered };
    })
    .sort((a, b) => (a.name === SHELF_STORIES ? -1 : b.name === SHELF_STORIES ? 1 : newest(b.books) - newest(a.books)));
}

/** The plain title of a chapter, without the "(easier)" its retelling's English title carries. */
export const chapterTitle = (t: GeneratedText) => plainTitle(t.title);
