/**
 * The learner's own recordings, kept on this device so a try looked back on can
 * be heard again, not just read: Mine, and each character's play button.
 *
 * In IndexedDB rather than localStorage: a few seconds of voice is tens of
 * kilobytes, and localStorage's few megabytes are shared with everything else
 * (a full one is what once swallowed tries). As 16-bit samples, the newest
 * KEEP of them; older ones are let go. Nothing here is sent anywhere, and every
 * call fails quietly: a recording that cannot be kept is only not heard later.
 */

const DB = 'hanzi-recordings';
const STORE = 'takes';
const KEEP = 60;

let opened: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  opened ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('at', 'at');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opened;
}

const done = (req: IDBRequest | IDBTransaction) =>
  new Promise<void>((resolve) => {
    if ('oncomplete' in req) {
      req.oncomplete = () => resolve();
      req.onerror = () => resolve();
      req.onabort = () => resolve();
    } else {
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    }
  });

/** Keeps a try's recording under its id, then lets the oldest go past the newest KEEP. */
export async function keepRecording(id: string, samples: Float32Array): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff;
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, at: Date.now(), pcm: pcm.buffer });
    await done(tx);
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const r = d.transaction(STORE).objectStore(STORE).index('at').getAllKeys();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve([]);
    });
    if (keys.length > KEEP) {
      const old = d.transaction(STORE, 'readwrite');
      for (const k of keys.slice(0, keys.length - KEEP)) old.objectStore(STORE).delete(k);
      await done(old);
    }
  } catch {
    // not kept: the try is only not heard again later
  }
}

/** A try's recording as samples, or null when this device does not have it. */
export async function recordingOf(id: string): Promise<Float32Array | null> {
  const d = await db();
  if (!d) return null;
  try {
    const row = await new Promise<{ pcm: ArrayBuffer } | undefined>((resolve) => {
      const r = d.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => resolve(r.result as { pcm: ArrayBuffer } | undefined);
      r.onerror = () => resolve(undefined);
    });
    if (!row) return null;
    const pcm = new Int16Array(row.pcm);
    const out = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i]! / 0x7fff;
    return out;
  } catch {
    return null;
  }
}

/** A try taken back: its recording goes with it. */
export async function forgetRecording(id: string): Promise<void> {
  const d = await db();
  if (!d) return;
  try {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await done(tx);
  } catch {
    // nothing to let go of
  }
}
