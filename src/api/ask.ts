import { ASK_TIMEOUT_MS, type AskAnswer, type AskKind, type AskStatusResponse } from '../../shared/ask';
import { request } from './http';

/**
 * Handing a prompt straight to Claude, where the server can reach it.
 *
 * The clipboard route is still there and still works everywhere; this is the
 * short cut on the machine that has Claude Code signed in to the learner's
 * subscription.
 */

/** Whether the button should be there at all. Asked once a page. */
export function askStatus(): Promise<AskStatusResponse> {
  return request<AskStatusResponse>('GET', '/api/ask');
}

/**
 * The answer to one prompt, in Claude's own words — minutes away, because
 * Claude is writing, so the wait is as long as the server's own.
 */
export function askClaude(prompt: string, kind: AskKind): Promise<AskAnswer> {
  return request<AskAnswer>('POST', '/api/ask', {
    body: { prompt, kind },
    // A minute past the server's own patience: whichever gives up first, the
    // reason shown should be the server's rather than "the request timed out".
    timeoutMs: ASK_TIMEOUT_MS[kind] + 60_000,
  });
}
