import type { FormPos, RadicalEntry, RadicalForm } from '../../data/radicals';

/**
 * Reading the radical dataset: what a position is called, and how a radical is
 * found by typing.
 *
 * Nothing here knows about characters. A radical's examples are characters,
 * but they arrive in the radical data already read and glossed, so this module
 * never has to reach into the character table to explain one.
 */

/** A position as a label beside a form: "忄 left". */
export const POSITION_LABEL: Record<FormPos, string> = {
  alone: 'full form',
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  topLeft: 'top-left',
  bottomLeft: 'bottom-left',
  topRight: 'top-right',
  around: 'all round',
};

/** The same, as a phrase: "忄 is written on the left". */
export const POSITION_PHRASE: Record<FormPos, string> = {
  alone: 'written in full',
  left: 'on the left',
  right: 'on the right',
  top: 'on top',
  bottom: 'underneath',
  topLeft: 'over the top and down the left',
  bottomLeft: 'along the bottom and up the left',
  topRight: 'over the top and down the right',
  around: 'all the way round',
};

export const mainForm = (r: RadicalEntry): RadicalForm => r.forms[0];

/** 1st, 2nd, 3rd, 11th, 22nd. */
export function ordinal(n: number): string {
  const tail = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${tail[(v - 20) % 10] ?? tail[v] ?? tail[0]}`;
}

const flat = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * How well a radical answers a search, lower is better, or -1 for not at all.
 *
 * Every written form counts as the radical: typing 心 finds radical 61 whose
 * card shows 忄, and typing 月 finds both the moon and the flesh radical that
 * is drawn exactly like it — which is the answer someone typing 月 needs.
 */
export function searchScore(r: RadicalEntry, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const glyphs = new Set([r.r, r.kangxi, r.word, ...r.forms.map((f) => f.g)]);
  if (glyphs.has(q)) return 0;
  const fq = flat(q);
  const py = flat(r.py);
  if (py === fq) return 1;
  const names = r.forms.map((f) => `${f.name ?? ''} ${flat(f.namePy ?? '')}`).join(' ');
  if (names.includes(q) || names.includes(fq)) return 2;
  const mean = r.mean.toLowerCase();
  if (mean.startsWith(q)) return 3;
  if (py.startsWith(fq)) return 4;
  if (mean.includes(q) || (r.about ?? '').toLowerCase().includes(q)) return 5;
  if (String(r.n) === q) return 6;
  return -1;
}
