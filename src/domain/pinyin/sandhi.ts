/**
 * The tones people actually say, as opposed to the ones the dictionary prints.
 *
 * Every reading in the data is a citation tone: 你好 is nǐ hǎo. Nobody says
 * that — two third tones in a row come out as ní hǎo — and a checker that
 * expected the printed tones would mark a native speaker wrong. So before
 * anything is judged, the expected tones are run through the three rules
 * that account for nearly all of it in everyday Mandarin:
 *
 * - **third + third**: the first becomes second (你好 ní hǎo). In a run of
 *   three or more, how the run breaks depends on how the phrase is grouped;
 *   turning all but the last into seconds is what fast speech does and is
 *   marked as an approximation.
 * - **一 yī**: fourth before tones 1–3 (一天 yì tiān), second before a
 *   fourth (一样 yí yàng), but first where it is a number being counted or
 *   ordered (第一, 十一, 一九八四).
 * - **不 bù**: second before a fourth (不是 bú shì).
 *
 * It also says which third tones are *half* thirds: a third tone with
 * anything after it is said low and never climbs back up (好吃 hǎo chī is
 * "low, then high"), and only a third at the end of a phrase may rise.
 */

export type SandhiRule = 'third' | 'yi' | 'bu';

export interface Spoken {
  /** the character, when known */
  char: string;
  /** the tone the dictionary gives, 1–5 */
  citation: number;
  /** the tone to expect in speech, 1–5 */
  surface: number;
  /** which rule changed it, if one did */
  rule?: SandhiRule;
  /** a third tone that stays low and does not rise */
  halfThird: boolean;
  /** the rule applied to a run of 3+ thirds, whose grouping can vary */
  approximate: boolean;
}

const DIGITS = new Set('零〇一二三四五六七八九十百千万亿两');

/**
 * The spoken tones of one phrase.
 *
 * `chars` may be empty or shorter than `tones` (a reading without its
 * characters); 一 and 不 are then simply not recognised, and only the
 * third-tone rule applies.
 */
export function spokenTones(tones: number[], chars: string[] = []): Spoken[] {
  const out: Spoken[] = tones.map((t, i) => ({
    char: chars[i] ?? '',
    citation: t,
    surface: t,
    halfThird: false,
    approximate: false,
  }));

  // 一 and 不 first: they are decided by the citation tone of what follows,
  // and they can themselves end up before a third without being one.
  for (let i = 0; i < out.length; i++) {
    const s = out[i]!;
    const next = out[i + 1];
    if (s.char === '一' && s.citation === 1 && next) {
      const prev = out[i - 1];
      const counting = (prev && (prev.char === '第' || DIGITS.has(prev.char))) || DIGITS.has(next.char);
      if (!counting) {
        s.surface = next.citation === 4 || next.citation === 5 ? 2 : 4;
        s.rule = 'yi';
      }
    } else if (s.char === '不' && s.citation === 4 && next && next.citation === 4) {
      s.surface = 2;
      s.rule = 'bu';
    }
  }

  // Runs of third tones, right to left: all but the last become second.
  let i = 0;
  while (i < out.length) {
    if (out[i]!.surface !== 3) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && out[j + 1]!.surface === 3) j++;
    const long = j - i >= 2;
    for (let k = i; k < j; k++) {
      out[k]!.surface = 2;
      out[k]!.rule = 'third';
      out[k]!.approximate = long;
    }
    i = j + 1;
  }

  // A third with something after it is a half third.
  out.forEach((s, k) => {
    if (s.surface === 3 && k < out.length - 1) s.halfThird = true;
  });
  return out;
}

export const RULE_NOTE: Record<SandhiRule, string> = {
  third: 'Two third tones in a row: the first is said as a second.',
  yi: '一 changes with what follows: yì before tones 1–3, yí before a fourth.',
  bu: '不 before a fourth tone is said bú.',
};
