import { toneOf, withoutTone } from '../drill';
import { hanziOnly, syllablesOf } from './items';

/**
 * Checking typed answers — forgiving about how something was typed, strict
 * about what was typed.
 */

/* ------------------------------------------------------------------ pinyin */

export type SyllableVerdict = 'right' | 'tone' | 'wrong';

export interface PinyinCheck {
  /** every syllable right, tones included */
  ok: boolean;
  /** the sounds all right, one or more tones not */
  tonesOnly: boolean;
  syllables: Array<{ expected: string; verdict: SyllableVerdict }>;
}

const MARKED: Record<string, [string, number]> = {};
for (const [base, marks] of Object.entries({ a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', v: 'ǖǘǚǜ' })) {
  [...marks].forEach((m, i) => (MARKED[m] = [base, i + 1]));
}

/**
 * The letters of a typed reading and where each tone was given: "huo3che1",
 * "huǒ chē", "huo3 che1" and "nv3" / "nü3" / "nu:3" all read the same way.
 * Returns the bare letters (ü as v) and, for each tone found, the index in
 * the letters it follows (digits) or falls inside (marks).
 */
function readTyped(input: string): { letters: string; tones: Array<{ at: number; tone: number }> } {
  const s = input.toLowerCase().normalize('NFC').replace(/u:/g, 'v').replace(/ü/g, 'v');
  let letters = '';
  const tones: Array<{ at: number; tone: number }> = [];
  for (const ch of s) {
    if (MARKED[ch]) {
      letters += MARKED[ch][0];
      tones.push({ at: letters.length - 1, tone: MARKED[ch][1] });
    } else if (/[a-z]/.test(ch)) {
      letters += ch;
    } else if (/[0-5]/.test(ch) && letters) {
      tones.push({ at: letters.length - 1, tone: ch === '0' ? 5 : Number(ch) });
    }
  }
  return { letters, tones };
}

const bareOf = (py: string) => withoutTone(py).toLowerCase().replace(/ü/g, 'v');

export function checkPinyin(input: string, expected: string): PinyinCheck {
  const want = syllablesOf(expected).map((py) => ({ py, bare: bareOf(py), tone: toneOf(py) }));
  const typed = readTyped(input);
  const verdicts: SyllableVerdict[] = [];

  if (typed.letters === want.map((w) => w.bare).join('')) {
    // The sounds are all there: find each syllable's span and the tone given in it.
    let start = 0;
    for (const w of want) {
      const end = start + w.bare.length - 1;
      const given = typed.tones.find((t) => t.at >= start && t.at <= end)?.tone ?? 5;
      verdicts.push(given === w.tone ? 'right' : 'tone');
      start = end + 1;
    }
  } else {
    // Something is wrong with the sounds. Split what was typed where it was
    // split, and judge syllable by syllable where the counts line up.
    const parts = input
      .trim()
      .split(/[\s'’]+|(?<=[0-5])/)
      .filter(Boolean);
    for (let i = 0; i < want.length; i++) {
      const p = parts.length === want.length ? readTyped(parts[i]!) : null;
      if (!p || p.letters !== want[i]!.bare) verdicts.push('wrong');
      else verdicts.push((p.tones[0]?.tone ?? 5) === want[i]!.tone ? 'right' : 'tone');
    }
  }
  const ok = verdicts.every((v) => v === 'right');
  return {
    ok,
    tonesOnly: !ok && verdicts.every((v) => v !== 'wrong'),
    syllables: want.map((w, i) => ({ expected: w.py, verdict: verdicts[i]! })),
  };
}

/* ------------------------------------------------------------------ meaning */

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\b(to|a|an|the|be)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (s: string) => s.replace(/(?<=[a-z]{3})(es|s)$/, '');

/** Edits between two strings, a swapped pair of letters counting as one (the commonest slip). */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/** The senses a definition accepts, normalised: "good, excellent; well" → good, excellent, well. */
export function senses(def: string): string[] {
  return [
    ...new Set(
      def
        .split(/[;,/]/)
        .map(normalise)
        .filter(Boolean),
    ),
  ];
}

/**
 * Whether a typed meaning is one of the definition's senses: case, articles,
 * "to", a plural and one slip of the keyboard (two in a long word) forgiven.
 * `accepted` is what this learner has said was right before.
 */
export function checkMeaning(input: string, def: string, accepted: readonly string[] = []): boolean {
  const said = normalise(input);
  if (!said) return false;
  for (const s of [...senses(def), ...accepted.map(normalise)]) {
    if (s === said || singular(s) === singular(said)) return true;
    const slips = said.length >= 8 ? 2 : said.length >= 4 ? 1 : 0;
    if (slips && distance(s, said) <= slips) return true;
    // "hello" for "hello; hi" is right; so is "car" for "car, vehicle"
    if (s.split(' ').length > 1 && said.split(' ').length === 1 && s.split(' ').includes(said) && said.length > 3) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ hanzi */

export interface HanziCheck {
  ok: boolean;
  /** whether anything typed was a character at all — Latin letters mean the wrong keyboard */
  anyHanzi: boolean;
  /** each expected character, and whether the one typed in its place matched */
  chars: Array<{ want: string; got: string | null; ok: boolean }>;
}

export function checkHanzi(input: string, expected: string): HanziCheck {
  const got = [...hanziOnly(input)];
  const want = [...hanziOnly(expected)];
  return {
    ok: got.join('') === want.join(''),
    anyHanzi: got.length > 0,
    chars: want.map((w, i) => ({ want: w, got: got[i] ?? null, ok: got[i] === w })),
  };
}

/* ------------------------------------------------------------------ order */

/** Time words may stand before or after the subject: 我今天去 and 今天我去 are both right. */
const TIME_WORDS = new Set(['今天', '明天', '昨天', '现在', '上午', '下午', '晚上', '早上', '中午', '今年', '明年', '去年', '每天', '以后', '以前']);

export type OrderVerdict = 'right' | 'also' | 'wrong';

/**
 * Tiles put in order, against the sentence they came from. Anything that is
 * the sentence, character for character, is right however the tiles cut it;
 * the same with one time word moved to the other side of the subject is
 * "also possible".
 */
export function checkOrder(answer: string[], expected: string[]): OrderVerdict {
  const a = answer.join('');
  const e = expected.join('');
  if (hanziOnly(a) === hanziOnly(e) && a.length > 0) return 'right';
  if (answer.length !== expected.length) return 'wrong';
  for (let i = 0; i < answer.length; i++) {
    if (!TIME_WORDS.has(answer[i]!)) continue;
    const rest = answer.filter((_, k) => k !== i);
    for (let j = 0; j <= rest.length; j++) {
      const moved = [...rest.slice(0, j), answer[i]!, ...rest.slice(j)];
      if (moved.join('') === e && Math.abs(j - i) <= 1) return 'also';
    }
  }
  return 'wrong';
}
