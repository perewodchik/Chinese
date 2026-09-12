import { useEffect, useState } from 'react';
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

/** The same glyph, drawing itself one stroke at a time then looping. */
export function AnimatedGlyph({ char, strokes, size = 96, fit, fallback, guide }: Props) {
  const total = strokes[char]?.s.length ?? 0;
  const [n, setN] = useState(total);

  useEffect(() => {
    setN(total);
    if (!total) return;
    let step = 0;
    const id = setInterval(() => {
      step = (step + 1) % (total + 6); // pause on the finished character
      setN(Math.min(step, total));
    }, 420);
    return () => clearInterval(id);
  }, [char, total]);

  return (
    <Glyph
      char={char}
      strokes={strokes}
      size={size}
      upto={n}
      highlight="var(--accent)"
      fit={fit}
      fallback={fallback}
      guide={guide}
    />
  );
}
