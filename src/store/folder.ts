/**
 * Optional "save every worksheet into one folder" support.
 *
 * Chrome and Edge on Windows expose the File System Access API, which lets the
 * page keep a handle to a folder the user picked once and write into it on
 * later visits. Where that is unavailable (or the user declines) we fall back
 * to an ordinary download.
 */

const DB = 'hanzi-workshop';
const STORE = 'handles';
const KEY = 'worksheets-dir';

type DirHandle = FileSystemDirectoryHandle;

export const folderSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result as T);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* storage unavailable - folder saving simply stays off */
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* ignore */
  }
}

async function permitted(h: DirHandle, prompt: boolean): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  // @ts-expect-error - not yet in the DOM lib types
  if ((await h.queryPermission(opts)) === 'granted') return true;
  if (!prompt) return false;
  // @ts-expect-error - not yet in the DOM lib types
  return (await h.requestPermission(opts)) === 'granted';
}

/** The remembered folder, if we still hold permission for it. */
export async function getFolder(prompt = false): Promise<DirHandle | null> {
  const h = await idbGet<DirHandle>(KEY);
  if (!h) return null;
  return (await permitted(h, prompt)) ? h : null;
}

export async function getFolderName(): Promise<string | null> {
  const h = await idbGet<DirHandle>(KEY);
  return h ? h.name : null;
}

export async function chooseFolder(): Promise<DirHandle | null> {
  if (!folderSupported()) return null;
  try {
    // @ts-expect-error - not yet in the DOM lib types
    const h: DirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      id: 'hanzi-worksheets',
    });
    await idbSet(KEY, h);
    return h;
  } catch {
    return null; // user cancelled
  }
}

export async function forgetFolder(): Promise<void> {
  await idbDel(KEY);
}

/** Trims a template name down to something safe for a Windows filename. */
export function safeFileName(name: string, ext = 'pdf'): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `${cleaned || 'worksheet'} ${stamp}.${ext}`;
}

/**
 * Writes bytes into the chosen folder. Returns false if there is no folder or
 * the write failed, so the caller can fall back to a download.
 */
export async function saveToFolder(
  fileName: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const dir = await getFolder(true);
  if (!dir) return false;
  try {
    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    // Copy into a plain ArrayBuffer-backed view: the DOM types reject the
    // SharedArrayBuffer-capable Uint8Array that pdf-lib hands back.
    await w.write(new Uint8Array(bytes).slice().buffer as ArrayBuffer);
    await w.close();
    return true;
  } catch {
    return false;
  }
}

export function download(fileName: string, bytes: Uint8Array) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
