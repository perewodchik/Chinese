import type { Seal as SealLevel } from '../../domain/play';

/**
 * The red seal a finished game presses onto its card — 印章, the one red stamp
 * the rest of the app's paper already talks about.
 *
 * Three strengths, never a number: faint for half right first time, clear for
 * four in five, and a gold rim for every one. No seal is an outline, so the
 * place where one will go is visible from the start.
 */
export function Seal({ mark, level, size = 56 }: { mark: string; level: SealLevel; size?: number }) {
  return (
    <span
      className="g-seal"
      data-level={level}
      style={{ width: size, height: size, fontSize: size * 0.58 }}
      aria-label={level ? ['', 'faint seal', 'clear seal', 'gold seal'][level] : 'no seal yet'}
    >
      <span className="hanzi">{mark}</span>
    </span>
  );
}
