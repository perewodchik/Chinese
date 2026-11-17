import { useEffect } from 'react';
import type { DayReport } from '../../shared/activity';
import { dayKey } from '../domain/activity';
import { getState } from '../store/store';

const EVERY_MS = 5 * 60_000;

/** The day so far as the store counts it: how much, never what (A7). */
function today(): DayReport {
  const day = dayKey(Date.now());
  const log = getState().activity[day];
  return {
    day,
    minutes: Math.round((log?.ms ?? 0) / 60_000),
    textsRead: log?.read ?? 0,
    answers: log?.answers ?? 0,
    spoken: log?.spoken ?? 0,
    videos: log?.videos ?? 0,
  };
}

/**
 * A7: the learner's day sent to the server in numbers every few minutes and
 * as the page goes away — only when they changed, and only once something
 * was done — so the admin page can say whether the site is used. Nothing of
 * what was read or said goes with it.
 */
export function useActivityReport(): void {
  useEffect(() => {
    let sent = '';
    const send = (leaving: boolean) => {
      const r = today();
      const key = JSON.stringify(r);
      if (key === sent || (!r.minutes && !r.textsRead && !r.answers && !r.spoken && !r.videos)) return;
      sent = key;
      void fetch('/api/activity', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: key,
        keepalive: leaving,
      }).catch(() => {
        // Not reached: tried again with the next report, which carries the whole day.
        sent = '';
      });
    };
    const timer = setInterval(() => send(false), EVERY_MS);
    const hide = () => document.visibilityState === 'hidden' && send(true);
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
}
