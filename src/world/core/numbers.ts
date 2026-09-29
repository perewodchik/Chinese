/**
 * Chinese numbers as a seller says them and a learner types them (Y6,
 * shared with the shops of Y1/Y2): 二十五, 两百, 一百零五, 一百一十, and the
 * market's short 一百五 (= 150) and 一百一 (= 110); digits too. Prices add
 * 块/元/毛 and the 五 after 块 (三块五 = 3.5).
 */

const DIGITS = '零一二三四五六七八九';
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

/** 一 … 九千九百九十九 from Chinese numerals or digits; null when it is not a number. */
export function readNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  const t = s.replace(/两/g, '二');
  if (!/^[零一二三四五六七八九十百千]+$/.test(t)) return null;
  let total = 0;
  let num = -1;
  let unit = 0;
  let zero = false;
  for (const ch of t) {
    if (ch === '零') {
      zero = true;
      continue;
    }
    const u = UNITS[ch];
    if (u) {
      // 十 alone at the start is 一十; a unit after a unit (百十) is not a number
      if (num < 0 && !(u === 10 && total === 0)) return null;
      if (unit && u >= unit) return null;
      total += (num < 0 ? 1 : num) * u;
      num = -1;
      unit = u;
      zero = false;
      continue;
    }
    // two digits in a row (二五) is not how a number is said
    if (num >= 0) return null;
    num = DIGITS.indexOf(ch);
  }
  if (num >= 0) {
    // 一百五 is 150: a last digit straight after 百 or 千 counts in the next unit down
    total += unit >= 100 && !zero ? (num * unit) / 10 : num;
  }
  return total;
}

const NUM = '\\d+(?:\\.\\d+)?|[零一二两三四五六七八九十百千]+';

/**
 * The price in a line — 「二十块」, 「最多三十」, 「一百五行吗」, 「三块五」, 「五毛」,
 * 「25」 — or null. A bare Chinese numeral counts only when nothing but a
 * price word, a question or the end follows, so 「便宜一点」 is not 1.
 */
export function priceFrom(text: string): number | null {
  const re = new RegExp(`(${NUM})\\s*(块钱|块|元|毛钱|毛)?([一二三四五六七八九])?`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [all, raw = '', unit, tail] = m;
    const rest = text.slice(m.index + all.length);
    const n = /^\d/.test(raw) ? Number(raw) : readNumber(raw);
    if (n === null) continue;
    if (!unit && !/^\d/.test(raw) && !/^(\s*$|[，。！？,.!?吧呢啊呀]|行|可以|怎么样|好不好|卖)/.test(rest)) continue;
    // 块 + a digit is that many 毛 (三块五)
    if (unit?.startsWith('毛')) return n / 10;
    if (unit && tail) return n + DIGITS.indexOf(tail) / 10;
    if (!unit && tail) continue;
    return n;
  }
  return null;
}
