import { useMemo, useState } from 'react';
import { mainForm } from '../../domain/radicals/forms';
import type { RadicalPreset } from '../../domain/radicals/presets';
import { suggestedRadicalCount } from '../../domain/radicals/presets';
import { radicalCount, radicalPages } from '../../domain/radicals/sets';
import { DEFAULT_RADICAL_SHEET } from '../../domain/radicals/sheet';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { Strip } from '../../ui/Strip';
import { useRadicalLibrary } from './library';

interface Props {
  preset: RadicalPreset;
  onCancel: () => void;
  onConfirm: (name: string, items: number[]) => void;
}

/** Sizes worth offering for a set this big. */
const choices = (count: number) => [10, 20, 30, 50, 100].filter((n) => n < count);

/** Asked once, when you take a ready-made set: how much of it do you want? */
export function NewRadicalSetDialog({ preset, onCancel, onConfirm }: Props) {
  const rlib = useRadicalLibrary();
  const sets = useStore((s) => s.radicals.sets);
  const all = useMemo(() => preset.items(rlib), [rlib, preset]);
  const taken = useMemo(() => new Set(sets.flatMap((s) => s.items)), [sets]);

  const overlap = useMemo(() => all.filter((n) => taken.has(n)).length, [all, taken]);
  const [skipTaken, setSkipTaken] = useState(overlap > 0);
  const pool = skipTaken ? all.filter((n) => !taken.has(n)) : all;

  const [size, setSize] = useState(() => suggestedRadicalCount(all.length));
  const [name, setName] = useState(preset.name);

  const take = Math.min(size, pool.length);
  const items = pool.slice(0, take);
  const perPage = DEFAULT_RADICAL_SHEET.perPage;

  return (
    <Modal
      title={preset.name}
      subtitle={`${radicalCount(all.length)} · ${preset.blurb}`}
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
      <Strip
        chars={items.map((n) => mainForm(rlib.byNumber.get(n)!).k)}
        strokes={rlib.strokes}
        size={26}
        max={12}
        fit
      />

      <label className="field" style={{ marginTop: 12 }}>
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <h3 className="field-title">How many do you want in it?</h3>
      <div className="size-picker">
        {choices(pool.length).map((n) => (
          <button key={n} className="size-option" aria-pressed={size === n} onClick={() => setSize(n)}>
            <b>{n}</b>
            <span>{radicalPages(n, perPage)} pages</span>
          </button>
        ))}
        <button className="size-option" aria-pressed={size >= pool.length} onClick={() => setSize(pool.length)}>
          <b>All {pool.length}</b>
          <span>{radicalPages(pool.length, perPage)} pages</span>
        </button>
      </div>

      {overlap > 0 && (
        <label className="toggle" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={skipTaken} onChange={(e) => setSkipTaken(e.target.checked)} />
          <span>
            Skip what is already in a set
            <span className="d">{overlap} of these are in one already</span>
          </span>
        </label>
      )}
    </Modal>
  );
}
