import { useCallback, useEffect, useState } from 'react';
import { FIT_FLOOR, strokeBounds } from '../data/bounds';
import type { StrokeMap } from '../data/types';

const PALETTE = ['#b8452f', '#2a6673', '#70571f', '#59487a', '#33693f'];

interface Props {
  char: string;
  strokes: StrokeMap;
  size?: number;
  /** show only the first n strokes */
  upto?: number;
  /** tint the final drawn stroke */
  highlight?: string;
  /** draw the strokes not yet reached, faintly, in this colour */
  ghost?: string;
  /** colour strokes by which component they belong to */
  groups?: boolean;
  color?: string;
  className?: string;
  /**
   * Scale the outline to fill the square, wherever in the square it sits.
   *
   * A radical form is stored where it sits inside a real character — 忄
   * narrow on the left, 心 low and wide — which is what a practice square
   * wants and a card does not.
   */
  fit?: boolean;
  /** what to show with no outline, when `char` is a stroke key and not a character */
  fallback?: string;
  /** faint centre lines, so a form drawn in place shows where its place is */
  guide?: boolean;
}

/**
 * Draws a character from its stroke outlines rather than a font, so the shapes
 * on screen are exactly the ones that get printed.
 *
 * The data uses a y-up coordinate system; SVG is y-down, hence the transform.
 */
export function Glyph({
  char,
  strokes,
  size = 44,
  upto,
  highlight,
  ghost,
  groups,
  color = 'currentColor',
  className,
  fit,
  fallback,
  guide,
}: Props) {
  const d = strokes[char];
  if (!d) {
    return (
      <span
        className={className}
        style={{ fontFamily: 'var(--han)', fontSize: size * 0.92, lineHeight: 1 }}
      >
        {fallback ?? char}
      </span>
    );
  }
  const n = upto ?? d.s.length;
  const tint = groups && d.g && new Set(d.g).size > 1 ? d.g : null;

  let viewBox = '0 0 1024 1024';
  if (fit) {
    const b = strokeBounds(d);
    const span = Math.max(b.w, b.h, FIT_FLOOR) * 1.14;
    viewBox = `${b.x + b.w / 2 - span / 2} ${b.y + b.h / 2 - span / 2} ${span} ${span}`;
  }

  return (
    <svg
      className={className}
      viewBox={viewBox}
      width={size}
      height={size}
      role="img"
      aria-label={fallback ?? char}
    >
      {guide && (
        <path
          d="M0 512H1024M512 0V1024M0 0H1024V1024H0Z"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.16}
          strokeWidth={12}
          strokeDasharray="30 24"
        />
      )}
      <g transform="translate(0, 900) scale(1, -1)">
        {ghost && d.s.slice(n).map((p, i) => <path key={`g${i}`} d={p} fill={ghost} />)}
        {d.s.slice(0, n).map((p, i) => (
          <path
            key={i}
            d={p}
            fill={
              highlight && i === n - 1 && !tint
                ? highlight
                : tint
                  ? PALETTE[tint[i] % PALETTE.length]
                  : color
            }
          />
        ))}
      </g>
    </svg>
  );
}

/**
 * Where a stroke-by-stroke walk through a character stands. `step` counts the
 * strokes drawn, so `step === total` is the finished character, which is
 * where it rests until asked to move.
 */
export interface StrokeSteps {
  total: number;
  step: number;
  playing: boolean;
  go: (step: number) => void;
  prev: () => void;
  next: () => void;
  toggle: () => void;
}

export function useStrokeSteps(key: string, total: number): StrokeSteps {
  const [step, setStep] = useState(total);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setStep(total);
    setPlaying(false);
  }, [key, total]);

  useEffect(() => {
    if (!playing) return;
    if (step >= total) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(id);
  }, [playing, step, total]);

  const go = useCallback(
    (s: number) => {
      setPlaying(false);
      setStep(Math.max(0, Math.min(total, s)));
    },
    [total],
  );
  const prev = useCallback(() => go(step - 1), [go, step]);
  const next = useCallback(() => go(step + 1), [go, step]);
  const toggle = useCallback(() => {
    if (playing) return setPlaying(false);
    if (step >= total) setStep(0);
    setPlaying(true);
  }, [playing, step, total]);

  // ← and → walk the strokes, unless a field has the keys.
  useEffect(() => {
    if (!total) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, prev, next]);

  return { total, step, playing, go, prev, next, toggle };
}

/**
 * The finished character, still, with the controls to rebuild it one stroke
 * at a time: back, play, forward. Mid-way, the strokes still to come show
 * faintly so the new one is seen in its place.
 */
export function StrokeStepper({
  steps,
  char,
  strokes,
  size = 104,
  fit,
  fallback,
}: Pick<Props, 'char' | 'strokes' | 'size' | 'fit' | 'fallback'> & { steps: StrokeSteps }) {
  const { total, step, playing, prev, next, toggle } = steps;
  const whole = step >= total;
  return (
    <div className="strokestep">
      <button
        type="button"
        className="strokestep-glyph"
        onClick={whole ? toggle : next}
        aria-label={whole ? 'Play the strokes' : 'Next stroke'}
        disabled={!total}
      >
        <Glyph
          char={char}
          strokes={strokes}
          size={size}
          upto={step}
          highlight={whole ? undefined : 'var(--accent)'}
          ghost={whole ? undefined : 'var(--line)'}
          fit={fit}
          fallback={fallback}
        />
      </button>
      {total > 0 && (
        <div className="strokestep-bar">
          <button type="button" className="btn ghost sm" onClick={prev} disabled={step <= 0} aria-label="Previous stroke">
            ‹
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play the strokes'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button type="button" className="btn ghost sm" onClick={next} disabled={whole} aria-label="Next stroke">
            ›
          </button>
          <span className="strokestep-count tiny muted">
            {step}/{total}
          </span>
        </div>
      )}
    </div>
  );
}
