import { hydrate } from './migrations';
import type { AppState } from './state';

/**
 * Work saved in this browser before there were accounts.
 *
 * Until then everything lived in localStorage under one key, per address — so
 * the PC and the iPad each had a copy of their own and neither knew about the
 * other. The first time an account opens in a browser that still has some, that
 * work is brought into the account, and the browser's copy is removed only once
 * the server has confirmed it has it.
 */

const KEY = 'hanzi-workshop/v1';

export interface LegacyWork {
  state: AppState;
  collections: number;
  texts: number;
  /** characters with any review record */
  reviewed: number;
}

/** Set once this page has started moving the work into an account, so nothing offers to do it again. */
let claimed = false;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLegacyWork(): LegacyWork | null {
  if (claimed) return null;
  let raw: string | null;
  try {
    raw = storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;

  let state: AppState;
  try {
    state = hydrate(JSON.parse(raw));
  } catch {
    return null;
  }
  const work: LegacyWork = {
    state,
    collections: state.collections.length,
    texts: state.texts.length,
    reviewed: Object.keys(state.recall).length,
  };
  // Settings on their own are not work anybody would miss.
  const worthKeeping = work.collections || work.texts || work.reviewed || state.sheets.length || state.plan;
  return worthKeeping ? work : null;
}

/** The work, for moving into an account; after this nothing else on the page offers it again. */
export function claimLegacyWork(): LegacyWork | null {
  const work = readLegacyWork();
  if (work) claimed = true;
  return work;
}

export function forgetLegacyWork(): void {
  claimed = true;
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
