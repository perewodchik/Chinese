import type { ReactNode } from 'react';
import type { Rounds } from './useRounds';

/**
 * Big answer tiles: two to six, with a picture, a character, or both.
 *
 * Children-sized — a tile is never smaller than a thumb — and keyboard-able:
 * digits pick. A wrong pick stays marked through the second try; when a
 * prompt is settled the right tile is shown whether or not it was picked.
 */
export interface TileOption {
  id: string;
  body: ReactNode;
  /** read out to screen readers, and used as the title */
  label: string;
}

export function Tiles({
  options,
  right,
  picked,
  r,
  onPick,
  size = 'md',
}: {
  options: TileOption[];
  right: string;
  picked: string[];
  r: Rounds<unknown>;
  onPick: (id: string) => void;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="g-tiles" data-size={size} data-n={options.length} role="group">
      {options.map((o, i) => {
        const state =
          r.done && o.id === right ? 'right' : picked.includes(o.id) && o.id !== right ? 'wrong' : undefined;
        return (
          <button
            key={o.id}
            type="button"
            className="g-tile"
            data-state={state}
            data-dim={r.done && o.id !== right ? true : undefined}
            disabled={r.done || (picked.includes(o.id) && o.id !== right)}
            aria-label={o.label}
            title={o.label}
            onClick={() => onPick(o.id)}
          >
            {o.body}
            <span className="key-hint g-key">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
