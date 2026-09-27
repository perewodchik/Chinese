/**
 * Numbers in Chinese, the way a price, a time or a count is said.
 *
 * 0–99 is all the games need. Two before a measure word is 两 — 两本书, never
 * 二本书 — and two o'clock is 两点; `count` knows that, `plain` does not.
 */
const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PY = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];

export function plain(n: number): string {
  if (n < 10) return DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return `十${DIGITS[n % 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  return `${DIGITS[t]}十${u ? DIGITS[u] : ''}`;
}

export function plainPy(n: number): string {
  if (n < 10) return PY[n];
  if (n === 10) return 'shí';
  if (n < 20) return `shí ${PY[n % 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  return `${PY[t]} shí${u ? ` ${PY[u]}` : ''}`;
}

/** A number in front of a measure word or 点: 两, not 二. */
export const count = (n: number) => (n === 2 ? '两' : plain(n));
export const countPy = (n: number) => (n === 2 ? 'liǎng' : plainPy(n));
