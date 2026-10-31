/**
 * A text's finished video, kept on this device (IndexedDB), so More › Video
 * opens it straight away and it can be saved again without making it again.
 * One a text: making it again replaces it.
 *
 * Only here, never synced: a video is tens of megabytes, and it can always be
 * made again from the kept reading. Where the browser keeps nothing (a
 * private window, storage refused) every call quietly does nothing.
 */

export interface KeptVideo {
  textId: string;
  /** a part each; one when it was not cut */
  parts: Blob[];
  duration: number;
  narrator: string;
  at: number;
}

const DB = 'hanzi-videos';
const STORE = 'videos';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'textId' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export const keptVideo = (textId: string) => withStore<KeptVideo | undefined>('readonly', (s) => s.get(textId)).then((v) => v ?? null);
export const keepVideo = (v: KeptVideo) => withStore('readwrite', (s) => s.put(v));
export const forgetVideo = (textId: string) => withStore('readwrite', (s) => s.delete(textId));
