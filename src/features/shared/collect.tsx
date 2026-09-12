import { useCallback, type CSSProperties } from 'react';
import type { Collection } from '../../domain/collection';
import { countLabel, type ItemId } from '../../domain/ids';
import { sortByLibrary } from '../../domain/library';
import { addItems, createCollection } from '../../store/commands';
import { getState, useStore } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useLibrary } from './library';

/** The id of a collection to add to, or `new` for one made on the spot. */
export type CollectTarget = string;

/**
 * Putting characters into a collection from wherever they turned up — a
 * selection in the library, the new characters of a text, the ones a drill
 * caught you out on — in teaching order, without doubling anything, and saying
 * what happened.
 */
export function useCollect() {
  const lib = useLibrary();
  const toast = useToast();

  return useCallback(
    (target: CollectTarget, ids: ItemId[], options: { newName: string }): Collection | null => {
      const sorted = sortByLibrary(lib, ids);
      if (target === 'new') {
        const made = createCollection({ name: options.newName, items: sorted });
        toast(`Put ${countLabel(sorted.length)} into “${made.name}”`);
        return made;
      }
      const existing = getState().collections.find((c) => c.id === target);
      if (!existing) return null;
      const added = addItems(target, sorted);
      toast(
        added === sorted.length
          ? `Added ${added} to ${existing.name}`
          : `Added ${added} to ${existing.name}; ${sorted.length - added} were already there`,
      );
      return existing;
    },
    [lib, toast],
  );
}

/** A menu of the collections something could go into, with a new one at the end. */
export function CollectionPicker({
  placeholder,
  onPick,
  className,
  style,
}: {
  placeholder: string;
  onPick: (target: CollectTarget) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const collections = useStore((s) => s.collections);
  return (
    <select
      className={className}
      style={style}
      value=""
      aria-label={placeholder}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          Add to {c.name}
        </option>
      ))}
      <option value="new">A new collection</option>
    </select>
  );
}
