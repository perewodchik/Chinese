import { LEVEL_NAME, type Level } from '../domain/memory';

/**
 * How well something is known, 0 to 3, as three short bars filled in deeper
 * greens — the same mark wherever a character or a word is shown, so a glance
 * reads the same everywhere. With `label`, its name beside it.
 */
export function LevelMark({ level, label = false }: { level: Level; label?: boolean }) {
  return (
    <span className="level-mark" data-level={level} title={`${LEVEL_NAME[level]} (${level} of 3)`} aria-label={`${LEVEL_NAME[level]}, ${level} of 3`}>
      <span className="level-bars" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {label && <span className="level-name">{LEVEL_NAME[level]}</span>}
    </span>
  );
}

/** Items counted by level as one bar: solid, then known, then met, each its green; the rest bare. */
export function LevelBar({ levels }: { levels: readonly number[] }) {
  const total = Math.max(1, levels.reduce((a, b) => a + b, 0));
  return (
    <span className="level-bar" aria-hidden>
      {[3, 2, 1].map((l) => (levels[l] ? <i key={l} data-level={l} style={{ width: `${(levels[l]! / total) * 100}%` }} /> : null))}
    </span>
  );
}
