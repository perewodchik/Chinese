import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

interface Drag {
  from: number;
  to: number;
  /** how far the pointer has travelled since the grab */
  dx: number;
  dy: number;
}

export interface GridReorder {
  containerRef: RefObject<HTMLDivElement>;
  dragging: boolean;
  /** props to spread on card number `i` */
  handlers: (i: number) => {
    onDragStart: (e: ReactPointerEvent) => void;
    onDragMove: (e: ReactPointerEvent) => void;
    onDragEnd: () => void;
    dragging: boolean;
    style: CSSProperties | undefined;
  };
  /**
   * True when the click about to fire is the tail of a drag, so the card can
   * skip its ordinary select-on-click.
   */
  consumeClick: () => boolean;
}

/**
 * Reordering a grid of cards by dragging one of them.
 *
 * The card you are holding follows the pointer and the others slide out of its
 * way, so the arrangement under the cursor is the arrangement you will get.
 * The version before this left every card where it was and drew a thin blue
 * bar at the edge of the one you were nearest, which is a diagram of the
 * operation rather than the operation.
 *
 * Pointer events rather than HTML5 drag-and-drop: identical with a mouse,
 * works with touch and a stylus, and no dependency on the browser's drag
 * image. A drag only begins once the pointer has actually moved, so a plain
 * click still selects.
 */
export function useGridReorder(
  count: number,
  onReorder: (from: number, to: number) => void,
): GridReorder {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Card boxes, measured once per gesture: the cards move while dragging, so
  // re-measuring mid-gesture would chase its own tail.
  const boxes = useRef<DOMRect[]>([]);
  const origin = useRef<{ x: number; y: number; index: number } | null>(null);
  const moved = useRef(false);

  function start(i: number, e: ReactPointerEvent) {
    if (e.button !== 0 || count < 2) return;
    origin.current = { x: e.clientX, y: e.clientY, index: i };
    moved.current = false;
  }

  function move(e: ReactPointerEvent) {
    const o = origin.current;
    if (!o) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;

    if (!drag) {
      if (Math.hypot(dx, dy) < 5) return;
      const list = containerRef.current;
      if (!list) return;
      boxes.current = [...list.querySelectorAll('.item')].map((el) =>
        el.getBoundingClientRect(),
      );
      try {
        // Keeps the gesture with this card even when the pointer runs past
        // the edge of it. Throws if the pointer has already been released.
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* carry on without capture */
      }
      moved.current = true;
      setDrag({ from: o.index, to: o.index, dx, dy });
      return;
    }

    // Nearest card centre wins, which reads correctly in a wrapped grid where
    // "before this one" can mean the end of the row above.
    let best = drag.to;
    let bestD = Infinity;
    boxes.current.forEach((b, i) => {
      const d = Math.hypot(
        e.clientX - (b.left + b.width / 2),
        e.clientY - (b.top + b.height / 2),
      );
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setDrag({ from: drag.from, to: best, dx, dy });
  }

  function end() {
    if (drag && drag.from !== drag.to) onReorder(drag.from, drag.to);
    origin.current = null;
    setDrag(null);
  }

  /**
   * Where card `i` sits while a drag is in flight. Everything between the card
   * being dragged and where it is heading shuffles up or down by one place,
   * which is exactly what dropping will do to them.
   */
  function shift(i: number): CSSProperties | undefined {
    if (!drag) return undefined;
    if (i === drag.from) {
      return {
        transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.04)`,
        transition: 'none',
        zIndex: 3,
      };
    }
    const b = boxes.current;
    if (!b.length) return undefined;
    const to =
      drag.from < drag.to && i > drag.from && i <= drag.to
        ? i - 1
        : drag.from > drag.to && i >= drag.to && i < drag.from
          ? i + 1
          : i;
    if (to === i || !b[to] || !b[i]) return undefined;
    return {
      transform: `translate(${b[to].left - b[i].left}px, ${b[to].top - b[i].top}px)`,
    };
  }

  return {
    containerRef,
    dragging: drag !== null,
    consumeClick: () => {
      const was = moved.current;
      moved.current = false;
      return was;
    },
    handlers: (i: number) => ({
      onDragStart: (e) => start(i, e),
      onDragMove: move,
      onDragEnd: end,
      dragging: drag?.from === i,
      style: shift(i),
    }),
  };
}
