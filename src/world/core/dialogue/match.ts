/**
 * Utterance → intent (prompt §4.1–4.3).
 *
 * An intent's `match` is a list of groups; it matches when every group has
 * a hit. Order and extra words do not matter, so 请问地铁站怎么走 and
 * 地铁在哪儿 both ask for the subway.
 *
 * A hit, for hanzi input, is the entry standing in the sentence as whole
 * words (怎么走 = 怎么 | 走); an entry of two characters or more may also
 * sit inside a longer word (地铁 in 地铁站). For typed pinyin it is the
 * entry's toneless syllables standing in a row among the input's.
 *
 * A word right after 不, 没 or 别 is not said: 不要 is no 要, 不好 no 好,
 * 没有 no 有 — unless the entry itself starts with the negation (不要, 没有).
 *
 * Voice comes as hanzi and the recogniser guesses characters from sound, so
 * when the hanzi does not match but its sound does, the intent is accepted
 * with a note: "I heard 卖 (mài, sell) — did you mean 买 (mǎi, buy)?"
 */

import type { Expect } from '../types';
import type { Lexicon } from './lexicon';
import { clean, hanziOnly, hasHanzi, pinyinSyllables, type Normalized } from './normalize';

export function normalize(input: string, lex: Lexicon): Normalized {
  const raw = input;
  const c = clean(input);
  if (!c) return { raw, kind: 'empty', hanzi: '', syllables: [] };
  if (hasHanzi(c)) {
    const hanzi = hanziOnly(c);
    return { raw, kind: 'hanzi', hanzi, syllables: lex.syllables(hanzi) };
  }
  const syl = pinyinSyllables(c);
  if (syl) return { raw, kind: 'pinyin', hanzi: '', syllables: syl };
  return { raw, kind: 'other', hanzi: '', syllables: [] };
}

const NEGATIONS = new Set(['不', '没', '别']);
const NEGATION_SYLLABLES = new Set(['bu', 'mei', 'bie']);

/** The entry as whole words of the sentence, or (two characters up) anywhere in it — and not negated. */
export function hanziHit(entry: string, words: readonly string[], hanzi: string): boolean {
  const e = hanziOnly(entry) || entry;
  const said = (at: number) => at === 0 || NEGATIONS.has(e[0]!) || !NEGATIONS.has(hanzi[at - 1]!);
  if (e.length >= 2) {
    for (let at = hanzi.indexOf(e); at >= 0; at = hanzi.indexOf(e, at + 1)) if (said(at)) return true;
  }
  for (let i = 0, at = 0; i < words.length; at += words[i]!.length, i++) {
    let acc = '';
    for (let j = i; j < words.length && acc.length < e.length; j++) {
      acc += words[j];
      if (acc === e && said(at)) return true;
    }
  }
  return false;
}

export function soundHit(entry: string, syllables: readonly string[], lex: Lexicon): boolean {
  const target = hasHanzi(entry) ? lex.syllables(hanziOnly(entry)) : (pinyinSyllables(entry) ?? []);
  if (!target.length || target.length > syllables.length) return false;
  const negated = NEGATION_SYLLABLES.has(target[0]!);
  for (let i = 0; i + target.length <= syllables.length; i++) {
    if (target.every((t, k) => syllables[i + k] === t) && (negated || i === 0 || !NEGATION_SYLLABLES.has(syllables[i - 1]!))) return true;
  }
  return false;
}

export interface HeardAs {
  /** what the recogniser wrote */
  said: string;
  /** the word the script wanted */
  meant: string;
}

export interface Match {
  expect: Expect;
  index: number;
  /** by the characters, by typed pinyin, or by sound only (voice misheard) */
  via: 'hanzi' | 'pinyin' | 'sound';
  heard: HeardAs[];
}

type Hit = (entry: string) => boolean;

function best(expects: readonly Expect[], hit: Hit): { expect: Expect; index: number } | null {
  let top: { expect: Expect; index: number; groups: number } | null = null;
  expects.forEach((expect, index) => {
    if (!expect.match.length) return;
    if (!expect.match.every((g) => g.some(hit))) return;
    if (!top || expect.match.length > top.groups) top = { expect, index, groups: expect.match.length };
  });
  return top;
}

/** The characters in the input that sound like `entry` — what the recogniser wrote instead. */
function misheard(entry: string, input: Normalized, lex: Lexicon): string {
  const target = lex.syllables(hanziOnly(entry));
  const chars = [...input.hanzi];
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j <= Math.min(chars.length, i + target.length + 1); j++) {
      const span = chars.slice(i, j).join('');
      const syl = lex.syllables(span);
      if (syl.length === target.length && syl.every((s, k) => s === target[k])) return span;
    }
  }
  return '';
}

export function matchIntent(expects: readonly Expect[], input: Normalized, lex: Lexicon): Match | null {
  if (input.kind === 'pinyin') {
    const m = best(expects, (e) => soundHit(e, input.syllables, lex));
    return m && { ...m, via: 'pinyin', heard: [] };
  }
  if (input.kind !== 'hanzi') return null;
  const words = lex.words(input.hanzi);
  const byChars = best(expects, (e) => hanziHit(e, words, input.hanzi));
  if (byChars) return { ...byChars, via: 'hanzi', heard: [] };
  const bySound = best(expects, (e) => hanziHit(e, words, input.hanzi) || soundHit(e, input.syllables, lex));
  if (!bySound) return null;
  const heard: HeardAs[] = [];
  for (const group of bySound.expect.match) {
    if (group.some((e) => hanziHit(e, words, input.hanzi))) continue;
    const meant = group.find((e) => soundHit(e, input.syllables, lex));
    if (!meant) continue;
    const said = misheard(meant, input, lex);
    if (said && said !== meant) heard.push({ said, meant });
  }
  return { ...bySound, via: 'sound', heard };
}

/** The companion's note for a misheard word, in English. */
export function heardNote(h: HeardAs, lex: Lexicon): string {
  const g = (w: string) => {
    const x = lex.gloss(w);
    if (!x) return w;
    return x.en ? `${w} (${x.py}, ${x.en})` : `${w} (${x.py})`;
  };
  return `I heard ${g(h.said)} — did you mean ${g(h.meant)}?`;
}
