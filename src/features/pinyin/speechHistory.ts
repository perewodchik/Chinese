import type { AttemptIn, AttemptOut, SpeechHistory } from '../../../shared/speechEval';
import { ApiError, isOffline } from '../../api/http';
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
const write = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // kept for this visit only
    return false;
  }
};

/* ------------------------------------------------------------ the outbox */

// The tries waiting to be sent, held in memory as well as on the device. A full or
// refused localStorage used to swallow a new try without a word: it was never sent,
// and coming back to its line asked the server for a try the server never had.
let held: AttemptIn[] = [];
// Why the last send did not get everything through, in the learner's terms; null once all is sent.
let trouble: string | null = null;
const watchers = new Set<() => void>();
const changed = () => watchers.forEach((f) => f());

/** What waits to be sent: the device's outbox and what this visit holds, each try once. */
function outbox(): AttemptIn[] {
  const stored = read<AttemptIn[]>(accountKey(OUTBOX), []);
  const ids = new Set(stored.map((a) => a.id));
  return [...stored, ...held.filter((a) => !ids.has(a.id))];
}

function setOutbox(items: AttemptIn[]) {
  held = items;
  // Kept on the device when it can be; in memory either way, so this visit still sends it.
  write(accountKey(OUTBOX), items);
  changed();
}

/** The tries not in the account yet. */
export const pendingTries = (): AttemptIn[] => outbox();

/** A try still waiting to be sent, with the service's whole answer: what a line opened again shows. */
export const pendingTry = (id: string): AttemptIn | undefined => outbox().find((a) => a.id === id);

/** Why tries are still waiting, or null when there is nothing wrong (sent, or only just said). */
export const saveTrouble = (): string | null => (outbox().length ? trouble : null);

/** Called when what waits, or why, changes. */
export function watchOutbox(f: () => void): () => void {
  watchers.add(f);
  return () => watchers.delete(f);
}

/**
 * Sends `items` with `send`, a batch at a time; returns the ids the server took
 * (or will never take), and why the rest did not go. One try the server turns
 * down must not hold back the ones behind it, so a refused batch is sent one
 * by one; when there is no connection, or no session, it stops and waits.
 */
export async function sendOutbox(
  items: AttemptIn[],
  send: (batch: AttemptIn[]) => Promise<unknown>,
): Promise<{ done: Set<string>; trouble: string | null }> {
  const done = new Set<string>();
  let why: string | null = null;
  const waitFor = (err: unknown) => isOffline(err) || (err instanceof ApiError && err.status === 401);
  for (let i = 0; i < items.length; i += 100) {
    const batch = items.slice(i, i + 100);
    try {
      await send(batch);
      batch.forEach((a) => done.add(a.id));
      continue;
    } catch (err) {
      if (waitFor(err)) return { done, trouble: troubleOf(err) };
      why = troubleOf(err);
    }
    for (const one of batch) {
      try {
        await send([one]);
        done.add(one.id);
      } catch (err) {
        if (waitFor(err)) return { done, trouble: troubleOf(err) };
        // Something the server will never take (malformed, too large) is let go; anything else waits for the next send.
        if (err instanceof ApiError && err.status === 400) done.add(one.id);
        else why = troubleOf(err);
      }
    }
  }
  return { done, trouble: done.size === items.length ? null : why };
}

function troubleOf(err: unknown): string {
  if (isOffline(err)) return 'No connection: sent when there is one.';
  if (err instanceof ApiError && err.status === 401) return 'Signed out: sent once you sign in.';
  // The site's own trouble, in the learner's words: what the server said is for the console, not the screen.
  if (err instanceof ApiError) console.warn(`Tries not sent: ${err.status} ${err.message}`);
  return 'The site did not take it just now: sent again with your next try, or with Try again.';
}

export const attemptId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let sending: Promise<void> | null = null;

/**
 * Sends what is waiting; what does not go waits for the next call, and
 * `saveTrouble` says why. `send` is the server's, or a test's.
 *
 * The send in progress is cleared in a `.finally` on the promise, never inside
 * it: an outbox found empty ends the work before its first await, and a
 * `finally` inside would run before `sending` was even set, leaving a finished
 * promise there for the rest of the visit, so that no try said afterwards was
 * sent until the page was loaded again.
 */
export function flush(send: (batch: AttemptIn[]) => Promise<unknown> = keepAttempts): Promise<void> {
  if (sending) return sending;
  const run = async () => {
    // Again while tries were said during the send: those go too.
    for (let round = 0; round < 5; round++) {
      const items = outbox();
      if (!items.length) {
        trouble = null;
        return;
      }
      const r = await sendOutbox(items, send);
      trouble = r.trouble;
      setOutbox(outbox().filter((a) => !r.done.has(a.id)));
      if (r.trouble) return;
    }
  };
  sending = run().finally(() => {
    sending = null;
    changed();
  });
  return sending;
}

/** Keeps a try: on the device at once, in the account as soon as it can be sent. */
export function keepTry(a: AttemptIn) {
  setOutbox([...outbox().filter((x) => x.id !== a.id), a]);
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
  setOutbox([...outbox(), ...items]);
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
    // What the account has, and what this device still holds for it: a try that has not
    // gone yet is listed (and opened from the outbox), not lost until it goes.
    const fetched = flush().then(() => listAttempts(kind));
    p = fetched.then(
      (list) => [...waitingOf(kind).filter((w) => !list.some((a) => a.id === w.id)), ...list],
      (err: unknown) => {
        known.delete(kind);
        const w = waitingOf(kind);
        if (w.length) return w;
        throw err;
      },
    );
    known.set(kind, p);
  }
  return p;
}

/** The outbox's tries of a kind, as the account would list them, newest first. */
function waitingOf(kind: 'phrase' | 'voice'): AttemptOut[] {
  return outbox()
    .filter((a) => a.kind === kind)
    .sort((x, y) => y.at - x.at)
    .map((a) => ({ id: a.id, at: a.at, kind: a.kind, sourceId: a.sourceId ?? null, text: a.text, tally: a.tally ?? null, good: a.good, summary: a.summary ?? null, full: Boolean(a.result) }));
}

/** A try just kept joins what this visit knows, so a line opened again shows it. */
export function remember(a: AttemptOut) {
  const p = known.get(a.kind === 'voice' ? 'voice' : 'phrase');
  if (p) known.set(a.kind === 'voice' ? 'voice' : 'phrase', p.then((list) => [a, ...list.filter((x) => x.id !== a.id)], () => [a]));
}

/** A try taken back: out of what this visit knows, out of the outbox if it never left, and out of the account. */
export async function forget(id: string): Promise<void> {
  for (const [kind, p] of known) known.set(kind, p.then((list) => list.filter((a) => a.id !== id), () => []));
  const box = outbox();
  if (box.some((a) => a.id === id)) {
    setOutbox(box.filter((a) => a.id !== id));
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
