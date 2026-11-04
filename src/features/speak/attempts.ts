import type { EvalResult } from '../../../shared/speechEval';
import type { Attempt } from '../../domain/phrases';
import { keepTry, loadHistory, remember } from '../pinyin/speechHistory';
import { accountKey } from '../../platform/accountStorage';

/**
 * Each line's last tries, kept on this device at once and in the account as
 * soon as they can be sent: what Phrases (and the new Speak) colour a line and
 * a text by. The same key as Phrases as it was, so a line said in one shows in the other.
 */

const KEPT = 'hanzi.phrases.attempts';

export const loadAttempts = (): Record<string, Attempt[]> => {
  try {
    return JSON.parse(localStorage.getItem(accountKey(KEPT)) ?? '{}') as Record<string, Attempt[]>;
  } catch {
    return {};
  }
};

export function saveAttempts(all: Record<string, Attempt[]>) {
  try {
    localStorage.setItem(accountKey(KEPT), JSON.stringify(all));
  } catch {
    // kept for this visit only
  }
}

/** Keeps a try on this device at once and in the account, with the service's whole answer. */
export function keepAttempt(zh: string, a: Attempt, sourceId: string, result: EvalResult, id: string): Record<string, Attempt[]> {
  const all = loadAttempts();
  all[zh] = [...(all[zh] ?? []), a].slice(-5);
  saveAttempts(all);
  const good = a.faults.length === 0;
  keepTry({ id, at: a.at, kind: 'phrase', sourceId, text: zh, good, summary: a, result });
  remember({ id, at: a.at, kind: 'phrase', sourceId, text: zh, tally: null, good, summary: a, full: true });
  return all;
}

/**
 * The account's tries, every device's, merged with what is on this one: a
 * try said while the history was on its way is kept, not dropped. Null when
 * the server cannot be reached.
 */
export async function mergedAttempts(): Promise<Record<string, Attempt[]> | null> {
  const h = await loadHistory();
  if (!h) return null;
  // What is on the device now, read once the history is here: a try kept meanwhile is in it.
  const now = loadAttempts();
  const all: Record<string, Attempt[]> = Object.fromEntries(Object.entries(h.phrases).map(([zh, list]) => [zh, list.map((x) => x.summary as Attempt)]));
  for (const [zh, list] of Object.entries(now)) {
    const known = new Set((all[zh] ?? []).map((a) => a.at));
    all[zh] = [...(all[zh] ?? []), ...list.filter((a) => !known.has(a.at))].sort((a, b) => a.at - b.at).slice(-5);
  }
  saveAttempts(all);
  return all;
}
