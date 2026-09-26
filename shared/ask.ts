import type { ClaudeState } from './talk';

/**
 * Asking Claude for a piece of work, rather than for a turn in a conversation.
 *
 * The writing session and the word list builder have always ended with the
 * same three steps: copy a prompt, paste it into a Claude chat, bring the
 * answer back. On the iPad that is the only way there is. On the computer the
 * server can already reach Claude through the learner's own subscription —
 * the same headless `claude -p` the conversation uses — and then the copy and
 * the paste are two steps standing between a plan and the thing it asks for.
 *
 * So this is one call: here is the prompt the page would have put on the
 * clipboard, give me back what the chat would have said. Nothing else about
 * the flow changes. The prompt is still shown in full, the answer still lands
 * in the same box and is read by the same parser, and where there is no
 * Claude Code — on Vercel, on the iPad — the button is simply not there and
 * the clipboard route is what is left.
 */

export interface AskStatusResponse {
  claude: { state: ClaudeState };
}

/** What the answer is for. It decides nothing but how long the wait may be. */
export type AskKind = 'passages' | 'wordlist' | 'check' | 'video';
export const ASK_KINDS: readonly AskKind[] = ['passages', 'wordlist', 'check', 'video'];

export interface AskRequest {
  /** the prompt exactly as the page would have copied it */
  prompt: string;
  kind: AskKind;
}

export interface AskAnswer {
  /** everything Claude wrote, as the paste box would have received it */
  text: string;
}

/**
 * A prompt longer than this is not a prompt, it is a mistake. The reading
 * session's is the big one — three thousand characters of inventory and a
 * brief per passage — and it lands around fifteen thousand.
 */
export const ASK_MAX_CHARS = 80_000;

/**
 * How long each kind may take. Writing five graded passages is minutes of
 * work, and the whole point is not to have to watch it: the browser waits as
 * long as the server will.
 */
export const ASK_TIMEOUT_MS: Record<AskKind, number> = {
  passages: 15 * 60_000,
  wordlist: 10 * 60_000,
  // One answer to one question: a reader is sitting there waiting for it.
  check: 3 * 60_000,
  // A study pack for a part of a video: a page of notes, questions and words.
  video: 6 * 60_000,
};
