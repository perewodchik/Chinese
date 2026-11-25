import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { alignPinyin } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { isHanzi, type GeneratedText } from '../../domain/text';
import { useLibrary } from '../shared/library';


/** Copying out's layout: the text cut into pieces to write, and how big the squares can be on this screen. */

export interface Unit {
  /** the characters to write: one, or a word's worth */
  text: string;
  /** their readings, one per character */
  py: string[];
  line: number;
  /** characters of the whole text before this unit, for the progress */
  before: number;
}

export interface Piece {
  text: string;
  /** a piece to write, by index into the units; punctuation is not one */
  unit: number | null;
}

export function cut(text: GeneratedText, lib: ReturnType<typeof useLibrary>, by: 'word' | 'char'): { units: Unit[]; lines: Piece[][] } {
  const own = new Set(text.vocab.map((v) => v.w));
  const units: Unit[] = [];
  const lines: Piece[][] = [];
  let before = 0;
  text.lines.forEach((l, i) => {
    const py = alignPinyin(l, lib);
    let h = 0;
    const pieces: Piece[] = [];
    for (const t of segment(l.zh, lib, new Set([...own, ...writerHints(l.zh, l.py, lib)]), { bySense: true })) {
      const chars = [...t.text];
      if (!t.word || !chars.some(isHanzi)) {
        pieces.push({ text: t.text, unit: null });
        continue;
      }
      const groups = by === 'word' ? [chars] : chars.map((c) => [c]);
      for (const g of groups) {
        const readings = g.map((c) => (isHanzi(c) ? (py[h++] ?? '') : ''));
        units.push({ text: g.join(''), py: readings, line: i, before });
        pieces.push({ text: g.join(''), unit: units.length - 1 });
        before += g.filter(isHanzi).length;
      }
    }
    lines.push(pieces);
  });
  return { units, lines };
}

/**
 * A sentence's pieces in groups that never break across lines: a word with
 * the punctuation after it, so a 。 or ， never starts a line alone.
 */
export function held(pieces: Piece[]): { p: Piece; k: number }[][] {
  const out: { p: Piece; k: number }[][] = [];
  pieces.forEach((p, k) => {
    const mark = p.unit === null && !/[\p{L}\p{N}]/u.test(p.text);
    if (mark && out.length) out[out.length - 1]!.push({ p, k });
    else out.push([{ p, k }]);
  });
  return out;
}

/** The gap between squares, and the text column beside them on a wide screen. */
export const GAP = 22;
/** Stands in the whole-text row for a square a new paragraph leaves empty. */
export const INDENT = '\u3000';
const TEXT_W = 430;
/**
 * The room beside the row of squares: on a wide screen the next square shows
 * 20px of itself there, under a fade; a phone keeps only a sliver.
 */
export const edge = (wide: boolean) => (wide ? GAP + 20 : 12);

/** Wide enough for the text beside the squares. */
const WIDE = 1000;

/**
 * The squares' side and how many fit across. Two always fit side by side;
 * on a wide screen the side is the one they have beside the text, so hiding
 * the text adds squares rather than growing them. Down, the squares leave
 * room for the heading, the strokes and the buttons.
 */
export function useSquares(pane: RefObject<HTMLDivElement | null>, wide: boolean, strip: number) {
  const [box, setBox] = useState({ side: 0, across: 2, width: 0 });
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const besideText = window.innerWidth - TEXT_W - 2 * 34;
      // Room is kept on each side, where the squares beyond the row peek out under a fade.
      const across = (wide ? Math.min(w, besideText) : w) - 2 * edge(wide);
      // heading 56, pinyin 30, the strokes and their label, the buttons 56, and the gaps between
      const down = h - 56 - 30 - (strip + 24) - 56 - 4 * 18;
      const side = Math.floor(Math.max(72, Math.min((across - GAP) / 2, down)));
      setBox({ side, across: Math.max(2, Math.floor((w - 2 * edge(wide) + GAP) / (side + GAP))), width: w });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pane, wide, strip]);
  return box;
}

/** Fades on the edges of a row that has more beyond them, in the paper's colour. */
export function useEdges(el: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [edges, setEdges] = useState({ l: false, r: false });
  useEffect(() => {
    const s = el.current;
    if (!s) return;
    const look = () => setEdges({ l: s.scrollLeft > 2, r: s.scrollLeft + s.clientWidth < s.scrollWidth - 2 });
    look();
    s.addEventListener('scroll', look, { passive: true });
    const ro = new ResizeObserver(look);
    ro.observe(s);
    return () => {
      s.removeEventListener('scroll', look);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return edges;
}

export function useWide() {
  const q = `(min-width: ${WIDE}px)`;
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return wide;
}
