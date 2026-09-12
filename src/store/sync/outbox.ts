import { newId } from '../../platform/ids';
import type { Outbox } from './engine';

/**
 * The queue of unsaved changes, kept in localStorage between visits.
 *
 * One entry per tab, keyed by account and by an id minted when the page loads,
 * so two tabs never write over each other's queue. A tab marks its entry
 * closed as the page goes away, and the next page opened for that account
 * claims closed entries straight away — and entries nobody has touched for an
 * hour, from a tab that crashed or a tablet that never came back, as well.
 */

const PREFIX = 'hanzi-workshop/outbox/';
const ABANDONED_MS = 60 * 60 * 1000;

/** This page load. */
const TAB = newId();

interface Entry<A> {
  startedAt: number;
  updatedAt: number;
  closedAt: number | null;
  actions: A[];
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function localOutbox<A>(
  userId: string,
  storage: Storage | null,
  options: { tab?: string; now?: () => number } = {},
): Outbox<A> {
  const now = options.now ?? Date.now;
  const prefix = `${PREFIX}${encodeURIComponent(userId)}/`;
  const mine = `${prefix}${options.tab ?? TAB}`;
  /** whether this tab has an entry out there that another tab could claim */
  let holding = false;
  let startedAt = 0;

  const read = (key: string): Entry<A> | null => {
    try {
      const raw = storage?.getItem(key);
      return raw ? (JSON.parse(raw) as Entry<A>) : null;
    } catch {
      return null;
    }
  };

  const remove = (key: string) => {
    try {
      storage?.removeItem(key);
    } catch {
      /* storage has gone; there is nothing left to remove */
    }
  };

  const put = (entry: Entry<A>): boolean => {
    if (!storage) return false;
    try {
      storage.setItem(mine, JSON.stringify(entry));
      return true;
    } catch {
      // Out of room. An entry left holding an older queue would be replayed
      // later on top of changes already saved; no entry is better than that.
      remove(mine);
      return false;
    }
  };

  const write = (actions: A[]) => {
    if (!actions.length) {
      remove(mine);
      holding = false;
      return;
    }
    const at = now();
    if (!holding) startedAt = at;
    holding = put({ startedAt, updatedAt: at, closedAt: null, actions });
  };

  const touch = (patch: Partial<Entry<A>>) => {
    if (!holding) return;
    const entry = read(mine);
    if (entry) put({ ...entry, ...patch });
  };

  return {
    takeOver() {
      if (!storage) return [];
      const keys: string[] = [];
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key?.startsWith(prefix)) keys.push(key);
        }
      } catch {
        return [];
      }

      const claimed = keys
        .map((key) => ({ key, entry: read(key) }))
        .filter(
          ({ key, entry }) =>
            !entry || key === mine || entry.closedAt !== null || now() - entry.updatedAt > ABANDONED_MS,
        )
        .sort((a, b) => (a.entry?.startedAt ?? 0) - (b.entry?.startedAt ?? 0));
      claimed.forEach(({ key }) => remove(key));
      holding = false;

      const actions = claimed.flatMap(({ entry }) => entry?.actions ?? []);
      write(actions);
      return actions;
    },

    write,

    owns() {
      if (!holding || !storage) return true;
      try {
        return storage.getItem(mine) !== null;
      } catch {
        return true;
      }
    },

    heartbeat: () => touch({ updatedAt: now(), closedAt: null }),

    release: () => touch({ closedAt: now() }),
  };
}
