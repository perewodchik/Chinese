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

/**
 * For a row in a list of words: one button showing the level, a tap moves it
 * up by one, and from 3 back round to 0. Small enough to sit beside the add
 * button on a phone.
 */
export function LevelQuick({ id, level }: { id: ItemId; level: Level }) {
  const next = ((level + 1) % 4) as Level;
  return (
    <button
      className="level-step"
      data-level={level}
      onClick={() => setLevel([id], next)}
      title={`${level}: ${LEVEL_NAME[level]}. Tap for ${next}: ${LEVEL_NAME[next]}`}
      aria-label={`Level ${level}, ${LEVEL_NAME[level]}. Tap for ${next}, ${LEVEL_NAME[next]}`}
    >
      {level}
    </button>
  );
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
