/**
 * The monthly check: the same few sentences, said once a month and kept.
 *
 * Progress in speaking is slow enough to be invisible from one day to the
 * next, and the ear improves along with the mouth, so yesterday always
 * sounds about as good as today. What shows it is the same sentences said
 * months apart and heard back to back. So each month's takes are kept —
 * the recording itself, and whether recognition understood it — and the
 * first month is never thrown away.
 *
 * Kept in this browser's IndexedDB, not in the account: audio is large, and a
 * voice belongs to the microphone that recorded it as much as to the person.
 */

/** Chosen for the spread of what goes wrong: every tone, 3+3, neutral tones, a -n and an -ng, q and x, zh and sh. */
export const BENCHMARK = ['好久不见！', '请问现在几点？', '一共多少钱？', '又便宜又好吃。', '你想吃什么？', '她一边打工一边念书。'];

export interface Take {
  /** `${month}|${sentence}` — one take per sentence per month; saying it again replaces it */
  id: string;
  /** "2026-09" */
  month: string;
  sentence: string;
  at: number;
  /** 16 kHz mono, as recorded */
  samples: Float32Array;
  ok: boolean;
  /** what recognition wrote down */
  heard: string;
}

const DB = 'hanzi-benchmark';
const STORE = 'takes';

export const monthOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthName = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function allTakes(): Promise<Take[]> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).getAll();
      r.onsuccess = () => res((r.result as Take[]).sort((a, b) => a.at - b.at));
      r.onerror = () => rej(r.error);
    });
  } catch {
    return [];
  }
}

/** Saves a take; false where the browser will not keep it (private browsing). */
export async function saveTake(take: Take): Promise<boolean> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(take);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}
