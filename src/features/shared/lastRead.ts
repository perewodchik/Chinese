import type { TextVersion } from '../../navigation/paths';
import { accountKey } from '../../platform/accountStorage';
import { stored } from '../../platform/storage';

/**
 * The text last open on this device, so Read and Today can offer to go back
 * to it — the place a person actually stopped, which is not always the next
 * unread text on a shelf.
 */
export interface LastRead {
  textId: string;
  setId: string | null;
  page: number;
  /** 1-based part number when reading a split chapter in parts; null/omitted for the full chapter */
  part?: number | null;
  version: TextVersion | null;
  at: number;
}

const KEY = 'hanzi.reader.last';

export function rememberReading(last: LastRead) {
  try {
    stored.set(accountKey(KEY), JSON.stringify(last));
  } catch {
    // private browsing: nothing to come back to next time
  }
}

export function lastReading(): LastRead | null {
  try {
    const raw = stored.get(accountKey(KEY));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastRead>;
    return typeof v.textId === 'string' && typeof v.page === 'number'
      ? {
          textId: v.textId,
          setId: typeof v.setId === 'string' ? v.setId : null,
          page: v.page,
          part: typeof v.part === 'number' && Number.isInteger(v.part) && v.part >= 1 ? v.part : null,
          version: v.version === 'easy' || v.version === 'book' ? v.version : null,
          at: typeof v.at === 'number' ? v.at : 0,
        }
      : null;
  } catch {
    return null;
  }
}
