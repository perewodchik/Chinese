import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { StrokeMap } from '../data/types';
import { Glyph } from './Glyph';

export interface ItemCardProps {
  glyph: string;
  py: string;
  gloss: string;
  strokes: StrokeMap;
  /**
   * Scale the outline to fill the card. A radical form is stored where it sits
   * inside a character — 忄 a strip down the left — which a card should show
   * whole rather than in the corner.
   */
  fit?: boolean;
  /** what to draw when `glyph` is a stroke key rather than a character */
  fallback?: string;
  /** the number in the corner: teaching order, or position in a collection */
  index?: number | string;
  learned?: boolean;
  selected?: boolean;
  /** marks a card that already sits in a collection; `title` says which */
  claimed?: boolean;
  size?: number;
  onClick?: (shift: boolean) => void;
  onOpen?: () => void;
  onRemove?: () => void;
  /** turns the card into a drag handle for reordering */
  onDragStart?: (e: ReactPointerEvent) => void;
  onDragMove?: (e: ReactPointerEvent) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
  /** where the card sits while a drag is in flight */
  style?: CSSProperties;
  title?: string;
}

/**
 * One character or radical, as a card.
 *
 * The same card in the library, in a collection and in a preview, because they
 * are the same thing seen in three places — a page where the browser used
 * cards and the collection used table rows made the collection look like a
 * database and the library look like the app.
 */
export function ItemCard({
  glyph,
  py,
  gloss,
  strokes,
  fit,
  fallback,
  index,
  learned,
  selected,
  claimed,
  size = 46,
  onClick,
  onOpen,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragging,
  style,
  title,
}: ItemCardProps) {
  return (
    <div
      className="item"
      role="button"
      tabIndex={0}
      data-selected={selected || undefined}
      data-learned={learned || undefined}
      data-dragging={dragging || undefined}
      style={style}
      title={title ?? (learned ? 'Learned' : 'Not learned yet')}
      onClick={(e) => onClick?.(e.shiftKey)}
      onDoubleClick={onOpen}
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e.shiftKey);
        }
        if (e.key === 'i') onOpen?.();
        if (e.key === 'Delete' || e.key === 'Backspace') onRemove?.();
      }}
    >
      {index !== undefined && <span className="idx">{index}</span>}
      <span className="marks">
        {claimed && <span className="dot claimed" />}
        {learned && <span className="tick">✓</span>}
      </span>
      <Glyph
        char={glyph}
        strokes={strokes}
        size={size}
        className="glyph"
        fit={fit}
        fallback={fallback}
      />
      <div className="py">{py}</div>
      <div className="gloss">{gloss}</div>
      {onOpen && (
        <button
          className="info"
          title="Everything about this character"
          aria-label={`Details for ${fallback ?? glyph}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          i
        </button>
      )}
      {onRemove && (
        <button
          className="remove"
          title="Take out of this collection"
          aria-label={`Remove ${glyph}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
