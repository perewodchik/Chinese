import { useRef, useState } from 'react';
import type { Library } from '../data/types';
import type { ItemId } from '../store/types';
import { Glyph } from './Glyph';
import { glyphOf } from './Templates';

interface Props {
  lib: Library;
  items: ItemId[];
  learned: Set<ItemId>;
  selected: Set<ItemId>;
  onReorder: (items: ItemId[]) => void;
  onRemove: (id: ItemId) => void;
  onOpen: (id: ItemId) => void;
  onToggleSelect: (id: ItemId, shift: boolean) => void;
  onToggleLearned: (id: ItemId) => void;
}

function subtitle(id: ItemId, lib: Library): string {
  if (id.startsWith('r')) {
    const r = lib.radicals.find((x) => `r${x.n}` === id);
    return r ? `${r.py} · ${r.mean.split(/[;,]/)[0]}` : '';
  }
  const c = lib.byChar.get(id.slice(1));
  return c ? `${c.py[0]} · ${c.def.split(/[;,]/)[0]}` : '';
}

interface Drag {
  from: number;
  /** where the row would land if you let go now */
  to: number;
}

/**
 * The running order of a template. Rows move by dragging the grip at the left;
 * nothing else in the row starts a drag, so the checkbox and buttons keep
 * their ordinary click behaviour.
 *
 * This uses pointer events rather than HTML5 drag-and-drop: it behaves the
 * same with a mouse, works with touch and a stylus, and does not depend on the
 * browser's drag image.
 */
export function ItemList({
  lib,
  items,
  learned,
  selected,
  onReorder,
  onRemove,
  onOpen,
  onToggleSelect,
  onToggleLearned,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Row boxes, measured once per drag: the rows move while dragging, so
  // re-measuring mid-gesture would chase its own tail.
  const boxes = useRef<Array<{ top: number; bottom: number }>>([]);

  function begin(index: number, e: React.PointerEvent) {
    const list = listRef.current;
    if (!list) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    boxes.current = [...list.querySelectorAll('.item-row')].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    setDrag({ from: index, to: index });
  }

  function move(e: React.PointerEvent) {
    if (!drag) return;
    const y = e.clientY;
    let to = boxes.current.length - 1;
    for (let i = 0; i < boxes.current.length; i++) {
      const b = boxes.current[i];
      if (y < (b.top + b.bottom) / 2) {
        to = i;
        break;
      }
    }
    // Dropping just past the source is a no-op; normalise so the marker sits
    // where the row will really end up.
    if (to !== drag.to) setDrag({ ...drag, to });
  }

  function end() {
    if (drag && drag.from !== drag.to) {
      const next = [...items];
      const [moved] = next.splice(drag.from, 1);
      next.splice(drag.to, 0, moved);
      onReorder(next);
    }
    setDrag(null);
  }

  return (
    <div className="scroll-list" ref={listRef}>
      {items.map((id, i) => {
        const isLearned = learned.has(id);
        const marker =
          drag && drag.to === i && drag.from !== i
            ? drag.from < i
              ? 'below'
              : 'above'
            : undefined;
        return (
          <div
            key={id}
            className="item-row"
            data-dragging={drag?.from === i || undefined}
            data-drop={marker}
            data-selected={selected.has(id) || undefined}
          >
            {/* Dragging starts here and nowhere else, so the checkbox and the
                buttons in the row keep their own click behaviour. */}
            <span
              className="handle"
              title="Drag to reorder"
              role="button"
              tabIndex={-1}
              onPointerDown={(e) => begin(i, e)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={() => setDrag(null)}
            >
              ⠿
            </span>
            <input
              type="checkbox"
              className="pick"
              checked={selected.has(id)}
              onChange={(e) =>
                onToggleSelect(id, (e.nativeEvent as MouseEvent).shiftKey)
              }
              aria-label={`Select ${glyphOf(lib, id)}`}
            />
            <span className="tiny muted num">{i + 1}</span>
            <button
              className="btn ghost sm"
              style={{ padding: 2 }}
              onClick={() => onOpen(id)}
              title="Show details"
            >
              <Glyph char={glyphOf(lib, id)} strokes={lib.strokes} size={24} />
            </button>
            <span className="tiny muted grow">{subtitle(id, lib)}</span>
            <button
              className={`btn ghost sm learn${isLearned ? ' on' : ''}`}
              onClick={() => onToggleLearned(id)}
              title={isLearned ? 'Learned — click to unset' : 'Mark as learned'}
              aria-pressed={isLearned}
            >
              ✓
            </button>
            <button
              className="btn danger sm"
              onClick={() => onRemove(id)}
              title="Remove from this template"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
