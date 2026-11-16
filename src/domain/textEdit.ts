import { linesOf } from './pastedText';
import type { TextLine } from './text';

/**
 * Editing a text's lines by hand (T7): two sentences made one, one cut where
 * Chinese ends its sentences, a line taken out. What a line carries besides
 * its words — who says it, its place on a comic's page — stays with it.
 */

/** The line at `i` and the next as one sentence: their words, pinyin and English run together. */
export function joinWithNext(lines: readonly TextLine[], i: number): TextLine[] {
  const a = lines[i];
  const b = lines[i + 1];
  if (!a || !b) return [...lines];
  const glue = (x: string, y: string) => [x.trim(), y.trim()].filter(Boolean).join(' ');
  const joined: TextLine = { ...a, zh: a.zh.trim() + b.zh.trim(), py: glue(a.py, b.py), en: glue(a.en, b.en) };
  return [...lines.slice(0, i), joined, ...lines.slice(i + 2)];
}

/**
 * Where the line at `i` can be cut: after each 。！？ inside it, else after
 * each ，；. Empty when it is one short clause.
 */
export function cutsOf(zh: string): string[] {
  const sentences = linesOf(zh).map((l) => l.zh);
  if (sentences.length > 1) return sentences;
  return zh.match(/[^，；,;]+[，；,;]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [zh];
}

/**
 * The line at `i` cut into its sentences (or clauses): the first keeps its
 * paragraph mark and everything else it carried. Each piece is given its
 * pinyin by `pinyin` when there is one; the English, which cannot be cut by
 * machine, stays with the first piece to be fixed by hand.
 */
export function split(lines: readonly TextLine[], i: number, pinyin?: (zh: string) => string): TextLine[] {
  const line = lines[i];
  if (!line) return [...lines];
  const pieces = cutsOf(line.zh);
  if (pieces.length < 2) return [...lines];
  const out: TextLine[] = pieces.map((zh, k) => {
    const py = pinyin ? pinyin(zh) : k === 0 ? line.py : '';
    return k === 0 ? { ...line, zh, py } : { zh, py, en: '', ...(line.who ? { who: line.who } : {}) };
  });
  return [...lines.slice(0, i), ...out, ...lines.slice(i + 1)];
}

export const removeLine = (lines: readonly TextLine[], i: number): TextLine[] => lines.filter((_, k) => k !== i);
