import type { AttemptIn, AttemptOut, SpeechHistory } from '../../../shared/speechEval';
import { ApiError } from '../../api/http';
import { deleteAttempt, keepAttempts, listAttempts, speechHistory } from '../../api/speechEval';
import { accountKey } from '../../platform/accountStorage';

/**
 * Every try at saying something, kept in the account so the iPad and the
 * iPhone see the same history: a line in Phrases with its scores and the
 * service's whole answer, a word in a drill with whether it was good.
 *
 * A try goes to an outbox on the device first and is sent from there, so one
 * said without a connection is sent the next time there is one; the server
 * keeps each id once, so sending one twice does no harm. What was kept only on
 * the device before this is sent once, the first time a page asks.
 */

const OUTBOX = 'hanzi.speech.outbox';
const IMPORTED = 'hanzi.speech.imported';
/** on this device: the drills' old tallies have gone to an account */
const TALLIES_TAKEN = 'hanzi.speech.talliesTaken';

const read = <T,>(key: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? empty;
  } catch {
    return empty;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // kept for this visit only
  }
};

export const attemptId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let sending: Promise<void> | null = null;

/** Sends what is waiting, a hundred at a time; what fails waits for the next call. */
export function flush(): Promise<void> {
  if (sending) return sending;
  sending = (async () => {
    try {
      for (;;) {
        const box = read<AttemptIn[]>(accountKey(OUTBOX), []);
        if (!box.length) return;
        const batch = box.slice(0, 100);
        try {
          await keepAttempts(batch);
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400)) throw err;
          // Something in the batch the server will never take (malformed, too large): sent one by one,
          // so only that one is dropped, not the ninety-nine good tries beside it.
          for (const one of batch) {
            try {
              await keepAttempts([one]);
            } catch (e) {
              if (!(e instanceof ApiError && e.status === 400)) throw e;
            }
          }
        }
        const sent = new Set(batch.map((a) => a.id));
        write(accountKey(OUTBOX), read<AttemptIn[]>(accountKey(OUTBOX), []).filter((a) => !sent.has(a.id)));
      }
    } catch {
      // offline, or the server is away: the outbox keeps them
    } finally {
      sending = null;
    }
  })();
  return sending;
}

/** Keeps a try: on the device at once, in the account as soon as it can be sent. */
export function keepTry(a: AttemptIn) {
  write(accountKey(OUTBOX), [...read<AttemptIn[]>(accountKey(OUTBOX), []), a]);
  void flush();
}

/** What was kept only on this device before the account kept it: put in the outbox, once. */
function importOnce() {
  if (read<boolean>(accountKey(IMPORTED), false)) {
    write(TALLIES_TAKEN, true);
    return;
  }
  const items: AttemptIn[] = [];
  const phrases = read<Record<string, Array<{ at: number; faults?: unknown[] }>>>(accountKey('hanzi.phrases.attempts'), {});
  for (const [text, list] of Object.entries(phrases)) {
    for (const a of list) items.push({ id: `local-p-${a.at}-${[...text].slice(0, 30).join('')}`, at: a.at, kind: 'phrase', text, good: !a.faults?.length, summary: a });
  }
  // The drills' tallies sit in a device setting, not an account's: they go to
  // the first account that takes them on this device, and to no other.
  const taken = read<boolean>(TALLIES_TAKEN, false);
  const tallies = taken ? {} : (read<{ tallies?: Record<string, { recent?: number[]; last?: number }> }>('hanzi.pinyin.v1', {}).tallies ?? {});
  for (const [tally, t] of Object.entries(tallies)) {
    const recent = t.recent ?? [];
    const last = t.last ?? Date.now();
    recent.forEach((good, i) =>
      items.push({ id: `local-d-${tally}-${last}-${i}`, at: last - (recent.length - 1 - i) * 1000, kind: 'drill', text: '', tally, good: good === 1 }),
    );
  }
  write(accountKey(OUTBOX), [...read<AttemptIn[]>(accountKey(OUTBOX), []), ...items]);
  write(accountKey(IMPORTED), true);
  write(TALLIES_TAKEN, true);
}

let loading: Promise<SpeechHistory | null> | null = null;

/** The account's history, once what waits on this device has been sent; null when the server cannot be reached. */
export function loadHistory(): Promise<SpeechHistory | null> {
  loading ??= (async () => {
    importOnce();
    await flush();
    try {
      return await speechHistory();
    } catch {
      return null;
    } finally {
      // asked again later, it is fetched again
      setTimeout(() => (loading = null), 0);
    }
  })();
  return loading;
}

const known = new Map<string, Promise<AttemptOut[]>>();

/** The account's tries of a kind, fetched once a visit (what waits here sent first); then kept up to date by `remember`. */
export function knownTries(kind: 'phrase' | 'voice'): Promise<AttemptOut[]> {
  let p = known.get(kind);
  if (!p) {
    p = flush().then(() => listAttempts(kind));
    p.catch(() => known.delete(kind));
    known.set(kind, p);
  }
  return p;
}

/** A try just kept joins what this visit knows, so a line opened again shows it. */
export function remember(a: AttemptOut) {
  const p = known.get(a.kind === 'voice' ? 'voice' : 'phrase');
  if (p) known.set(a.kind === 'voice' ? 'voice' : 'phrase', p.then((list) => [a, ...list.filter((x) => x.id !== a.id)], () => [a]));
}

/** A try taken back: out of what this visit knows, out of the outbox if it never left, and out of the account. */
export async function forget(id: string): Promise<void> {
  for (const [kind, p] of known) known.set(kind, p.then((list) => list.filter((a) => a.id !== id), () => []));
  const box = read<AttemptIn[]>(accountKey(OUTBOX), []);
  if (box.some((a) => a.id === id)) {
    write(accountKey(OUTBOX), box.filter((a) => a.id !== id));
    return;
  }
  await deleteAttempt(id);
}

/** Each line's best total among every try the account keeps, by its text. */
export async function bestByLine(): Promise<Record<string, number>> {
  const best: Record<string, number> = {};
  for (const a of await knownTries('phrase')) {
    const total = (a.summary as { total?: number } | null)?.total;
    if (typeof total === 'number') best[a.text] = Math.max(best[a.text] ?? -1, total);
  }
  return best;
}
