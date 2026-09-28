/**
 * The device's own copy of the save, so the game opens offline and a closed
 * tab loses nothing. One key per account; every access is wrapped, because
 * storage can be full, blocked or missing (private windows).
 */

export interface LocalCopy {
  /** the save as the game last had it (raw JSON: read through migrate.ts) */
  save: unknown;
  /** the server revision it was built on; 0 before the first save reached the server */
  revision: number;
  /** changed here since the server last took it */
  dirty: boolean;
}

export interface LocalStore {
  read(): LocalCopy | null;
  write(copy: LocalCopy): void;
}

export const localKey = (userId: string) => `zouzou:save:${userId}`;

export function browserLocal(userId: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): LocalStore {
  const key = localKey(userId);
  return {
    read() {
      try {
        const raw = storage?.getItem(key);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<LocalCopy>;
        if (!v || typeof v !== 'object' || typeof v.revision !== 'number') return null;
        return { save: v.save, revision: v.revision, dirty: !!v.dirty };
      } catch {
        return null;
      }
    },
    write(copy) {
      try {
        storage?.setItem(key, JSON.stringify(copy));
      } catch {
        // Full or blocked: the server copy is still the one that counts.
      }
    },
  };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** A store in memory, for tests and for when there is no storage at all. */
export function memoryLocal(initial: LocalCopy | null = null): LocalStore & { copy: LocalCopy | null } {
  const store = {
    copy: initial,
    read: () => store.copy,
    write: (c: LocalCopy) => {
      store.copy = JSON.parse(JSON.stringify(c)) as LocalCopy;
    },
  };
  return store;
}
