import { useEffect, useState } from 'react';
import { ensureStrokes } from '../data/load';
import type { Library } from '../data/types';
import { Glyph, useStrokeSteps, type StrokeSteps } from './Glyph';
import { Icon } from './Icon';

/**
 * Stroke order through one character or a whole word: the strokes of the
 * first square, then the next, as it is written. Used by the full-screen view
 * and by copying out, the two places a character is shown big enough to copy
 * stroke by stroke.
 */
export interface StrokeRun {
  steps: StrokeSteps;
  whole: boolean;
  /** strokes drawn in square `i` */
  upto: (i: number) => number;
  /** square `i` holds the stroke just drawn */
  writing: (i: number) => boolean;
  /** square `i` has an outline to draw; without one it is shown in the font */
  drawn: (i: number) => boolean;
}

export function useStrokeRun(lib: Library, glyphs: readonly string[], opts: { keys?: boolean } = {}): StrokeRun {
  // Outlines past HSK 3 arrive on first need; the run is counted again then.
  const [, loaded] = useState(0);
  const key = glyphs.join('');
  useEffect(() => {
    let live = true;
    void ensureStrokes(lib, glyphs).then(() => live && loaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, [lib, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = glyphs.map((g) => lib.strokes[g]?.s.length ?? 0);
  const starts = counts.map((_, i) => counts.slice(0, i).reduce((a, b) => a + b, 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const steps = useStrokeSteps(`${key}:${total}`, total, opts);
  const whole = steps.step >= total;
  return {
    steps,
    whole,
    upto: (i) => Math.max(0, Math.min(counts[i]!, steps.step - starts[i]!)),
    writing: (i) => !whole && steps.step > starts[i]! && steps.step <= starts[i]! + counts[i]!,
    drawn: (i) => counts[i]! > 0,
  };
}

/** One square's character, drawn as far as the run has got. */
export function RunGlyph({ lib, run, i, char }: { lib: Library; run: StrokeRun; i: number; char: string }) {
  if (!run.drawn(i)) return <span className="hanzi run-font">{char}</span>;
  return (
    <Glyph
      char={char}
      strokes={lib.strokes}
      size={480}
      upto={run.upto(i)}
      highlight={run.writing(i) ? 'var(--accent)' : undefined}
      ghost={run.whole ? undefined : 'var(--line)'}
    />
  );
}

/**
 * From the first stroke, back, play, on, the whole — and the count over them,
 * on its own line so the buttons never move as it changes.
 */
export function StrokeButtons({ run, what = 'character' }: { run: StrokeRun; what?: 'character' | 'word' }) {
  const { total, step, playing, go, prev, next, toggle } = run.steps;
  if (!total) return null;
  return (
    <div className="stroke-btns" role="group" aria-label="Stroke order">
      <button className="icon-btn" onClick={() => go(0)} disabled={step === 0} aria-label="From the first stroke">
        <Icon name="prev" size={20} />
      </button>
      <button className="icon-btn" onClick={prev} disabled={step === 0} aria-label="Previous stroke">
        <Icon name="back" size={22} />
      </button>
      <button className="stroke-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play the strokes'}>
        <Icon name={playing ? 'pause' : 'play'} size={22} />
      </button>
      <button className="icon-btn" onClick={next} disabled={run.whole} aria-label="Next stroke">
        <Icon name="chevron" size={22} />
      </button>
      <button className="icon-btn" onClick={() => go(total)} disabled={run.whole} aria-label={`The whole ${what}`}>
        <Icon name="next" size={20} />
      </button>
      <span className="stroke-n small muted" aria-live="polite">
        {run.whole ? `${total} stroke${total === 1 ? '' : 's'}` : `Stroke ${step} of ${total}`}
      </span>
    </div>
  );
}
