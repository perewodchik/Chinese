import { useEffect } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const HINT = 'hanzi-workshop/theme';

function apply(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
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
