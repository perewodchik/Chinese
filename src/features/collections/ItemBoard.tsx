import type { Collection } from '../../domain/collection';
import { itemsLabel, type ItemId } from '../../domain/ids';
import { factsOf, sortByLibrary } from '../../domain/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { removeItems, reorderItems, setLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { useToast } from '../../ui/toast';
import { useGridReorder } from '../../ui/useGridReorder';
import { useRangeSelection } from '../../ui/useRangeSelection';
import { useLibrary } from '../shared/library';
import { AddSearch } from './AddSearch';

interface Props {
  c: Collection;
  /** ids already sitting in some other collection */
  taken: ReadonlySet<ItemId>;
}

/**
 * The contents of a collection, as the same cards the library uses.
 *
 * It was a list of rows with a drag grip, which read as a spreadsheet of the
 * thing you had just been browsing as cards. Characters are pictures; a row of
 * text with a 24pt glyph in it makes them into filenames.
 */
export function ItemBoard({ c, taken }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const openItem = useOpenItem();
  const learned = useStore((s) => s.learned);
  const picked = useRangeSelection(c.items);

  const reorder = useGridReorder(c.items.length, (from, to) => {
    const next = [...c.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    reorderItems(c.id, next);
  });

  const allLearned = c.items.length > 0 && c.items.every((i) => learned.has(i));

  return (
    <div>
      <AddSearch c={c} taken={taken} />

      <div className="row board-bar">
        <button
          className="btn sm"
          onClick={() => reorderItems(c.id, sortByLibrary(lib, c.items))}
          disabled={c.items.length < 2}
          title="Back into the order the library teaches them in"
        >
          Sort
        </button>
        <span className="tiny muted grow">
          {picked.selected.size
            ? `${picked.selected.size} selected`
            : c.items.length
              ? 'drag a card to move it · shift-click for a run'
              : ''}
        </span>
        {picked.selected.size > 0 && (
          <>
            <button
              className="btn sm"
              onClick={() => {
                setLearned([...picked.selected], true);
                toast(`Marked ${picked.selected.size} as learned`);
                picked.clear();
              }}
            >
              Mark learned
            </button>
            <button
              className="btn sm"
              onClick={() => {
                setLearned([...picked.selected], false);
                picked.clear();
              }}
            >
              Unmark
            </button>
            <button
              className="btn danger sm"
              onClick={() => {
                removeItems(c.id, [...picked.selected]);
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
        {!picked.selected.size && c.items.length > 0 && (
          <button className="btn ghost sm" onClick={() => picked.selectAll(c.items)}>
            Select all
          </button>
        )}
      </div>

      {c.items.length === 0 ? (
        <div className="empty">
          <span className="big">空</span>
          <p>
            Nothing in this collection yet. Search above for what you want in it, or pick a run of
            characters in the Library and add them from there.
          </p>
        </div>
      ) : (
        <div className="grid board" data-dragging={reorder.dragging || undefined} ref={reorder.containerRef}>
          {c.items.map((id, i) => {
            const f = factsOf(lib, id);
            if (!f) return null;
            return (
              <ItemCard
                key={id}
                glyph={f.glyph}
                py={f.py}
                gloss={f.gloss}
                strokes={lib.strokes}
                word={f.kind === 'word'}
                index={i + 1}
                learned={learned.has(id)}
                selected={picked.selected.has(id)}
                onClick={(shift) => {
                  if (reorder.consumeClick()) return;
                  picked.toggle(id, shift);
                }}
                onOpen={() => openItem(id)}
                onRemove={() => removeItems(c.id, [id])}
                {...reorder.handlers(i)}
              />
            );
          })}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <span className="tiny muted grow">
          {itemsLabel(c.items)} · {c.items.filter((i) => learned.has(i)).length} learned
        </span>
        <button
          className="btn sm"
          disabled={!c.items.length}
          onClick={() => {
            setLearned(c.items, !allLearned);
            toast(allLearned ? 'Unmarked everything' : `Marked all ${c.items.length} as learned`);
          }}
        >
          {allLearned ? 'Unmark everything' : 'Mark everything learned'}
        </button>
      </div>
    </div>
  );
}
