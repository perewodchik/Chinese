import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Dragging a thing with a finger, a Pencil or a mouse.
 *
 * Pointer events with capture, so the drag keeps going when the finger leaves
 * the thing; the element moves by transform only (no layout), and the page
 * does not scroll under it because the stage sets `touch-action: none`.
 * `onDrop` gets the point where it was let go, in the coordinates of the
 * element passed as `stage`, as a share of its width and height (0–1).
 */
export interface Dragging {
  /** where the dragged thing is, as an offset from where it started */
  offset: { x: number; y: number } | null;
  bind(id: string): {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    style: React.CSSProperties;
    'data-dragging'?: boolean;
  };
  active: string | null;
}

export function useDrag(
  stage: React.RefObject<HTMLElement | null>,
  onDrop: (id: string, at: { x: number; y: number }) => void,
  disabled = false,
): Dragging {
  const [active, setActive] = useState<string | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const bind = useCallback(
    (id: string) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        setActive(id);
        setOffset({ x: 0, y: 0 });
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        if (active !== id || !start.current) return;
        setOffset({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        if (active !== id) return;
        const box = stage.current?.getBoundingClientRect();
        const moved = start.current ? Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) : 0;
        setActive(null);
        setOffset(null);
        start.current = null;
        if (box && moved > 6) {
          onDrop(id, { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height });
        }
      },
      onPointerCancel: () => {
        setActive(null);
        setOffset(null);
        start.current = null;
      },
      style:
        active === id && offset
          ? // the separate `translate`/`scale` properties add to whatever `transform` the thing already has
            { translate: `${offset.x}px ${offset.y}px`, scale: '1.06', zIndex: 5 }
          : {},
      'data-dragging': active === id || undefined,
    }),
    [active, offset, disabled, onDrop, stage],
  );

  return { offset, bind, active };
}
