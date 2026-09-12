import { useMemo, useState } from 'react';
import { mainForm, searchScore } from '../../domain/radicals/forms';
import { isKnown, radicalCount, type RadicalSet } from '../../domain/radicals/sets';
import { useOpenRadical } from '../../navigation/radicalDrawer';
import { addRadicals, removeRadicals, reorderRadicals, setKnown } from '../../store/radicals';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { useToast } from '../../ui/toast';
import { useGridReorder } from '../../ui/useGridReorder';
import { useRangeSelection } from '../../ui/useRangeSelection';
import { useRadicalLibrary } from './library';

const LIMIT = 18;

/** What is in a set, as the same cards the browser uses, in the order they print. */
export function RadicalBoard({ set }: { set: RadicalSet }) {
  const rlib = useRadicalLibrary();
  const toast = useToast();
  const openRadical = useOpenRadical();
  const known = useStore((s) => s.radicals.known);
  const picked = useRangeSelection(set.items);
  const [q, setQ] = useState('');

  const reorder = useGridReorder(set.items.length, (from, to) => {
    const next = [...set.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderRadicals(set.id, next);
  });

  const inside = useMemo(() => new Set(set.items), [set.items]);
  const results = useMemo(() => {
    const needle = q.trim();
    if (!needle) return [];
    return rlib.radicals
      .map((r) => ({ r, score: searchScore(r, needle) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => a.score - b.score || a.r.rank - b.r.rank)
      .slice(0, LIMIT)
      .map(({ r }) => r);
  }, [q, rlib]);

  const allKnown = set.items.length > 0 && set.items.every((n) => isKnown(known, n));

  return (
    <div>
      <div className="add-search">
        <div className="row" style={{ gap: 8 }}>
          <input
            type="search"
            className="grow"
            value={q}
            aria-label="Add a radical"
            placeholder="Add a radical — search 氵, shui, water, 三点水…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) addRadicals(set.id, [results[0].n]);
              if (e.key === 'Escape') setQ('');
            }}
          />
          {q && (
            <button className="btn ghost sm" onClick={() => setQ('')}>
              Clear
            </button>
          )}
        </div>

        {q.trim() !== '' && (
          <div className="results">
            {results.length === 0 ? (
              <p className="small muted" style={{ margin: '10px 2px' }}>
                Nothing in the 214 radicals matches “{q.trim()}”.
              </p>
            ) : (
              <div className="grid results-grid">
                {results.map((r) => (
                  <ItemCard
                    key={r.n}
                    glyph={mainForm(r).k}
                    fit
                    fallback={mainForm(r).g}
                    py={r.py}
                    gloss={r.mean}
                    strokes={rlib.strokes}
                    size={38}
                    index={inside.has(r.n) ? '✓' : undefined}
                    selected={inside.has(r.n)}
                    title={
                      inside.has(r.n) ? 'Already in this set — click to take it out' : 'Click to add'
                    }
                    onClick={() =>
                      inside.has(r.n) ? removeRadicals(set.id, [r.n]) : addRadicals(set.id, [r.n])
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="row board-bar">
        <button
          className="btn sm"
          onClick={() =>
            reorderRadicals(
              set.id,
              [...set.items].sort(
                (a, b) => (rlib.byNumber.get(a)?.rank ?? 999) - (rlib.byNumber.get(b)?.rank ?? 999),
              ),
            )
          }
          disabled={set.items.length < 2}
          title="Back into the order they are worth learning in"
        >
          Sort
        </button>
        <span className="tiny muted grow">
          {picked.selected.size
            ? `${picked.selected.size} selected`
            : set.items.length
              ? 'drag a card to move it · shift-click for a run'
              : ''}
        </span>
        {picked.selected.size > 0 && (
          <>
            <button
              className="btn sm"
              onClick={() => {
                setKnown([...picked.selected], true);
                toast(`Marked ${picked.selected.size} as known`);
                picked.clear();
              }}
            >
              Mark known
            </button>
            <button
              className="btn sm"
              onClick={() => {
                setKnown([...picked.selected], false);
                picked.clear();
              }}
            >
              Unmark
            </button>
            <button
              className="btn danger sm"
              onClick={() => {
                removeRadicals(set.id, [...picked.selected]);
                toast(`Removed ${picked.selected.size}`);
                picked.clear();
              }}
            >
              Remove
            </button>
            <button className="btn ghost sm" onClick={picked.clear}>
              Clear
            </button>
          </>
        )}
        {!picked.selected.size && set.items.length > 0 && (
          <button className="btn ghost sm" onClick={() => picked.selectAll(set.items)}>
            Select all
          </button>
        )}
      </div>

      {set.items.length === 0 ? (
        <div className="empty">
          <span className="big">空</span>
          <p>
            Nothing in this set yet. Search above for what you want in it, or pick a run in All
            radicals and add them from there.
          </p>
        </div>
      ) : (
        <div
          className="grid board"
          data-dragging={reorder.dragging || undefined}
          ref={reorder.containerRef}
        >
          {set.items.map((n, i) => {
            const r = rlib.byNumber.get(n);
            if (!r) return null;
            return (
              <ItemCard
                key={n}
                glyph={mainForm(r).k}
                fit
                fallback={mainForm(r).g}
                py={r.py}
                gloss={r.mean}
                strokes={rlib.strokes}
                index={i + 1}
                learned={isKnown(known, n)}
                selected={picked.selected.has(n)}
                onClick={(shift) => {
                  if (reorder.consumeClick()) return;
                  picked.toggle(n, shift);
                }}
                onOpen={() => openRadical(n)}
                onRemove={() => removeRadicals(set.id, [n])}
                {...reorder.handlers(i)}
              />
            );
          })}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <span className="tiny muted grow">
          {radicalCount(set.items.length)} ·{' '}
          {set.items.filter((n) => isKnown(known, n)).length} known
        </span>
        <button
          className="btn sm"
          disabled={!set.items.length}
          onClick={() => {
            setKnown(set.items, !allKnown);
            toast(allKnown ? 'Unmarked everything' : `Marked all ${set.items.length} as known`);
          }}
        >
          {allKnown ? 'Unmark everything' : 'Mark everything known'}
        </button>
      </div>
    </div>
  );
}
