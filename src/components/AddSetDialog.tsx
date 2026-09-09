import { useEffect, useMemo, useState } from 'react';
import type { Library } from '../data/types';
import type { Preset } from '../presets';
import { Strip } from './Templates';

interface Props {
  lib: Library;
  preset: Preset;
  onCancel: () => void;
  onConfirm: (perPart: number) => void;
}

/** A split is only worth offering if it actually divides the set up. */
function choices(count: number): number[] {
  return [10, 15, 20, 30, 50].filter((n) => n < count);
}

const PAGES_PER = (perPart: number, perPage: number) =>
  Math.max(1, Math.ceil(perPart / perPage));

/**
 * Asked once, when you add a ready-made set: how big should each template be?
 *
 * The answer differs per set — 20 suits the 300 of an HSK band and is silly for
 * a 26-character topic — so it is a decision made here rather than a single
 * global number applied to everything.
 */
export function AddSetDialog({ lib, preset, onCancel, onConfirm }: Props) {
  const items = useMemo(() => preset.items(lib), [lib, preset]);
  const count = items.length;
  const options = useMemo(() => choices(count), [count]);
  // Small sets default to staying whole; big ones to a sitting-sized chunk.
  const [perPart, setPerPart] = useState(count <= 30 ? count : 20);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm(perPart);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, perPart]);

  const parts = Math.max(1, Math.ceil(count / Math.max(1, perPart)));
  const perPage = preset.kind === 'char' ? 2 : 5;
  const noun = preset.kind === 'char' ? 'characters' : 'radicals';

  const part = (n: number) => `${preset.name} — Part ${n}`;
  const names =
    parts === 1
      ? [preset.name]
      : parts <= 4
        ? Array.from({ length: parts }, (_, i) => part(i + 1))
        : [part(1), part(2), '…', part(parts)];

  return (
    <div className="modal-scrim" onClick={onCancel} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${preset.name}`}
      >
        <header>
          <div style={{ minWidth: 0 }}>
            <h2>{preset.name}</h2>
            <p className="small muted" style={{ margin: '2px 0 0' }}>
              {count} {noun} · {preset.blurb}
            </p>
          </div>
          <button className="btn ghost sm" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <Strip lib={lib} chars={preset.sample(lib)} size={26} max={10} />

          <h3 className="field-title">How big should each template be?</h3>
          <div className="size-picker">
            <button
              className="size-option"
              aria-pressed={perPart >= count}
              onClick={() => setPerPart(count)}
            >
              <b>All {count}</b>
              <span>one template</span>
            </button>
            {options.map((n) => (
              <button
                key={n}
                className="size-option"
                aria-pressed={perPart === n}
                onClick={() => setPerPart(n)}
              >
                <b>{n}</b>
                <span>
                  {Math.ceil(count / n)} templates
                </span>
              </button>
            ))}
          </div>

          {count > 4 && (
            <label className="field" style={{ marginTop: 4 }}>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <span className="tiny muted">or choose exactly</span>
                <span className="tiny">
                  <b>{Math.min(perPart, count)}</b> per template
                </span>
              </span>
              <input
                type="range"
                min={2}
                max={count}
                value={Math.min(perPart, count)}
                onChange={(e) => setPerPart(Number(e.target.value))}
              />
            </label>
          )}

          <div className="summary">
            <div className="row" style={{ gap: 8 }}>
              <span className="summary-n">{parts}</span>
              <span>
                <b>
                  {parts === 1 ? 'template' : 'templates'} of{' '}
                  {parts === 1 ? count : perPart}
                </b>
                <br />
                <span className="tiny muted">
                  about {PAGES_PER(parts === 1 ? count : perPart, perPage)} pages each,
                  {parts > 1 ? ' grouped together in one collection' : ' on its own'}
                </span>
              </span>
            </div>
            <div className="pill-list" style={{ marginTop: 9 }}>
              {names.map((n, i) => (
                <span key={i} className="pill">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        <footer>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onConfirm(perPart)}>
            Add {parts === 1 ? '1 template' : `${parts} templates`}
          </button>
        </footer>
      </div>
    </div>
  );
}
