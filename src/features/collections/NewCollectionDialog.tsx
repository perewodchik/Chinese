import { useMemo, useState } from 'react';
import { claimedItems, pagesFor } from '../../domain/collection';
import { countLabel, type ItemId } from '../../domain/ids';
import { glyphOf } from '../../domain/library';
import { suggestedSize, type Preset } from '../../domain/presets';
import { defaultSheet } from '../../domain/sheet';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { Strip } from '../../ui/Strip';
import { useLibrary } from '../shared/library';

interface Props {
  preset: Preset;
  onCancel: () => void;
  onConfirm: (name: string, items: ItemId[]) => void;
}

/** Sizes worth offering for a set this big. */
const choices = (count: number) => [20, 40, 60, 100, 150].filter((n) => n < count);

/**
 * Asked once, when you take a ready-made set: how much of it do you want?
 *
 * This is the question the old app answered by cutting three hundred
 * characters into fifteen templates and leaving you to find your place among
 * them. Answering it here means one collection, the size you asked for, and
 * "add the next forty" later when you have written these.
 */
export function NewCollectionDialog({ preset, onCancel, onConfirm }: Props) {
  const lib = useLibrary();
  const collections = useStore((s) => s.collections);
  const all = useMemo(() => preset.items(lib), [lib, preset]);
  const taken = useMemo(() => claimedItems(collections), [collections]);

  const overlap = useMemo(() => all.filter((i) => taken.has(i)).length, [all, taken]);
  const [skipTaken, setSkipTaken] = useState(overlap > 0);
  const pool = skipTaken ? all.filter((i) => !taken.has(i)) : all;

  const [size, setSize] = useState(() => suggestedSize(all.length));
  const [name, setName] = useState(preset.name);

  const take = Math.min(size, pool.length);
  const items = pool.slice(0, take);
  const perPage = defaultSheet().perPage;

  return (
    <Modal
      title={preset.name}
      subtitle={`${countLabel(all.length)} · ${preset.blurb}`}
      onClose={onCancel}
      onConfirm={() => items.length && onConfirm(name, items)}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" disabled={!items.length} onClick={() => onConfirm(name, items)}>
            Create with {take}
          </button>
        </>
      }
    >
      <Strip chars={items.map((i) => glyphOf(lib, i))} strokes={lib.strokes} size={26} max={12} />

      <label className="field" style={{ marginTop: 12 }}>
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <h3 className="field-title">How many do you want in it?</h3>
      <div className="size-picker">
        {choices(pool.length).map((n) => (
          <button key={n} className="size-option" aria-pressed={size === n} onClick={() => setSize(n)}>
            <b>{n}</b>
            <span>{pagesFor(n, perPage)} pages</span>
          </button>
        ))}
        <button className="size-option" aria-pressed={size >= pool.length} onClick={() => setSize(pool.length)}>
          <b>All {pool.length}</b>
          <span>{pagesFor(pool.length, perPage)} pages</span>
        </button>
      </div>

      {pool.length > 4 && (
        <label className="field" style={{ marginTop: 10 }}>
          <span className="row" style={{ justifyContent: 'space-between' }}>
            <span className="tiny muted">or choose exactly</span>
            <span className="tiny">
              <b>{take}</b> characters
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={pool.length}
            value={take}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
      )}

      {overlap > 0 && (
        <label className="toggle" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={skipTaken} onChange={(e) => setSkipTaken(e.target.checked)} />
          <span>
            Skip what is already in a collection
            <span className="d">{overlap} of these are somewhere else already</span>
          </span>
        </label>
      )}

      <div className="summary">
        <div className="row" style={{ gap: 10 }}>
          <span className="summary-n">{take}</span>
          <span>
            <b>one collection</b>
            <br />
            <span className="tiny muted">
              about {pagesFor(take, perPage)} pages at {perPage} per page — and you can add the next ones
              to it whenever you are ready
            </span>
          </span>
        </div>
      </div>
    </Modal>
  );
}
