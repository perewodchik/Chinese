import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Face } from '../../domain/exercises/generate';
import type { Tier } from '../../domain/grading';
import type { ItemId } from '../../domain/ids';
import type { Rating, Skill } from '../../domain/memory';
import { say } from '../../platform/audio/voiceOut';
import { Say } from '../../ui/Say';

/** How one item fared on one card. */
export interface ExerciseResult {
  id: ItemId;
  skill: Skill;
  /** got there in the end */
  ok: boolean;
  /** wrong tries on the way */
  misses: number;
  /** from the card appearing to the answer */
  ms: number;
  tier: Tier;
  weight: number;
  /** set when the learner graded it themselves, or the card knows better than the tier */
  rating?: Rating;
}

/** A key handler for the card on screen, out of the way while something is being typed. */
export function useKeys(handler: (e: KeyboardEvent) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

/** Milliseconds since the card appeared. */
export function useClock() {
  const start = useRef(Date.now());
  return () => Date.now() - start.current;
}

/** A sound to hear, as a big button; plays once on its own when `auto`. */
export function Listen({ text, auto = true, size = 'lg' }: { text: string; auto?: boolean; size?: 'lg' | 'sm' }) {
  useEffect(() => {
    if (auto) void say(text);
  }, [text, auto]);
  return (
    <button type="button" className="ex-listen" data-size={size} onClick={() => void say(text)} aria-label="Play it again">
      <span aria-hidden>🔊</span>
    </button>
  );
}

/** A photo in a box that has its size before the photo arrives. */
export function Photo({ src, size = 'md' }: { src: string; size?: 'md' | 'sm' }) {
  const [ready, setReady] = useState(false);
  return (
    <span className="ex-photo" data-size={size}>
      <img src={src} alt="" draggable={false} data-ready={ready || undefined} onLoad={() => setReady(true)} />
    </span>
  );
}

/** One side of a card: whichever of hanzi, pinyin, English, photo and sound it has. */
export function FaceView({ face, size = 'lg', autoPlay = true }: { face: Face; size?: 'lg' | 'md' | 'sm'; autoPlay?: boolean }) {
  return (
    <div className="ex-face" data-size={size}>
      {face.picture && <Photo src={face.picture} size={size === 'lg' ? 'md' : 'sm'} />}
      {face.audio && !face.hanzi && <Listen text={face.audio} auto={autoPlay} size={size === 'sm' ? 'sm' : 'lg'} />}
      {face.hanzi && (
        <span className="ex-hanzi hanzi" lang="zh-CN" data-len={Math.min(8, [...face.hanzi].length)}>
          {face.hanzi}
        </span>
      )}
      {face.py && <span className="ex-py">{face.py}</span>}
      {face.en && <span className="ex-en">{face.en}</span>}
    </div>
  );
}

export type Verdict = 'right' | 'also' | 'nearly' | 'wrong';

/**
 * The line under a card once it is settled: right or not, the answer with its
 * sound, and Continue. Rendered from the start at the same height, so the
 * card above it never moves.
 */
export function Settle({
  verdict,
  reveal,
  note,
  onNext,
  children,
}: {
  verdict: Verdict | 'retry' | null;
  reveal?: Face;
  note?: ReactNode;
  onNext?: () => void;
  children?: ReactNode;
}) {
  useKeys(
    (e) => {
      if (onNext && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onNext();
      }
    },
    Boolean(onNext && verdict && verdict !== 'retry'),
  );
  return (
    <div className="ex-settle" data-state={verdict ?? undefined} aria-live="polite">
      {verdict === 'retry' && <span className="ex-verdict">Not quite — one more try.</span>}
      {verdict && verdict !== 'retry' && (
        <>
          <span className="ex-verdict">
            {verdict === 'wrong' ? 'The answer' : verdict === 'also' ? 'Also right' : verdict === 'nearly' ? 'Nearly — the tone' : '对 — right'}
          </span>
          {reveal && (
            <span className="ex-reveal">
              {reveal.hanzi && (
                <b className="hanzi" lang="zh-CN">
                  {reveal.hanzi}
                </b>
              )}
              {reveal.py && <i>{reveal.py}</i>}
              {reveal.en && <span>{reveal.en}</span>}
              {reveal.hanzi && <Say text={reveal.hanzi} />}
            </span>
          )}
          {note && <span className="tiny muted">{note}</span>}
          {children}
          {onNext && (
            <button type="button" className="btn primary ex-next" onClick={onNext} autoFocus>
              Continue<span className="key-hint"> — enter</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** A settled card moves on by itself when it was right, after a moment to take in the answer. */
export function useAutoNext(when: boolean, next: () => void, ms = 1100) {
  const ref = useRef(next);
  ref.current = next;
  useEffect(() => {
    if (!when) return;
    const id = window.setTimeout(() => ref.current(), ms);
    return () => window.clearTimeout(id);
  }, [when, ms]);
}
