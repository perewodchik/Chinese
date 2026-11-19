import { useEffect } from 'react';
import { markCatalogReader } from '../api/catalog';
import { accountKey } from '../platform/accountStorage';
import type { AppState } from '../store/state';
import { useStore } from '../store/store';
import { stored } from '../platform/storage';

const SENT = 'hanzi.catalog.finished';

/** The catalogue books with every text read, by catalogue id, as one string so the store's answer compares by value. */
function finishedBooks(s: AppState): string {
  const done: string[] = [];
  for (const set of s.sets) {
    if (!set.catalog) continue;
    const texts = s.texts.filter((t) => t.setId === set.id);
    if (texts.length && texts.every((t) => t.read)) done.push(set.catalog.id);
  }
  return done.sort().join(' ');
}

function sent(): Set<string> {
  try {
    return new Set((stored.get(accountKey(SENT)) ?? '').split(' ').filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * A9: a book from the library read to its last text is said to the server
 * once, so the admin page can say how many finished it. Only the book's id
 * goes; on another device, or with the storage cleared, it is said again,
 * which the server counts once.
 */
export function useCatalogReport(): void {
  const finished = useStore(finishedBooks);
  useEffect(() => {
    if (!finished) return;
    const told = sent();
    for (const id of finished.split(' ')) {
      if (told.has(id)) continue;
      void markCatalogReader(id, true).then(
        () => {
          const now = sent();
          now.add(id);
          try {
            stored.set(accountKey(SENT), [...now].join(' '));
          } catch {
            // said again next time: counted once all the same
          }
        },
        () => undefined,
      );
    }
  }, [finished]);
}
