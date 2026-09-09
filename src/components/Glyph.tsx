import { useEffect, useState } from 'react';
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
}: Props) {
  const d = strokes[char];
  if (!d) {
    return (
      <span
        className={className}
        style={{ fontFamily: 'var(--han)', fontSize: size * 0.92, lineHeight: 1 }}
      >
        {char}
      </span>
    );
  }
  const n = upto ?? d.s.length;
  const tint = groups && d.g && new Set(d.g).size > 1 ? d.g : null;

  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      role="img"
      aria-label={char}
    >
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
export function AnimatedGlyph({ char, strokes, size = 96 }: Props) {
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

  return <Glyph char={char} strokes={strokes} size={size} upto={n} highlight="var(--accent)" />;
}
