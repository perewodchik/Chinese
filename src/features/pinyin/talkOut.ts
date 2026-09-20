import { talkAudio } from '../../api/talk';
import { speak } from '../../platform/speech';
import { hush, playBytes } from './voiceOut';

const SPOKEN = /[㐀-鿿0-9a-z]/i;

/** About as much as anyone says in one breath, and well within what the model keeps one pace across. */
const ONE_CLIP = 50;

/**
 * Claude's turn, as the pieces to make it out of.
 *
 * A turn short enough to say in one breath is one piece, and that matters
 * more than it sounds: asked for a sentence at a time, the model sets each
 * one going from cold, so the pace and the pitch reset in the middle of a
 * turn — and the second piece is still being made while the first finishes,
 * leaving a hole where a speaker would have carried on.
 *
 * A long turn is still cut where a reader would breathe, since waiting for
 * the whole of it before anything is said would be worse.
 */
export function sentences(text: string): string[] {
  const whole = text.trim();
  if (!SPOKEN.test(whole)) return [];
  if ([...whole].length <= ONE_CLIP) return [[...whole].slice(0, 240).join('')];
  return (whole.match(/[^。！？!?；;…\n]+[。！？!?；;…]*[”」』"']?/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => SPOKEN.test(s))
    .map((s) => [...s].slice(0, 240).join(''));
}

function systemSay(text: string, slow: boolean, signal: AbortSignal): Promise<'system' | 'none'> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve('none');
    const ok = speak(text, { rate: slow ? 0.7 : 0.9, onEnd: () => resolve('system') });
    if (!ok) resolve('none');
    signal.addEventListener('abort', () => resolve('none'), { once: true });
  });
}

/**
 * Says one of Claude's turns, to the end, and resolves when it is done — so
 * the page knows when it is the learner's turn again.
 *
 * In a local voice when there is one, a sentence at a time with the next one
 * asked for as soon as the current one starts; the system voice picks up
 * whatever a failing local voice leaves unsaid. `signal` stops it all: the
 * learner starting to talk over it, or leaving the page.
 */
export async function sayTurn(
  text: string,
  voice: string | null,
  opts: { slow?: boolean; signal: AbortSignal; onStart?: () => void },
): Promise<'natural' | 'system' | 'none'> {
  const { signal } = opts;
  const slow = !!opts.slow;
  signal.addEventListener('abort', hush, { once: true });
  if (!voice) {
    opts.onStart?.();
    return systemSay(text, slow, signal);
  }

  const parts = sentences(text);
  const fetchPart = (i: number) => talkAudio(parts[i]!, voice, slow, signal);
  let next = parts.length ? fetchPart(0) : null;
  for (let i = 0; i < parts.length; i++) {
    let bytes: ArrayBuffer;
    try {
      bytes = await next!;
    } catch {
      if (signal.aborted) return 'none';
      opts.onStart?.();
      return systemSay(parts.slice(i).join(''), slow, signal);
    }
    next = i + 1 < parts.length ? fetchPart(i + 1) : null;
    // A clip already asked for, when the learner cuts in, must not be left rejected with nobody listening.
    next?.catch(() => undefined);
    if (signal.aborted) return 'none';
    // The first clip is the one worth announcing: before it there is a wait,
    // and a page saying "speaking" through that wait is simply wrong.
    if (i === 0) opts.onStart?.();
    await playBytes(bytes);
    if (signal.aborted) return 'none';
  }
  return 'natural';
}
