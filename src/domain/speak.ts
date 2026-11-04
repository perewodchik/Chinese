import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import { charScore, GREEN, noteOf, partsOf, type Attempt, type Fault } from './phrases';
import { isHanzi } from './text';

/**
 * The new Speak's rules, apart from any screen: which scored syllable each
 * character of a line is, what is worth fixing in a try (by word, since a word
 * is what is practised on its own), which lines are worth saying again, and
 * the short tag a character's fault is written as under it.
 */

/** For each character of `zh` (by code point), the index in `result.syllables` of the syllable scored for it, or null. */
export function matchSyllables(zh: string, result: EvalResult | null): Array<number | null> {
  const scored = (result?.syllables ?? []).filter((x) => x.said !== 'added');
  let s = 0;
  return [...zh].map((char) => {
    if (!isHanzi(char) || !result) return null;
    // Scored syllables follow the characters in order; one is matched to a character only when it is that character.
    let k = s;
    while (k < scored.length && scored[k]!.char !== char) k++;
    if (k >= scored.length) return null;
    s = k + 1;
    return result.syllables.indexOf(scored[k]!);
  });
}

/** What was wrong, as short as a tag under a character: zh→z, tone 2→1, not heard, nearly. */
export function tagOf(s: SyllableEval): string {
  if (s.said === 'missed') return 'not heard';
  const p = partsOf(s.symbol);
  const want = s.sandhi ?? p.tone;
  if (s.initial && p.initial) return s.initialLike ? `${p.initial}→${s.initialLike}` : p.initial;
  if (s.final) return s.finalLike ? `${p.final}→${s.finalLike}` : p.final;
  if (s.tone) return s.heardTone && s.heardTone !== want ? `tone ${want}→${s.heardTone}` : `tone ${want}`;
  if (s.extraBefore) return 'extra before';
  const n = charScore(s);
  return n !== undefined && n < GREEN ? 'nearly' : '';
}

/** A word of the line with something to fix in it: its characters, their syllables, the worst number and what to change. */
export interface Fix {
  word: string;
  /** where the word starts in the line, by code point */
  at: number;
  /** each character of the word, its tone-marked reading, and the syllable scored for it */
  chars: Array<{ char: string; py: string; syl: SyllableEval | null }>;
  /** the lowest character's number */
  worst: number;
  band: 'mid' | 'low';
  /** what went wrong, worst first, each kind once */
  faults: Fault[];
}

/**
 * The words of a try worth fixing, in the order of the line. A word is
 * listed when any of its characters is not green; a word said well is not,
 * so the list is the work left, and an empty list means the line is done.
 *
 * `words` are the line's words as the reader cuts them (each a run of
 * characters and where it starts); a character outside any is a word alone.
 */
export function fixesOf(zh: string, readings: string[], result: EvalResult, words: Array<{ text: string; at: number }>): Fix[] {
  const chars = [...zh];
  const match = matchSyllables(zh, result);
  // Each hanzi's reading, by its place among the hanzi.
  const pyAt: string[] = [];
  let k = 0;
  for (const c of chars) pyAt.push(isHanzi(c) ? (readings[k++] ?? '') : '');
  const starts = new Map(words.map((w) => [w.at, [...w.text].length]));
  const out: Fix[] = [];
  for (let i = 0; i < chars.length; ) {
    if (!isHanzi(chars[i]!)) {
      i++;
      continue;
    }
    const len = Math.max(1, starts.get(i) ?? 1);
    const span = Array.from({ length: len }, (_, j) => i + j).filter((j) => j < chars.length && isHanzi(chars[j]!));
    const parts = span.map((j) => ({ char: chars[j]!, py: pyAt[j]!, syl: match[j] !== null ? result.syllables[match[j]!]! : null }));
    const scored = parts.filter((p) => p.syl);
    const bands = scored.map((p) => noteOf(p.syl!).band);
    if (bands.some((b) => b !== 'good')) {
      const faults: Fault[] = [];
      for (const p of scored) for (const f of noteOf(p.syl!).faults) if (!faults.some((x) => x.kind === f.kind)) faults.push(f);
      const worst = Math.min(...scored.map((p) => charScore(p.syl!) ?? (noteOf(p.syl!).band === 'good' ? 100 : 50)));
      out.push({ word: parts.map((p) => p.char).join(''), at: i, chars: parts, worst: Math.round(worst), band: bands.includes('low') ? 'low' : 'mid', faults });
    }
    i += len;
  }
  return out;
}

/** The pause SpeechSuper heard inside the line, after which characters: a learner's flow is where words join. */
export const pausesOf = (result: EvalResult): string[] => result.syllables.filter((s) => s.pause).map((s) => s.char);

/** Each line's best total, from its tries; lines never said are left out. */
export function bestOf(attempts: Record<string, Attempt[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [zh, list] of Object.entries(attempts)) if (list.length) out.set(zh, Math.max(...list.map((a) => a.total)));
  return out;
}

/**
 * Lines worth saying again: said before, their best under green, the ones
 * said most lately first — what was being worked on is what is fresh.
 */
export function weakLines(attempts: Record<string, Attempt[]>, limit = 10): string[] {
  return Object.entries(attempts)
    .filter(([, list]) => list.length && Math.max(...list.map((a) => a.total)) < GREEN)
    .sort((a, b) => Math.max(...b[1].map((x) => x.at)) - Math.max(...a[1].map((x) => x.at)))
    .slice(0, limit)
    .map(([zh]) => zh);
}

/** Lines whose latest try had this kind of fault (tone3, initial:zh…), the latest first. */
export function linesWithFault(attempts: Record<string, Attempt[]>, kind: string, limit = 10): string[] {
  return Object.entries(attempts)
    .map(([zh, list]) => ({ zh, last: list.reduce<Attempt | null>((a, b) => (!a || b.at > a.at ? b : a), null) }))
    .filter((x) => x.last?.faults.some((f) => f.kind === kind))
    .sort((a, b) => b.last!.at - a.last!.at)
    .slice(0, limit)
    .map((x) => x.zh);
}

/** How many lines were said since midnight, and how many of those reached green. */
export function today(attempts: Record<string, Attempt[]>, now = Date.now()): { said: number; green: number } {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  let said = 0;
  let green = 0;
  for (const list of Object.values(attempts)) {
    const todays = list.filter((a) => a.at >= midnight.getTime());
    if (!todays.length) continue;
    said += 1;
    if (Math.max(...todays.map((a) => a.total)) >= GREEN) green += 1;
  }
  return { said, green };
}
