/**
 * 成语 Practise (§10 P3): a short round of up to eight questions, only from
 * the 成语 you have heard (the test-only-learned rule), the weak ones first.
 * Pure: the round, the options and the check live here; the Collection tab
 * only draws them.
 *
 * Five kinds of question, mixed:
 * - `pick-idiom`: the English meaning → pick the 成语 from four
 * - `pick-meaning`: the 成语 → pick the meaning from four
 * - `gap`: the 成语 with one character hidden → pick the character from four
 * - `say`: the meaning → say or type the 成语 (voice / keyboard / pinyin)
 * - `listen`: the 成语 is played → pick it from four
 *
 * Distractors come from other 成语 you know first, then from the game's
 * list, so a round with four known 成语 still has four options. No timers,
 * no lives: a miss only moves the 成语 up the next round's order.
 */

import { clean, hanziOnly, hasHanzi, pinyinSyllables, readingSyllables } from './dialogue/normalize';
import type { Idiom, WorldSave } from './types';

export type QuestionKind = 'pick-idiom' | 'pick-meaning' | 'gap' | 'say' | 'listen';
export const QUESTION_KINDS: readonly QuestionKind[] = ['pick-idiom', 'pick-meaning', 'gap', 'say', 'listen'];

/** how many 成语 must be known before Practise opens */
export const PRACTISE_MIN = 4;
/** the longest round */
export const ROUND_MAX = 8;
/** the flag set by the first round with nothing missed (its reward comes once) */
export const PERFECT_FLAG = 'idioms-perfect-round';

export interface Practised {
  right: number;
  wrong: number;
  /** the game minute it was last asked */
  last: number;
}

export interface Question {
  kind: QuestionKind;
  idiom: Idiom;
  /** four distinct options (the 成语, its meaning, or one character); none for `say` */
  options: string[];
  /** the right option, or for `say` the 成语 itself */
  answer: string;
  /** `gap`: which character is hidden */
  gap?: number;
}

/** The 成语 heard, known to the content. */
export function knownIdioms(s: WorldSave, idioms: readonly Idiom[]): Idiom[] {
  return idioms.filter((i) => s.idioms[i.id]);
}

export const canPractise = (s: WorldSave, idioms: readonly Idiom[]) => knownIdioms(s, idioms).length >= PRACTISE_MIN;

/**
 * Weakest first: never asked, then the most missed against got right, then
 * the longest ago; the id breaks a tie so the order is the same everywhere.
 */
export function weakFirst(s: WorldSave, idioms: readonly Idiom[]): Idiom[] {
  const p = s.practised ?? {};
  const score = (i: Idiom) => {
    const e = p[i.id];
    return e ? e.right - e.wrong : -Infinity;
  };
  return knownIdioms(s, idioms).sort((a, b) => score(a) - score(b) || (p[a.id]?.last ?? -1) - (p[b.id]?.last ?? -1) || (a.id < b.id ? -1 : 1));
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** `n` distinct values other than `answer`: from the known list first (shuffled), then the rest. */
function distractors(answer: string, known: readonly string[], rest: readonly string[], n: number, rand: () => number): string[] {
  const out: string[] = [];
  for (const x of [...shuffle(known, rand), ...shuffle(rest, rand)]) {
    if (out.length >= n) break;
    if (x && x !== answer && !out.includes(x)) out.push(x);
  }
  return out;
}

/**
 * One round: the weakest `max` of the 成语 known, in that order, each with a
 * kind of question. The kinds go round in a shuffled cycle so a round mixes
 * them; `kinds` leaves some out (no `listen` where nothing can speak).
 */
export function buildRound(
  s: WorldSave,
  idioms: readonly Idiom[],
  rand: () => number = Math.random,
  { max = ROUND_MAX, kinds = QUESTION_KINDS }: { max?: number; kinds?: readonly QuestionKind[] } = {},
): Question[] {
  const known = knownIdioms(s, idioms);
  if (known.length < PRACTISE_MIN || !kinds.length) return [];
  const rest = idioms.filter((i) => !s.idioms[i.id]);
  const picked = weakFirst(s, idioms).slice(0, max);
  const cycle = shuffle(kinds, rand);
  return picked.map((idiom, n) => question(idiom, cycle[n % cycle.length]!, known, rest, rand));
}

function question(idiom: Idiom, kind: QuestionKind, known: readonly Idiom[], rest: readonly Idiom[], rand: () => number): Question {
  const others = (f: (i: Idiom) => string) => [known.filter((i) => i !== idiom).map(f), rest.map(f)] as const;
  const four = (answer: string, [k, r]: readonly [string[], string[]]) => shuffle([answer, ...distractors(answer, k, r, 3, rand)], rand);
  switch (kind) {
    case 'pick-meaning':
      return { kind, idiom, answer: idiom.meaning, options: four(idiom.meaning, others((i) => i.meaning)) };
    case 'gap': {
      const chars = [...idiom.id];
      const gap = Math.floor(rand() * chars.length);
      const answer = chars[gap]!;
      // characters from other 成语 that would not also fill the gap
      const pool = (xs: readonly Idiom[]) => [...new Set(xs.flatMap((i) => [...i.id]))].filter((c) => !chars.includes(c));
      return { kind, idiom, gap, answer, options: four(answer, [pool(known.filter((i) => i !== idiom)), pool(rest)]) };
    }
    case 'say':
      return { kind, idiom, answer: idiom.id, options: [] };
    case 'pick-idiom':
    case 'listen':
      return { kind, idiom, answer: idiom.id, options: four(idiom.id, others((i) => i.id)) };
  }
}

/**
 * Whether what was said or typed is the 成语: the same characters, or (the
 * recogniser guesses characters from sound, and pinyin has no characters)
 * the same toneless syllables. `syllablesOf` reads hanzi — the game's
 * lexicon; without it only the characters count for hanzi.
 */
export function saidRight(input: string, idiom: Idiom, syllablesOf?: (zh: string) => string[]): boolean {
  const c = clean(input);
  if (!c) return false;
  const want = readingSyllables(idiom.pinyin).join(' ');
  if (hasHanzi(c)) {
    const zh = hanziOnly(c);
    if (zh === idiom.id) return true;
    return !!syllablesOf && zh.length === [...idiom.id].length && syllablesOf(zh).join(' ') === want;
  }
  return (pinyinSyllables(c) ?? []).join(' ') === want;
}

/** Whether an answer to a question is right. */
export const isRight = (q: Question, answer: string, syllablesOf?: (zh: string) => string[]) =>
  q.kind === 'say' ? saidRight(answer, q.idiom, syllablesOf) : answer === q.answer;

/**
 * The person to thank after the first round with nothing missed: whoever
 * taught you the most 成语 (the one met first on a tie). None when every
 * 成语 came from 兔儿爷 or a sign.
 */
export function bestTeacher(s: WorldSave): string | null {
  const count = new Map<string, number>();
  for (const e of Object.values(s.idioms)) if (e.npc && s.npcs[e.npc]) count.set(e.npc, (count.get(e.npc) ?? 0) + 1);
  const best = [...count].sort(([a, x], [b, y]) => y - x || s.npcs[a]!.met - s.npcs[b]!.met || (a < b ? -1 : 1))[0];
  return best?.[0] ?? null;
}
