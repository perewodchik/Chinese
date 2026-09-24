import type { StrokeMap } from '../data/types';
import { Glyph } from './Glyph';

/** A row of characters — or of words — as a compact visual fingerprint for a card. */
export function Strip({
  chars,
  strokes,
  size = 21,
  max = 9,
  fit,
}: {
  chars: string[];
  strokes: StrokeMap;
  size?: number;
  max?: number;
  /** scale each outline to its own extent: radical forms are stored in place */
  fit?: boolean;
}) {
  return (
    // A strip of words needs room between them, or 我们 没有 reads as 我们没有.
    <div className="strip" aria-hidden data-words={chars.some((c) => [...c].length > 1) || undefined}>
      {chars.slice(0, max).map((c, i) => (
        <Glyph key={`${c}${i}`} char={c} strokes={strokes} size={size} fit={fit} />
      ))}
      {chars.length > max && <span className="tiny muted">+{chars.length - max}</span>}
    </div>
  );
}
