import { personaOf } from '../../../shared/personas';
import type { TalkMode } from '../../../shared/talk';
import { talkAudio } from '../../api/talk';
import { speak } from '../../platform/speech';
import { hush, playBytes, playBytesAtPace } from '../../platform/audio/voiceOut';

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

/**
 * How slowly a turn is read, and what the system voice does about it.
 *
 * The page asks for one reading — the one a person would actually say — and
 * slows it on the way out when the learner wants it slower. It used to offer
 * four readings to choose between, on the argument that a slow mode should be
 * a different reading and not a recording dragged. That is true of a model
 * that obliges, and this one obliges when it feels like it; a beginner who
 * cannot follow a turn needs the next one slower, not a reading philosophy.
 *
 * Slowing happens through an audio element, which stretches the time and
 * leaves the pitch where it was. That is not a nicety here: resampling drops
 * the voice with the speed, and a sentence whose tones have all moved down is
 * not the same sentence said slowly.
 *
 * The system voice has no recording to stretch, so it is asked to read slowly
 * instead, which is the one thing it does well.
 */
const NATIVE_PACE = 1;

/** What the system voice is asked for, since it cannot be slowed after the fact. */
function systemRate(pace: number): number {
  // Its own scale is coarser than a playback rate; this keeps a `pace` of 0.65
  // sounding like the deliberate reading the number is asking for.
  return Math.max(0.4, Math.min(1.2, pace * 0.85));
}

function systemSay(text: string, pace: number, signal: AbortSignal): Promise<'system' | 'none'> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve('none');
    const ok = speak(text, { rate: systemRate(pace), onEnd: () => resolve('system') });
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
  opts: { pace?: number; signal: AbortSignal; onStart?: () => void },
): Promise<'natural' | 'system' | 'none'> {
  const { signal } = opts;
  // A partner who talks slowly (Chen) is slowed on top of whatever the
  // learner asked for: his pace is part of who he is, not a setting.
  const pace = (opts.pace ?? NATIVE_PACE) * (personaOf(voice)?.pace ?? 1);
  // One reading is made whatever pace it will be heard at, so asking for the
  // same turn slowly is the clip already fetched rather than a second wait.
  const mode: TalkMode = 'conversation';
  signal.addEventListener('abort', hush, { once: true });
  if (!voice) {
    opts.onStart?.();
    return systemSay(text, pace, signal);
  }

  const parts = sentences(text);
  const fetchPart = (i: number) => talkAudio(parts[i]!, voice, mode, signal);
  let next = parts.length ? fetchPart(0) : null;
  for (let i = 0; i < parts.length; i++) {
    let bytes: ArrayBuffer;
    try {
      bytes = await next!;
    } catch {
      if (signal.aborted) return 'none';
      opts.onStart?.();
      return systemSay(parts.slice(i).join(''), pace, signal);
    }
    next = i + 1 < parts.length ? fetchPart(i + 1) : null;
    // A clip already asked for, when the learner cuts in, must not be left rejected with nobody listening.
    next?.catch(() => undefined);
    if (signal.aborted) return 'none';
    // The first clip is the one worth announcing: before it there is a wait,
    // and a page saying "speaking" through that wait is simply wrong.
    if (i === 0) opts.onStart?.();
    await (pace === 1 ? playBytes(bytes) : playBytesAtPace(bytes, pace));
    if (signal.aborted) return 'none';
  }
  return 'natural';
}
