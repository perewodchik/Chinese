import { useEffect, useRef } from 'react';
import { chatter, lookFor, mouthOpen, SILENT, SYSTEM_FACE, type Hair, type Look } from './portraits';
import { voiceLevel } from './voiceOut';

/**
 * The face of a voice, drawn and alive.
 *
 * One head, built from the numbers in `portraits.ts`: hair, collar, skin,
 * glasses. Nothing here is a likeness of anybody — the parts are the same
 * parts every time, and what tells Vivian from Serena is which ones are
 * drawn, the way a printer's stamp differs from another printer's stamp.
 *
 * What it does is more important than what it is. It breathes, it blinks, it
 * tilts its head while you are the one talking, it looks up while Claude is
 * writing, and its mouth follows the actual sound coming out of the speaker,
 * sample by sample. Faces are read before words are, so the state of the
 * conversation arrives before the sentence telling you about it does.
 *
 * All of the standing-still motion is CSS, so it costs the page nothing; only
 * the mouth of a face that is speaking runs a frame loop, and only while it
 * speaks.
 */

/** What the face is doing. */
export type Mood = 'idle' | 'listening' | 'thinking' | 'speaking';

/** How big, in the three places a face appears: a turn, the composer, the empty page. */
export type FaceSize = 'sm' | 'md' | 'lg';

/** A face left long enough without live sound is one the page cannot hear: it makes its own shapes. */
const SYNTHETIC_AFTER_MS = 260;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Drives one mouth from the sound actually being played, in `--mouth`.
 *
 * Written straight onto the element rather than held in state: this runs
 * every frame a voice is speaking, and a React render a frame would be sixty
 * renders a second of a page that has a conversation on it.
 */
function useMouth(speaking: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !speaking || reducedMotion()) return;
    let frame = 0;
    const started = performance.now();
    // Once real sound has been heard the mouth follows it and nothing else,
    // so the pause while the next sentence is made is a closed mouth rather
    // than a face mouthing at silence.
    let heard = false;
    const tick = (now: number) => {
      const level = voiceLevel();
      if (level > SILENT) heard = true;
      const open = heard
        ? mouthOpen(level)
        : now - started < SYNTHETIC_AFTER_MS
          ? 0
          : chatter(now - started);
      el.style.setProperty('--mouth', open.toFixed(2));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.style.removeProperty('--mouth');
    };
  }, [speaking]);
  return ref;
}

/** Hair that falls behind the head, drawn before the face. */
const BEHIND: Partial<Record<Hair, string>> = {
  long: 'M25 46c-1-28 11-34 23-34s24 6 23 34c0 16-1 28-3 34-2-8-2-22-3-34-1-10-5-16-17-16s-16 6-17 16c-1 12-1 26-3 34-2-6-3-18-3-34Z',
  bob: 'M26 46c-1-26 10-33 22-33s23 7 22 33c0 10-1 16-3 19 1-11 0-23-2-30-5-4-29-4-34 0-2 7-3 19-2 30-2-3-3-9-3-19Z',
  wave: 'M26 46c-1-26 10-33 22-33s23 7 22 33c0 12 2 20-2 24-4-4-2-14-3-24-1-10-5-16-17-16s-16 6-17 16c-1 10 1 20-3 24-4-4-2-12-2-24Z',
  bun: 'M48 6a9 9 0 0 1 0 18 9 9 0 0 1 0-18Z',
};

/** Hair over the crown: the hairline, which is most of what tells one head from another. */
const FRONT: Record<Hair, string> = {
  long: 'M30 41c0-18 7-25 18-25s18 7 18 25c-1-9-5-15-18-15s-17 6-18 15Z',
  bob: 'M30 42c0-19 8-26 18-26s18 7 18 26c-1-10-5-15-18-15s-17 5-18 15Z',
  wave: 'M30 42c0-19 8-26 18-26s18 7 18 26c-1-10-6-16-13-15-5 1-8 4-14 4-5 0-8 2-9 11Z',
  bun: 'M29 44c-1-22 8-28 19-28s20 6 19 28c-1-11-5-17-19-17s-18 6-19 17Z',
  crop: 'M29 44c-1-21 8-27 19-27s20 6 19 27c-1-9-5-16-19-16s-18 7-19 16Z',
  part: 'M29 43c-1-21 8-27 19-27s20 6 19 27c-1-9-4-14-12-15-5 4-14 6-22 5-2 2-3 5-4 10Z',
};

/**
 * One face. `still` stops the idle motion for the faces further up a
 * conversation: a thread of ten breathing portraits is a lot of movement for
 * an iPad, and only the one being talked to needs to be alive.
 */
export function Portrait({
  voice,
  gender,
  mood = 'idle',
  size = 'md',
  still,
}: {
  voice: string;
  gender?: 'female' | 'male';
  mood?: Mood;
  size?: FaceSize;
  still?: boolean;
}) {
  const ref = useMouth(mood === 'speaking');
  const machine = voice === SYSTEM_FACE;
  const face = lookFor(voice, gender);
  return (
    <span
      ref={ref}
      className="portrait"
      data-state={mood}
      data-size={size}
      data-still={still || undefined}
      data-cloth={machine ? undefined : face.cloth}
      data-skin={machine ? undefined : face.skin}
      data-machine={machine || undefined}
      style={{ ['--beat' as string]: `-${face.beat}s` }}
      aria-hidden
    >
      <span className="pt-clip">
        <svg className="pt" viewBox="0 0 96 96" focusable="false">
          {machine ? <Machine /> : <Head look={face} />}
          <g className="pt-think">
            <circle cx="68.5" cy="27" r="3" />
            <circle cx="74.5" cy="21" r="2.2" />
            <circle cx="78.8" cy="16.6" r="1.5" />
          </g>
        </svg>
      </span>
    </span>
  );
}

function Head({ look }: { look: Look }) {
  return (
    <g className="pt-body">
      <path className="pt-cloth" d="M10 96c2-15 17-24 38-24s36 9 38 24Z" />
      <path className="pt-collar" d="M40 73l8 9 8-9" />
      <path className="pt-skin pt-neck" d="M41 55h14v14q-7 4-14 0Z" />
      <g className="pt-head">
        {BEHIND[look.hair] && <path className="pt-hair" d={BEHIND[look.hair]} />}
        <ellipse className="pt-ear" cx="29.4" cy="45" rx="3.4" ry="4.8" />
        <ellipse className="pt-ear" cx="66.6" cy="45" rx="3.4" ry="4.8" />
        <ellipse className="pt-skin pt-face" cx="48" cy="43" rx="18.6" ry="21.4" />
        <path className="pt-hair" d={FRONT[look.hair]} />
        <g className="pt-brows">
          <path d="M36.8 36.6q4-2.4 8-0.4" />
          <path d="M51.2 36.2q4-2 8 0.4" />
        </g>
        <g className="pt-eyes">
          <ellipse className="pt-white" cx="40.4" cy="44" rx="4.4" ry="3.1" />
          <ellipse className="pt-white" cx="55.6" cy="44" rx="4.4" ry="3.1" />
          <g className="pt-iris">
            <circle cx="40.4" cy="44" r="2.2" />
            <circle cx="55.6" cy="44" r="2.2" />
          </g>
          <g className="pt-glint">
            <circle cx="41.4" cy="43" r="0.8" />
            <circle cx="56.6" cy="43" r="0.8" />
          </g>
        </g>
        <path className="pt-nose" d="M48 45.5v5.2q0 1.6 2 1.8" />
        <g className="pt-mouth-g">
          <path className="pt-lip" d="M42.6 55.6q5.4 3 10.8 0" />
          <ellipse className="pt-mouth" cx="48" cy="56.4" rx="5.4" ry="4.4" />
        </g>
        {look.glasses && (
          <g className="pt-glasses">
            <rect x="33.6" y="39.4" width="13.6" height="9.6" rx="4.4" />
            <rect x="48.8" y="39.4" width="13.6" height="9.6" rx="4.4" />
            <path d="M47.2 44h1.6" />
            <path d="M33.6 43h-4" />
            <path d="M62.4 43h4" />
          </g>
        )}
        {look.earrings && (
          <g className="pt-earring">
            <circle cx="29.4" cy="51.4" r="1.7" />
            <circle cx="66.6" cy="51.4" r="1.7" />
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * The system voice, which is not a person and is not drawn as one: a little
 * machine with a bar for a mouth. It moves with the same states the faces do,
 * so the page behaves the same whichever voice is reading — it is simply
 * honest about which one it is.
 */
function Machine() {
  return (
    <g className="pt-body">
      <path className="pt-cloth" d="M10 96c2-15 17-24 38-24s36 9 38 24Z" />
      <path className="pt-neck pt-machine-neck" d="M43 58h10v14H43Z" />
      <g className="pt-head">
        <path className="pt-machine-aerial" d="M48 18v-7" />
        <circle className="pt-machine-bulb" cx="48" cy="9" r="2.6" />
        <rect className="pt-machine" x="25" y="18" width="46" height="42" rx="13" />
        <g className="pt-eyes">
          <g className="pt-iris">
            <circle cx="39" cy="36" r="3.4" />
            <circle cx="57" cy="36" r="3.4" />
          </g>
        </g>
        <g className="pt-mouth-g">
          <rect className="pt-mouth pt-machine-mouth" x="39" y="45" width="18" height="8" rx="4" />
        </g>
      </g>
    </g>
  );
}

/**
 * The learner, on the other side of the thread: no face, because the app has
 * never seen you — the character for "I" on a quiet disc, so both sides of
 * the conversation are somebody.
 */
export function SelfMark({ size = 'sm' }: { size?: FaceSize }) {
  return (
    <span className="portrait portrait-self" data-size={size} aria-hidden>
      <span className="hanzi" lang="zh-CN">
        我
      </span>
    </span>
  );
}
