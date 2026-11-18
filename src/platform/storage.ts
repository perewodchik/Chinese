/**
 * The browser's storage, through one door (R10): every read and write of
 * localStorage or sessionStorage outside src/platform comes here.
 *
 * Storage can be missing or refuse: Safari's private windows, a full quota
 * (QuotaExceededError), site data blocked, a preview. Here that is never a
 * throw — a read finds nothing, a write says it did not keep it — so a screen
 * that keeps a convenience (a remembered tab, a speed, an unsent draft) works
 * the same without it. What must be kept for sure belongs in the workspace or
 * on the server, not here.
 *
 * Values that belong to one account go under `accountKey(name)`
 * (accountStorage.ts); a device's own setting under its plain name.
 */

export interface KeptStore {
  get(key: string): string | null;
  /** false when the browser would not keep it */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

function store(of: () => Storage): KeptStore {
  return {
    get(key) {
      try {
        return of().getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        of().setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        of().removeItem(key);
      } catch {
        // nothing kept to take away
      }
    },
  };
}

/** Kept on this device across visits. */
export const stored = store(() => localStorage);
/** Kept in this tab until it is closed. */
export const tabStored = store(() => sessionStorage);

/** A JSON value kept under `key`, or `fallback` when there is none or it does not read. */
export function storedJson<T>(key: string, fallback: T): T {
  const raw = stored.get(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
