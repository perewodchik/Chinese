import { useEffect } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const HINT = 'hanzi-workshop/theme';

/**
 * A page's own colour, over the app's: the text page in Sepia or Night. It
 * holds while that page is open and gives the app its own theme back after.
 */
export type PageColour = 'sepia' | 'night';

let current: ThemeChoice = 'system';
let page: PageColour | null = null;

/** The status bar's colour on iOS for a page colour: the page's own paper. */
const PAGE_BAR: Record<PageColour, string> = { sepia: '#f4ecd8', night: '#14191e' };

function apply(choice: ThemeChoice) {
  current = choice;
  const root = document.documentElement;
  // The app's own theme under the page's: Aa's Paper tile shows the page Paper would give.
  const appDark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.appTheme = appDark ? 'dark' : 'light';
  root.dataset.theme = page === 'night' || (page !== 'sepia' && appDark) ? 'dark' : 'light';
  if (page === 'sepia') root.dataset.paper = 'sepia';
  else delete root.dataset.paper;
  // Safari tints its bars from the first theme-color that matches; a page colour goes before the two by scheme.
  let meta = document.getElementById('page-theme-color') as HTMLMetaElement | null;
  if (page) {
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = 'page-theme-color';
      meta.name = 'theme-color';
      document.head.prepend(meta);
    }
    meta.content = PAGE_BAR[page];
  } else meta?.remove();
}

/** Puts a page colour on, or takes it off with null. */
export function setPageColour(colour: PageColour | null) {
  if (colour === page) return;
  page = colour;
  apply(current);
}

/**
 * The theme from the last visit, applied before anything renders.
 *
 * The real choice belongs to the account and arrives with the workspace, a
 * moment after the page does. Remembering it in the browser as well is what
 * spares a dark-mode reader a white flash while the sign-in check runs.
 */
export function applyRememberedTheme() {
  let choice: ThemeChoice = 'system';
  try {
    const stored = localStorage.getItem(HINT);
    if (stored === 'light' || stored === 'dark') choice = stored;
  } catch {
    /* no storage: follow the system */
  }
  apply(choice);
}

export function useColorScheme(choice: ThemeChoice) {
  useEffect(() => {
    apply(choice);
    try {
      localStorage.setItem(HINT, choice);
    } catch {
      /* the hint is only a nicety */
    }
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => apply('system');
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, [choice]);
}
