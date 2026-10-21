import { useEffect, useRef } from 'react';
import { charId } from '../../domain/ids';
import { useBrowseList, useCharViewer } from '../../navigation/charViewer';
import { useOpenItem } from '../../navigation/itemDrawer';
import { Glyph, useStrokeSteps } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';
import './viewer.css';

/**
 * One character, as big as the screen allows, in a square of the exercise
 * book, with its strokes to step through: from nothing, one back, play, one
 * on, the whole. The order is the point — the square is big enough to copy
 * from, stroke by stroke, into the notebook beside the iPad.
 *
 * Opened from a set, the buttons underneath (and a swipe) go to the
 * characters either side of it in that set, as the set is filtered and
 * ordered.
 */
export function CharViewer() {
  const lib = useLibrary();
  const { char, show, close } = useCharViewer();
  const openItem = useOpenItem();
  const list = useBrowseList();
  const c = char ? lib.byChar.get(char) : undefined;
  const total = char ? (lib.strokes[char]?.s.length ?? 0) : 0;
  const steps = useStrokeSteps(char ?? '', total);
  const { step, playing, go, prev, next, toggle } = steps;
  const whole = step >= total;

  const at = char ? list.indexOf(char) : -1;
  const before = at > 0 ? list[at - 1] : undefined;
  const after = at >= 0 && at < list.length - 1 ? list[at + 1] : undefined;

  // Where a run of key presses has got to: a held ↓ outruns the address,
  // which only changes once the page has caught up.
  const going = useRef<string | null>(null);
  if (going.current === char) going.current = null;
  const step1 = (by: 1 | -1) => {
    const i = list.indexOf(going.current ?? char ?? '');
    const to = i >= 0 ? list[i + by] : undefined;
    if (!to) return;
    going.current = to;
    show(to);
  };

  // ← → are the strokes (useStrokeSteps); ↑ ↓ the characters; space plays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onButton = document.activeElement instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ');
      if (e.key === 'Escape') close();
      else if (onButton) return;
      else if (e.key === ' ') toggle();
      else if (e.key === 'ArrowUp') step1(-1);
      else if (e.key === 'ArrowDown') step1(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A sideways swipe is the next or previous character; a tap on the square, the next stroke.
  const touch = useRef<{ x: number; y: number } | null>(null);

  if (!char) return null;

  return (
    <div className="cv" role="dialog" aria-modal="true" aria-label={`${char}, full screen`}>
      <header className="cv-head">
        <button className="icon-btn" onClick={close} aria-label="Close">
          <Icon name="close" size={22} />
        </button>
        <span className="cv-count small muted">{at >= 0 && list.length > 1 ? `${at + 1} of ${list.length.toLocaleString('en')}` : ''}</span>
        <button className="btn quiet sm" onClick={() => openItem(charId(char))}>
          About it
        </button>
      </header>

      <div
        className="cv-stage"
        onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
        onTouchEnd={(e) => {
          const from = touch.current;
          touch.current = null;
          if (!from) return;
          const dx = e.changedTouches[0]!.clientX - from.x;
          const dy = e.changedTouches[0]!.clientY - from.y;
          if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
          if (dx < 0 && after) show(after);
          if (dx > 0 && before) show(before);
        }}
      >
        <button
          className="cv-sq"
          onClick={whole ? toggle : next}
          aria-label={whole ? 'Play the strokes' : 'Next stroke'}
          disabled={!total}
        >
          <Glyph
            char={char}
            strokes={lib.strokes}
            size={480}
            upto={step}
            highlight={whole ? undefined : 'var(--accent)'}
            ghost={whole ? undefined : 'var(--line)'}
          />
        </button>
      </div>

      <div className="cv-info">
        <span className="cv-py">{c?.py.join(' / ')}</span>
        <Say text={char} />
        <span className="cv-def">{c?.def.split(';').slice(0, 2).join(';')}</span>
      </div>

      {total > 0 && (
        <div className="cv-strokes" role="group" aria-label="Stroke order">
          <button className="icon-btn" onClick={() => go(0)} disabled={step === 0} aria-label="From the first stroke">
            <Icon name="prev" size={20} />
          </button>
          <button className="icon-btn" onClick={prev} disabled={step === 0} aria-label="Previous stroke">
            <Icon name="back" size={22} />
          </button>
          <button className="cv-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play the strokes'}>
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button className="icon-btn" onClick={next} disabled={whole} aria-label="Next stroke">
            <Icon name="chevron" size={22} />
          </button>
          <button className="icon-btn" onClick={() => go(total)} disabled={whole} aria-label="The whole character">
            <Icon name="next" size={20} />
          </button>
          <span className="cv-stroke-n small muted" aria-live="polite">
            {whole ? `${total} stroke${total === 1 ? '' : 's'}` : `Stroke ${step} of ${total}`}
          </span>
        </div>
      )}

      {at >= 0 && list.length > 1 && (
        <nav className="cv-chars" aria-label="Characters">
          <button className="btn" onClick={() => before && show(before)} disabled={!before} aria-label={before ? `Previous: ${before}` : 'Previous'}>
            <Icon name="back" size={18} />
            <span className="hanzi cv-near">{before ?? ''}</span>
          </button>
          <button className="btn" onClick={() => after && show(after)} disabled={!after} aria-label={after ? `Next: ${after}` : 'Next'}>
            <span className="hanzi cv-near">{after ?? ''}</span>
            <Icon name="chevron" size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}
