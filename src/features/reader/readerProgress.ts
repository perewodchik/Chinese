import { isHanzi, type GeneratedText } from '../../domain/text';
import { accountKey } from '../../platform/accountStorage';
import { stored } from '../../platform/storage';

/**
 * How far down a text has been read, 0 to 1: how much of it has gone up past
 * the top of the room it is read in, over how much can. All of it once its
 * end is in the room (a pixel or two short counts), and a text shorter than
 * the room is all of it at once.
 *
 * @param scrolled how far the text's top has gone above the room's top
 * @param height the text's height
 * @param room the height it is read in, between the bar and the foot
 */
export function scrolledShare(scrolled: number, height: number, room: number): number {
  const can = height - room;
  if (can <= 2 || scrolled >= can - 2) return 1;
  return Math.min(1, Math.max(0, scrolled / can));
}

/** About how long a text (or a part of one, by hanzi count) takes: ~70 characters a minute at HSK 1–2. */
export const minutesForHanzi = (hanzi: number): number => Math.max(1, Math.round(hanzi / 70));

export function minutesToRead(text: GeneratedText): number {
  return minutesForHanzi(text.lines.reduce((n, l) => n + [...l.zh].filter(isHanzi).length, 0));
}

/**
 * How far down each text was last scrolled, kept on this device, so the book
 * page can say "40%" beside the chapter being read. Whole percents only: a
 * scroll writes when the number changes, not on every frame.
 */
const SHARES = 'hanzi.reader.shares';

function readShares(): Record<string, number> {
  try {
    const v = JSON.parse(stored.get(accountKey(SHARES)) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function rememberShare(textId: string, share: number) {
  const pct = Math.round(share * 100);
  const all = readShares();
  if (all[textId] === pct) return;
  all[textId] = pct;
  try {
    stored.set(accountKey(SHARES), JSON.stringify(all));
  } catch {
    // private browsing: the book page shows minutes instead
  }
}

/** The percent last reached in a text on this device, or null if it was never opened here. */
export function shareOf(textId: string): number | null {
  const v = readShares()[textId];
  return typeof v === 'number' ? v : null;
}
