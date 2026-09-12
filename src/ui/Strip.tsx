import type { StrokeMap } from '../data/types';
import { Glyph } from './Glyph';

/** A row of characters, as a compact visual fingerprint for a card. */
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
    <div className="strip" aria-hidden>
      {chars.slice(0, max).map((c, i) => (
        <Glyph key={`${c}${i}`} char={c} strokes={strokes} size={size} fit={fit} />
      ))}
      {chars.length > max && <span className="tiny muted">+{chars.length - max}</span>}
    </div>
  );
}
