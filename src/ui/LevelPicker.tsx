import { LEVEL_NAME, LEVELS, type Level } from '../domain/memory';
import { setLevel } from '../store/commands';
import type { ItemId } from '../domain/ids';

/**
 * How well you know it, set by hand in one tap: 0 to 3 as plain digits, the
 * current one pressed and named beside it. What you set holds until review
 * asks about it and your answer takes over: a level to start from, not a final word.
 */
export function LevelPicker({ id, level }: { id: ItemId; level: Level }) {
  return (
    <span className="level-pick">
      <Digits id={id} level={level} />
      <span className="level-pick-name">{LEVEL_NAME[level]}</span>
    </span>
  );
}

/** The same four digits, without the name: for a row in a list of words. */
export function LevelQuick({ id, level }: { id: ItemId; level: Level }) {
  return <Digits id={id} level={level} />;
}

function Digits({ id, level }: { id: ItemId; level: Level }) {
  return (
    <span className="level-digits" role="radiogroup" aria-label="How well you know it, 0 to 3">
      {LEVELS.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={l === level}
          aria-pressed={l === level}
          data-level={l}
          onClick={() => l !== level && setLevel([id], l)}
          title={`${l}: ${LEVEL_NAME[l]}`}
          aria-label={`${l}, ${LEVEL_NAME[l]}`}
        >
          {l}
        </button>
      ))}
    </span>
  );
}
