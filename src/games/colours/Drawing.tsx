import type { Thing } from './content';

/**
 * Outline drawings to colour in — the thing's body is the part that takes the
 * paint (`fill`), the details are drawn over it in ink.
 */
export function Drawing({ thing, fill }: { thing: Thing; fill: string | null }) {
  const paint = fill ?? 'var(--card)';
  const body = { fill: paint, className: 'g-draw-body' };
  return (
    <svg className="g-draw" viewBox="0 0 200 160" role="img" aria-label={thing.w}>
      {thing.w === '苹果' && (
        <>
          <path {...body} d="M100 48c-18-14-58-12-60 26 0 36 26 70 44 70 8 0 10-4 16-4s8 4 16 4c18 0 44-34 44-70-2-38-42-40-60-26z" />
          <path className="g-draw-line" d="M100 48c0-12 4-22 12-30" />
          <path className="g-draw-leaf" d="M104 30c10-14 28-14 34-8-8 12-24 14-34 8z" />
        </>
      )}
      {thing.w === '车' && (
        <>
          <path {...body} d="M22 104V84c0-6 4-10 10-10h22l22-24h56l26 24h18c6 0 10 4 10 10v20z" />
          <path className="g-draw-line" d="M82 56h24v18H64zM112 56h18l20 18h-38z" />
          <circle className="g-draw-wheel" cx="62" cy="108" r="16" />
          <circle className="g-draw-wheel" cx="148" cy="108" r="16" />
        </>
      )}
      {thing.w === '猫' && (
        <>
          <path {...body} d="M60 140c-6-30 4-60 28-70l-6-34 22 22h24l22-22-6 34c24 10 34 40 28 70z" />
          <path className="g-draw-line" d="M150 140c24 0 34-20 24-40" />
          <circle className="g-draw-eye" cx="90" cy="92" r="5" />
          <circle className="g-draw-eye" cx="130" cy="92" r="5" />
          <path className="g-draw-line" d="M104 106l6 6 6-6M80 108h-24M80 114l-22 6M140 108h24M140 114l22 6" />
        </>
      )}
      {thing.w === '花' && (
        <>
          <path className="g-draw-stem" d="M100 90v62M100 128c-14-4-24-14-26-24 14 0 24 10 26 24z" />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} {...body} cx="100" cy="56" rx="16" ry="30" transform={`rotate(${a} 100 80)`} />
          ))}
          <circle className="g-draw-centre" cx="100" cy="80" r="14" />
        </>
      )}
      {thing.w === '杯子' && (
        <>
          <path {...body} d="M56 40h84l-10 104H66z" />
          <path className="g-draw-line" fill="none" d="M138 62c30 0 30 44 0 44" />
          <path className="g-draw-line" d="M60 58h76" />
        </>
      )}
      {thing.w === '鱼' && (
        <>
          <path {...body} d="M30 80c30-44 94-44 124 0-30 44-94 44-124 0zM150 80l34-26v52z" />
          <circle className="g-draw-eye" cx="60" cy="74" r="6" />
          <path className="g-draw-line" d="M88 56c10 16 10 32 0 48" fill="none" />
        </>
      )}
    </svg>
  );
}
