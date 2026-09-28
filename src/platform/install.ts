import { useEffect, useState } from 'react';

/**
 * Installing the app on the home screen.
 *
 * Where the browser can install it in one tap (Chrome, Edge, Android), it
 * says so once, early, with `beforeinstallprompt`; that event is caught here
 * at start-up, before any page that offers the button has opened, and kept
 * until it is used. Safari has no such event: on an iPhone or iPad the way
 * in is Share → Add to Home Screen, and all a page can do is say so.
 *
 * Nothing is cached for offline use. An installed app still loads the site,
 * so it is never a version behind the last deploy.
 */

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    changed();
  });
}

/** Opened from the home screen, not in a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

/** Safari on an iPhone or iPad, where installing is a manual step. */
export function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but a Mac has no touch screen
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'prompt'; install: () => Promise<boolean> }
  | { kind: 'apple' }
  | { kind: 'unavailable' };

export function useInstall(): InstallState {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isInstalled()) return { kind: 'installed' };
  if (deferred) {
    const d = deferred;
    return {
      kind: 'prompt',
      install: async () => {
        await d.prompt();
        const { outcome } = await d.userChoice;
        deferred = null;
        changed();
        return outcome === 'accepted';
      },
    };
  }
  if (isAppleMobile()) return { kind: 'apple' };
  return { kind: 'unavailable' };
}
