import { paragraphs } from './reading';
import type { GeneratedText, ShelfEntry, TextLine } from './text';

/**
 * The companion to a book: a chapter already read, lived again as scenes.
 *
 * It is built from the chapter itself, so nothing has to be written for it
 * and the book is never changed: a paragraph is a scene (with the
 * paragraph's picture), a sentence is a beat, and what is said in quotation
 * marks after a colon is a line spoken by someone — whoever the sentence
 * names as the one speaking, or, for 他 or no one named, the person the
 * paragraph was last about. The companion counts for nothing: it reads which
 * chapters are read, and writes nothing back.
 */

export type CastId = 'wukong' | 'old' | 'troop' | 'bodhi' | 'emperor' | 'woodcutter' | 'disciples' | 'gods' | 'taibai' | 'dragon' | 'yama' | 'ghosts' | 'messengers' | 'everyone';

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
  { id: 'troop', names: ['猴子们', '众猴', '群猴', '小猴子', '大伙儿'], en: 'the monkeys', face: 'monkey' },
  { id: 'bodhi', names: ['菩提祖师', '祖师', '老祖', '师父'], en: 'the master', face: 'bodhi' },
  { id: 'emperor', names: ['玉皇大帝', '玉帝'], en: 'the Jade Emperor' },
  { id: 'woodcutter', names: ['打柴人', '樵夫', '老人'], en: 'the woodcutter' },
  { id: 'disciples', names: ['师兄们', '师兄', '徒弟们', '众徒弟'], en: 'the other disciples' },
  { id: 'gods', names: ['两个神仙', '二神'], en: 'the two gods' },
  { id: 'taibai', names: ['太白金星', '金星'], en: 'the Great White Planet' },
  { id: 'dragon', names: ['东海龙王', '龙王'], en: 'the Dragon King' },
  { id: 'yama', names: ['十代冥王', '冥王', '阎王', '阎罗王'], en: 'the Kings of the Underworld' },
  { id: 'ghosts', names: ['众鬼卒', '鬼卒', '小鬼们', '小鬼'], en: 'the ghosts' },
  { id: 'messengers', names: ['那两人', '两个人', '两人'], en: 'the two messengers' },
  { id: 'everyone', names: ['大家'], en: 'everyone' },
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

/**
 * Who a stretch of the book's own words is about: the people it names, less
 * the ones it names as the object of something — 对石猴说, 指着孙悟空说,
 * 告诉大王 — since a sentence that names the listener names the speaker too.
 */
const OBJECT_BEFORE = new Set(['对', '向', '跟', '给', '着', '诉', '把']);
function subjects(chars: string[], from: number, to: number, cast: CastMember[]): Array<{ id: CastId; name: string }> {
  return mentions(chars, from, to, cast)
    .filter((m) => !OBJECT_BEFORE.has(chars[m.at - 1] ?? ''))
    .map((m) => ({ id: m.id, name: m.name }));
}

/** A colon that introduces speech, not an inscription: 说：, 问道：, but not 写着：, 写着三个字：. */
const SPEECH_COLON = /[：:]\s*$/;
const INSCRIPTION = /[写刻][^，。：:]{0,5}[：:]\s*$/;
/** Words that point back to someone already named: 他说, 然后……说. */
const POINTS_BACK = /[他她]|^(然后|于是|接着|又|便|就|还|这时)/;

/** The writer's `who` on a line, when it names a cast member. */
function named(who: string | undefined, cast: CastMember[]): { id: CastId; name: string } | null {
  if (!who) return null;
  const c = cast.find((m) => m.names.includes(who.trim()));
  return c ? { id: c.id, name: who.trim() } : null;
}

/**
 * One sentence cut into what is told and what is said.
 *
 * A quotation is said when a colon of speech comes before it (说：, 问道：),
 * or when it opens the sentence, the talk going on; any other quotation is a
 * name or an inscription (叫“花果山”, 写着：“水帘洞”) and stays in what is
 * told. It is said by the last person the words before it name as the one
 * acting; with none named, by the one the paragraph was about when the words
 * point back (他说, 然后……说), else by someone unnamed. The marks stay with
 * the words they open and close, so the sentence reads the same put back
 * together.
 */
export function partsOf(line: Pick<TextLine, 'zh' | 'who'>, cast: CastMember[], lastNamed: { id: CastId; name: string } | null): { parts: BeatPart[]; lastNamed: { id: CastId; name: string } | null } {
  const chars = [...line.zh];
  const parts: BeatPart[] = [];
  const writer = named(line.who, cast);
  let about = lastNamed;
  let toldFrom = 0;
  let i = 0;
  for (;;) {
    const open = chars.findIndex((c, k) => k >= i && OPEN.has(c));
    if (open < 0) break;
    let close = chars.findIndex((c, k) => k > open && CLOSE.has(c));
    if (close < 0) close = chars.length - 1;
    // the full stop or mark after the closing quote belongs to what was said
    let end = close + 1;
    while (end < chars.length && /[。！？!?，,]/.test(chars[end]!)) end += 1;
    const lead = chars.slice(toldFrom, open).join('');
    const said = open === 0 || (SPEECH_COLON.test(lead) && !INSCRIPTION.test(lead));
    if (!said) {
      i = end;
      continue;
    }
    if (open > toldFrom) parts.push({ kind: 'told', from: toldFrom, to: open, who: null });
    const named_ = subjects(chars, toldFrom, open, cast);
    const plain = lead.replace(/[^\p{Script=Han}]/gu, '');
    const speaker = writer ?? named_[named_.length - 1] ?? (plain === '' || POINTS_BACK.test(plain) ? about : null);
    parts.push({ kind: 'said', from: open, to: end, who: speaker });
    about = speaker;
    toldFrom = end;
    i = end;
  }
  if (toldFrom < chars.length) {
    parts.push({ kind: 'told', from: toldFrom, to: chars.length, who: null });
    about = subjects(chars, toldFrom, chars.length, cast)[0] ?? about;
  }
  // A line the writer gave a speaker and no quotation marks is said whole.
  if (writer && parts.every((p) => p.kind === 'told')) return { parts: [{ kind: 'said', from: 0, to: chars.length, who: writer }], lastNamed: writer };
  return { parts, lastNamed: about };
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
