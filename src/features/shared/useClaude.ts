import { useCallback, useEffect, useRef, useState } from 'react';
import type { AskKind } from '../../../shared/ask';
import type { ClaudeState } from '../../../shared/talk';
import { askClaude, askStatus } from '../../api/ask';

/**
 * Whether this server can ask Claude for us, and the asking.
 *
 * The prompt steps were built around a clipboard because the app has no API
 * key and is not going to get one. That has not changed — what changed is
 * that on the home computer the server can already reach Claude through the
 * subscription the learner pays for, the same way the spoken conversation
 * does. Where it can, the copy and the paste are a detour, and this is the
 * way round it.
 *
 * Everywhere else — the iPad, the Vercel site — `ready` is false, no button
 * appears, and the page is exactly what it was.
 */

/** Asked once per page load, not once per prompt screen. */
let known: Promise<ClaudeState> | null = null;
const claudeState = () =>
  (known ??= askStatus()
    .then((s) => s.claude.state)
    .catch((): ClaudeState => 'missing'));

/** A Claude Code that is here but cannot be used, which is worth explaining. */
export type ClaudeTrouble = 'signed-out' | 'api-key';

export interface ClaudeHelp {
  /** true only when a prompt can actually be answered from here */
  ready: boolean;
  /** why it cannot, when it is worth saying: signed out, or signed in with an API key */
  why: ClaudeTrouble | null;
  /** seconds spent waiting on the answer, or null when nothing is being asked */
  waiting: number | null;
  error: string | null;
  ask: (prompt: string, kind: AskKind) => Promise<string | null>;
  cancel: () => void;
}

export function useClaude(): ClaudeHelp {
  const [state, setState] = useState<ClaudeState | null>(null);
  /** when the current question was asked, or null when none is outstanding */
  const [since, setSince] = useState<number | null>(null);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A page left mid-answer must not write into a store it no longer belongs to.
  const live = useRef(true);
  // Which question is the current one. Giving up on an answer, or asking
  // again, moves it on, and the older run's reply is then dropped rather than
  // arriving ten minutes later over the top of something else.
  const run = useRef(0);

  useEffect(() => {
    live.current = true;
    void claudeState().then((s) => live.current && setState(s));
    return () => {
      live.current = false;
    };
  }, []);

  // A minute of silence with nothing moving on screen reads as a hang. The
  // count is the only honest thing to show: nothing reports how far through
  // writing a passage Claude is.
  useEffect(() => {
    if (since === null) {
      setWaiting(null);
      return;
    }
    setWaiting(0);
    const timer = setInterval(() => setWaiting(Math.round((Date.now() - since) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [since]);

  const ask = useCallback(async (prompt: string, kind: AskKind) => {
    const mine = ++run.current;
    setError(null);
    setSince(Date.now());
    try {
      const { text } = await askClaude(prompt, kind);
      return run.current === mine ? text : null;
    } catch (err) {
      if (run.current === mine) {
        setError(err instanceof Error ? err.message : String(err));
        // Signing in, or signing out of an API key, happens in a terminal
        // while this page is open: ask again rather than trusting the answer
        // from before.
        known = null;
        void claudeState().then((s) => live.current && setState(s));
      }
      return null;
    } finally {
      if (live.current && run.current === mine) setSince(null);
    }
  }, []);

  const cancel = useCallback(() => {
    // The run on the server finishes either way — there is no calling a
    // written passage back — but the page stops waiting for it.
    run.current += 1;
    setSince(null);
  }, []);

  return {
    ready: state === 'ready',
    why: state === 'signed-out' || state === 'api-key' ? state : null,
    waiting,
    error,
    ask,
    cancel,
  };
}

/** What to say about a Claude that is there but cannot be used. */
export const CLAUDE_TROUBLE: Record<ClaudeTrouble, string> = {
  'signed-out':
    'Claude Code is on this computer but not signed in. In a terminal: claude auth login — and choose your subscription, not an API key.',
  'api-key':
    'Claude Code here is signed in with an API key, which is billed per word. Sign it in to your subscription instead, and this page can ask it for you.',
};
