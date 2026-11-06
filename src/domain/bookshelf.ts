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
  /** a story's picture, its colours from its world */
  scene: ScenePalette;
  /** the cover's colour and its spine's, a darker shade: a story's is its title band's */
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
 * What a book's cover shows: where its first chapter happens, as a picture
 * book's cover shows the world it opens in (皮卡丘饿了 opens in a forest of
 * apples); when the first chapter names nothing on the list, the book's own
 * title (天官赐福: lanterns), then whatever its chapters name most; a story
 * about nothing on the list gets a night sky.
 */
export function coverArt(name: string, texts: GeneratedText[]): CoverArt {
  const motif = (s: string) => ART.find(([, re]) => re.test(s))?.[0];
  const first = texts.find((t) => !isFrontMatter(t));
  const opening = first && motif(`${first.titleZh} ${first.title} ${first.topic}`);
  if (opening) return opening;
  const titled = motif(name);
  if (titled) return titled;
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

/** A story's picture: its sky, the far and near ground, the thing it is about, and the band its title sits on. */
export interface ScenePalette {
  sky: string;
  far: string;
  near: string;
  accent: string;
  band: string;
}

// Each world in two or three lights, so two forest stories need not look alike.
const SCENES: Record<CoverArt, ScenePalette[]> = {
  tree: [
    { sky: '#d9ecef', far: '#9cc79a', near: '#5e9b5f', accent: '#d9544a', band: '#2f6b3f' },
    { sky: '#f6e7c4', far: '#b9cf8a', near: '#6f9a4d', accent: '#d9544a', band: '#55703a' },
  ],
  mountain: [
    { sky: '#f4dcc2', far: '#d9a77c', near: '#a8553c', accent: '#fafbf8', band: '#7c2f22' },
    { sky: '#dfe7ef', far: '#9db0c4', near: '#5c7593', accent: '#fafbf8', band: '#3b4f6b' },
    { sky: '#f2e6c9', far: '#c9b27a', near: '#8a6a32', accent: '#fafbf8', band: '#5e4520' },
  ],
  lantern: [
    { sky: '#2b2450', far: '#463a74', near: '#1f1a3a', accent: '#e0473a', band: '#1b1633' },
    { sky: '#3a1f34', far: '#5b2c4a', near: '#2a1626', accent: '#e8b84a', band: '#24121f' },
  ],
  water: [
    { sky: '#e3f0f2', far: '#7fb6c6', near: '#3f7f9a', accent: '#ef8a3a', band: '#245a72' },
    { sky: '#f3e3cf', far: '#8fb3b0', near: '#4f8582', accent: '#e05a3a', band: '#2f5f5c' },
  ],
  city: [
    { sky: '#f6d4b0', far: '#b98a8a', near: '#5d5470', accent: '#f4c35a', band: '#3d3651' },
    { sky: '#cfdcea', far: '#8d9db5', near: '#4a566e', accent: '#f4c35a', band: '#2f3850' },
  ],
  snow: [
    { sky: '#dde9f3', far: '#ffffff', near: '#b9cfe0', accent: '#3f6e5a', band: '#35587a' },
    { sky: '#e9e3f2', far: '#ffffff', near: '#c9c0dc', accent: '#4f6e8a', band: '#4b4170' },
  ],
  food: [
    { sky: '#f7e2c4', far: '#efc28f', near: '#c9783e', accent: '#fafbf8', band: '#8a4422' },
    { sky: '#f3ead8', far: '#e5c89a', near: '#a8763c', accent: '#fafbf8', band: '#6b4a24' },
  ],
  night: [
    { sky: '#23345a', far: '#33497a', near: '#182440', accent: '#f2cf6a', band: '#141e36' },
    { sky: '#2f2a4f', far: '#463f73', near: '#1e1a35', accent: '#f2cf6a', band: '#191530' },
  ],
};

const hashOf = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h;
};

/** The light a story's picture is drawn in: chosen by its title, so both editions match and it never changes. */
export const scenePalette = (art: CoverArt, title: string): ScenePalette => {
  const list = SCENES[art];
  return list[hashOf(title) % list.length]!;
};

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
  return COLORS[hashOf(title) % COLORS.length]!;
}

/** Where a book goes until it is put somewhere: stories together, a real book's pages, then your own texts. */
export function defaultShelf(kind: Book['kind'], texts: GeneratedText[]): string {
  if (kind === 'story') return SHELF_STORIES;
  return texts.some((t) => fromBook(t)) ? SHELF_FROM_BOOKS : SHELF_MINE;
}

export function bookOf(set: TextSet, texts: GeneratedText[]): Book {
  const kind = kindOf(texts);
  const title = bookTitle(set.name) || set.name;
  const art = coverArt(title, texts);
  const scene = scenePalette(art, title);
  return {
    set,
    title,
    kind,
    easier: isEasier(set, texts),
    art,
    scene,
    color: kind === 'story' ? { bg: scene.band, spine: scene.near } : coverColor(title),
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

/** 一 to 十, then 十一 to 九十九, as a Chinese book numbers its chapters; past that, the digits. */
export function chineseNumber(n: number): string {
  const d = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n < 1 || n > 99) return String(n);
  if (n < 10) return d[n]!;
  const tens = Math.floor(n / 10);
  return `${tens > 1 ? d[tens] : ''}十${d[n % 10]}`;
}

const ZH_CHAPTER = /^(第.{1,4}[章话回节])[\s：:]*/;
const EN_CHAPTER = /^chapter\s+\w+\s*[:.\-–—]\s*/i;

/**
 * A chapter's head as a book prints it: 第三章 over its name, and the name in
 * English under it. The number is the one in its Chinese title when it has
 * one, else its place among the chapters (`n`, null for a text that is not a
 * chapter), and neither title repeats it.
 */
export function chapterHead(t: GeneratedText, n: number | null): { kicker: string | null; zh: string; en: string } {
  const zh = t.titleZh.trim() || t.title;
  const en = plainTitle(t.title).replace(EN_CHAPTER, '').trim();
  const m = zh.match(ZH_CHAPTER);
  if (m && zh.length > m[0].length) return { kicker: m[1]!, zh: zh.slice(m[0].length), en };
  // A title that is only its number (第一章) is the head on its own: no second 第一章 over it.
  if (m || n === null) return { kicker: null, zh, en: plainTitle(t.title) };
  return { kicker: `第${chineseNumber(n)}章`, zh, en };
}
