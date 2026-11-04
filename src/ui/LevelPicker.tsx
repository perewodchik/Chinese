import { LEVEL_NAME, LEVELS, type Level } from '../domain/memory';
import { setLevel } from '../store/commands';
import type { ItemId } from '../domain/ids';

/**
 * How well you know it, set by hand in one tap: four choices, each with its
 * bars, the current one pressed. What you set holds until review asks about it
 * and your answer takes over — a level to start from, not a final word.
 */
export function LevelPicker({ id, level }: { id: ItemId; level: Level }) {
  return (
    <span className="seg level-pick" role="radiogroup" aria-label="How well you know it">
      {LEVELS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={l === level}
          aria-pressed={l === level}
          data-level={l}
          className="level-mark"
          onClick={() => l !== level && setLevel([id], l)}
          title={`${LEVEL_NAME[l]} (${l} of 3)`}
        >
          <span className="level-bars" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="level-name">{LEVEL_NAME[l]}</span>
        </button>
      ))}
    </span>
  );
}

/**
 * The same choice, small enough for a row in a list: four cells of bars, no
 * words, the current one filled. A tap sets the level there and then, without
 * opening the drawer; each cell says its name to a long press and a reader.
 */
export function LevelQuick({ id, level }: { id: ItemId; level: Level }) {
  return (
    <span className="level-quick" role="radiogroup" aria-label="How well you know it">
      {LEVELS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={l === level}
          aria-pressed={l === level}
          data-level={l}
          className="level-mark"
          onClick={() => l !== level && setLevel([id], l)}
          title={`${LEVEL_NAME[l]} (${l} of 3)`}
          aria-label={LEVEL_NAME[l]}
        >
          <span className="level-bars" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </button>
      ))}
    </span>
  );
}
