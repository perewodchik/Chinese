import { useEffect } from 'react';

const MAX_A_PAGE = 5;
let sent = 0;
const seen = new Set<string>();

/**
 * R15: what broke on the learner's screen, sent so whoever runs the site
 * hears of it: the message and the page, nothing else. Five a page load at
 * most, each message once; a script error from somewhere else (an
 * extension, a cross-site script) is not ours and is left out.
 */
export function reportError(message: string): void {
  const line = message.trim().slice(0, 500);
  if (!line || line === 'Script error.' || seen.has(line) || sent >= MAX_A_PAGE) return;
  seen.add(line);
  sent++;
  void fetch('/api/activity/error', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: line, page: window.location.pathname }),
    keepalive: true,
  }).catch(() => undefined); // nothing more to do if even this does not get through
}

const describe = (v: unknown) => (v instanceof Error ? `${v.name}: ${v.message}` : typeof v === 'string' ? v : 'An error with no message');

/** Listens for errors nobody caught, for as long as a signed-in page is open. */
export function useErrorReport(): void {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ? describe(e.error) : e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError(`Unhandled: ${describe(e.reason)}`);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
}
