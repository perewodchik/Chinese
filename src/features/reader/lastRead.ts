import type { TextVersion } from '../../navigation/paths';

/**
 * The text last open on this device, so Read and Today can offer to go back
 * to it — the place a person actually stopped, which is not always the next
 * unread text on a shelf.
 */
export interface LastRead {
  textId: string;
  setId: string | null;
  page: number;
  version: TextVersion | null;
  at: number;
}

const KEY = 'hanzi.reader.last';

export function rememberReading(last: LastRead) {
  try {
    localStorage.setItem(KEY, JSON.stringify(last));
  } catch {
    // private browsing: nothing to come back to next time
  }
}

export function lastReading(): LastRead | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastRead>;
    return typeof v.textId === 'string' && typeof v.page === 'number'
      ? {
          textId: v.textId,
          setId: typeof v.setId === 'string' ? v.setId : null,
          page: v.page,
          version: v.version === 'easy' || v.version === 'book' ? v.version : null,
          at: typeof v.at === 'number' ? v.at : 0,
        }
      : null;
  } catch {
    return null;
  }
}
