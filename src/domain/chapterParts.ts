import { paragraphs } from './reading';
import { isHanzi, type GeneratedText, type SentenceMark, type TextLine, type TextStudy } from './text';

/**
 * Long chapters split into readable sittings along paragraph boundaries.
 *
 * A chapter longer than `MAX_PART_HANZI` characters stays whole in the store
 * and on the book's page, and also opens in balanced parts (e.g. 3.1, 3.2)
 * derived directly from it. Nothing is duplicated on the shelf or in the
 * database: pictures, vocabulary, grammar notes, highlights and reading
 * progress all come from — and write back to — the main chapter.
 */

export const MAX_PART_HANZI = 450;

export interface ChapterPartSpec {
  /** 1-based part number within the chapter (1, 2, 3 …) */
  index: number;
  /** total number of parts this chapter splits into */
  total: number;
  /** 0-based paragraph indices (inclusive) in `paragraphs(text)` */
  paraFrom: number;
  paraTo: number;
  /** 0-based line indices (inclusive) in `text.lines` */
  lineFrom: number;
  lineTo: number;
  /** number of hanzi characters in this part */
  hanzi: number;
  /** opening Chinese line of this part, for the chapter tree */
  preview: string;
}

export const lineHanziCount = (line: Pick<TextLine, 'zh'>): number => {
  let n = 0;
  for (const ch of line.zh) if (isHanzi(ch)) n += 1;
  return n;
};

/**
 * Partitions a chapter's paragraphs into balanced parts of at most `maxHanzi`
 * hanzi each (except when a single paragraph itself exceeds `maxHanzi`, in
 * which case that paragraph stays intact on its own).
 *
 * Returns an empty list when the whole chapter fits within `maxHanzi` or has
 * only one paragraph — no sub-parts are needed.
 */
export function splitChapter(
  text: Pick<GeneratedText, 'lines' | 'genre'>,
  maxHanzi = MAX_PART_HANZI,
): ChapterPartSpec[] {
  const paras = paragraphs(text);
  const count = paras.length;
  if (count <= 1) return [];

  const paraLens = paras.map((p) => p.reduce((n, i) => n + lineHanziCount(text.lines[i]!), 0));
  const totalHanzi = paraLens.reduce((a, b) => a + b, 0);
  if (totalHanzi <= maxHanzi) return [];

  // Greedy packing yields the exact minimum number of contiguous parts `k`.
  let k = 1;
  let cur = 0;
  for (const len of paraLens) {
    if (cur > 0 && cur + len > maxHanzi) {
      k += 1;
      cur = len;
    } else {
      cur += len;
    }
  }
  if (k <= 1) return [];

  const pref = new Array<number>(count + 1).fill(0);
  for (let i = 0; i < count; i++) pref[i + 1] = pref[i]! + paraLens[i]!;

  // Among all valid `k`-part partitions, choose the most balanced one so a
  // 500-character chapter splits ~250 / 250 rather than 440 / 60.
  const target = totalHanzi / k;
  const dp: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(count + 1).fill(Infinity));
  const prev: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(count + 1).fill(-1));
  dp[0]![0] = 0;

  for (let g = 1; g <= k; g++) {
    for (let i = g; i <= count - (k - g); i++) {
      for (let j = g - 1; j < i; j++) {
        const base = dp[g - 1]![j]!;
        if (!Number.isFinite(base)) continue;
        const len = pref[i]! - pref[j]!;
        if (i - j > 1 && len > maxHanzi) continue;
        const diff = len - target;
        const cost = base + diff * diff;
        if (cost < dp[g]![i]!) {
          dp[g]![i] = cost;
          prev[g]![i] = j;
        }
      }
    }
  }

  const ranges: Array<[number, number]> = [];
  let at = count;
  for (let g = k; g >= 1; g--) {
    const from = prev[g]![at]!;
    ranges.push([from, at - 1]);
    at = from;
  }
  ranges.reverse();

  return ranges.map(([paraFrom, paraTo], idx) => {
    const lineFrom = paras[paraFrom]![0]!;
    const lastPara = paras[paraTo]!;
    const lineTo = lastPara[lastPara.length - 1]!;
    return {
      index: idx + 1,
      total: ranges.length,
      paraFrom,
      paraTo,
      lineFrom,
      lineTo,
      hanzi: pref[paraTo + 1]! - pref[paraFrom]!,
      preview: text.lines[lineFrom]?.zh.trim() ?? '',
    };
  });
}

/** All 0-based paragraph indices covered by a part. */
export function partParas(part: Pick<ChapterPartSpec, 'paraFrom' | 'paraTo'>): number[] {
  const out: number[] = [];
  for (let p = part.paraFrom; p <= part.paraTo; p++) out.push(p);
  return out;
}

/** Whether a part has been read: either the whole chapter is read, or all its paragraphs are recorded in `study.parasRead`. */
export function isPartRead(
  text: Pick<GeneratedText, 'read' | 'study'>,
  part: Pick<ChapterPartSpec, 'paraFrom' | 'paraTo'>,
): boolean {
  if (text.read) return true;
  const done = new Set(text.study?.parasRead ?? []);
  for (let p = part.paraFrom; p <= part.paraTo; p++) if (!done.has(p)) return false;
  return true;
}

/** Whether every part of the chapter will be read once `justReadParas` are included. */
export function allPartsRead(
  text: Pick<GeneratedText, 'read' | 'study'>,
  parts: readonly ChapterPartSpec[],
  justReadParas: readonly number[] = [],
): boolean {
  if (text.read) return true;
  if (!parts.length) return false;
  const done = new Set([...(text.study?.parasRead ?? []), ...justReadParas]);
  return parts.every((part) => {
    for (let p = part.paraFrom; p <= part.paraTo; p++) if (!done.has(p)) return false;
    return true;
  });
}

/** Key used for local scroll progress of a chapter part, separate from the full chapter's own scroll key. */
export const partProgressKey = (textId: string, partIndex: number) => `${textId}#p${partIndex}`;

export interface ChapterRollup {
  partsTotal: number;
  partsRead: number;
  totalHanzi: number;
  readHanzi: number;
  /** cumulative reading progress 0..100 across all parts (and the full chapter) */
  pct: number;
  /** whether any part or the chapter itself has been read or scrolled */
  started: boolean;
  /** first unread part (1-based), or 1 when all parts are read */
  nextUnreadPart: number;
}

/** Cumulative summary ("rollup") of a split chapter from its parts and main chapter state. */
export function chapterRollup(
  text: Pick<GeneratedText, 'id' | 'read' | 'lastReadAt' | 'study'>,
  parts: readonly ChapterPartSpec[],
  getShare: (key: string) => number | null,
): ChapterRollup {
  const totalHanzi = parts.reduce((n, p) => n + p.hanzi, 0);
  let partsRead = 0;
  let readHanzi = 0;
  let weighted = 0;
  let nextUnreadPart: number | null = null;
  let anyPartShare = false;

  for (const p of parts) {
    const done = isPartRead(text, p);
    if (done) {
      partsRead += 1;
      readHanzi += p.hanzi;
      weighted += p.hanzi * 100;
    } else {
      if (nextUnreadPart === null) nextUnreadPart = p.index;
      const sh = getShare(partProgressKey(text.id, p.index));
      if (sh !== null && sh > 0) anyPartShare = true;
      weighted += p.hanzi * (sh ?? 0);
    }
  }

  const allDone = text.read || (parts.length > 0 && partsRead === parts.length);
  const fullShare = getShare(text.id);
  const partsPct = totalHanzi > 0 ? Math.round(weighted / totalHanzi) : 0;
  const pct = allDone ? 100 : Math.min(100, Math.max(partsPct, fullShare ?? 0));
  const started = allDone || partsRead > 0 || anyPartShare || (fullShare !== null && fullShare > 0) || Boolean(text.lastReadAt);

  return {
    partsTotal: parts.length,
    partsRead: allDone ? parts.length : partsRead,
    totalHanzi,
    readHanzi: allDone ? totalHanzi : readHanzi,
    pct,
    started,
    nextUnreadPart: nextUnreadPart ?? 1,
  };
}

const bareHan = (s: string) => s.replace(/[^\p{Script=Han}]/gu, '');

/**
 * Derives a standalone `GeneratedText` view for one part of a main chapter:
 * its lines, paragraph-reindexed pictures and scenes, in-part vocabulary,
 * grammar notes, highlights and read state — all sourced from `text`.
 */
export function sliceChapterPart(text: GeneratedText, part: ChapterPartSpec): GeneratedText {
  const rawLines = text.lines.slice(part.lineFrom, part.lineTo + 1);
  // The first line of the slice opens paragraph 0 of the part; strip `p` only on index 0
  // so `paragraphs()` uses the remaining `p` marks cleanly without altering paragraph boundaries.
  const lines = rawLines.map((l, i) => {
    if (i === 0 && l.p) {
      const { p: _p, ...rest } = l;
      return rest;
    }
    return l;
  });

  const joined = lines.map((l) => l.zh).join('\n');
  const bareLines = lines.map((l) => bareHan(l.zh));
  const vocab = text.vocab.filter((w) => joined.includes(w.w));
  const teach = text.teach.filter((c) => joined.includes(c));
  const grammar = text.grammar.filter((g) => {
    if (!g.zh) return false;
    const z = bareHan(g.zh);
    return z.length > 0 && bareLines.some((bl) => bl.includes(z) || (z.length > 3 && z.includes(bl)));
  });

  const pictures = text.pictures
    ?.filter((p) => p.para >= part.paraFrom && p.para <= part.paraTo)
    .map((p) => ({ ...p, para: p.para - part.paraFrom }));

  const scenes = text.scenes
    ?.filter((sc) => sc.para >= part.paraFrom && sc.para <= part.paraTo)
    .map((sc) => ({ ...sc, para: sc.para - part.paraFrom }));

  // Project sentence highlights/notes from main chapter line indices into 0-based part line indices.
  let study: TextStudy | undefined;
  if (text.study) {
    const marks: Record<string, SentenceMark> = {};
    if (text.study.marks) {
      for (const [k, m] of Object.entries(text.study.marks)) {
        const idx = Number(k);
        if (idx >= part.lineFrom && idx <= part.lineTo) marks[String(idx - part.lineFrom)] = m;
      }
    }
    const hanziBefore = text.lines.slice(0, part.lineFrom).reduce((n, l) => n + lineHanziCount(l), 0);
    const copied =
      text.study.copied !== undefined
        ? Math.max(0, Math.min(part.hanzi, text.study.copied - hanziBefore))
        : undefined;
    const listened =
      text.study.listened !== undefined
        ? Math.max(0, Math.min(lines.length, text.study.listened - part.lineFrom))
        : undefined;
    const dictated =
      text.study.dictated !== undefined
        ? Math.max(0, Math.min(lines.length, text.study.dictated - part.lineFrom))
        : undefined;
    study = {
      ...text.study,
      ...(copied !== undefined ? { copied } : {}),
      ...(listened !== undefined ? { listened } : {}),
      ...(dictated !== undefined ? { dictated } : {}),
      marks: Object.keys(marks).length ? marks : undefined,
    };
  }

  return {
    ...text,
    lines,
    vocab,
    teach,
    grammar,
    questions: part.index === part.total ? text.questions : [],
    pictures: pictures?.length ? pictures : undefined,
    scenes: scenes?.length ? scenes : undefined,
    study,
    read: isPartRead(text, part),
  };
}
