import type { Anchor } from './content';

/**
 * The furniture: a table, a bed, a house — drawn in ink, sitting in the same
 * box the zones are worked out from, so what the eye sees as "under the table"
 * is what the check counts as under it.
 */
export function AnchorDrawing({ anchor }: { anchor: Anchor }) {
  const W = 400;
  const H = 300;
  const x = anchor.box.x * W;
  const y = anchor.box.y * H;
  const w = anchor.box.w * W;
  const h = anchor.box.h * H;
  return (
    <svg className="g-where-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <line className="g-where-floor" x1={0} y1={H * 0.83} x2={W} y2={H * 0.83} />
      {anchor.id === 'table' && (
        <g className="g-where-thing">
          <rect x={x - 6} y={y} width={w + 12} height={12} rx={4} />
          <rect x={x + 6} y={y + 12} width={10} height={h - 12} />
          <rect x={x + w - 16} y={y + 12} width={10} height={h - 12} />
        </g>
      )}
      {anchor.id === 'bed' && (
        <g className="g-where-thing">
          <rect x={x} y={y - 34} width={14} height={h + 34} rx={4} />
          <rect x={x} y={y} width={w} height={26} rx={8} />
          <rect className="g-where-soft" x={x + 18} y={y - 12} width={48} height={14} rx={6} />
          <rect x={x + w - 12} y={y + 26} width={10} height={h - 26} />
          <rect x={x + 16} y={y + 26} width={10} height={h - 26} />
        </g>
      )}
      {anchor.id === 'home' && (
        <g className="g-where-thing">
          <path className="g-where-roof" d={`M${x - 16} ${y + h * 0.3} L${x + w / 2} ${y} L${x + w + 16} ${y + h * 0.3} Z`} />
          <rect className="g-where-wall" x={x} y={y + h * 0.3} width={w} height={h * 0.7} />
          <rect className="g-where-soft" x={x + w * 0.62} y={y + h * 0.62} width={w * 0.2} height={h * 0.38} />
        </g>
      )}
    </svg>
  );
}
