import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Two small charts for the Stats page, drawn as inline SVG in the app's own
 * ink so they sit on the page like the rest of it — no chart library, no
 * colours of their own beyond the two series tokens in stats.css.
 *
 * Both measure the width they are given and draw to it, so text in them
 * stays text-sized at any width. Both answer a hover or a tap on the plot
 * with the numbers for that point, in a line above the plot that is always
 * there (so nothing moves when it fills in).
 */

/** The width of an element, followed as it changes. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const PAD = { top: 10, right: 44, bottom: 24, left: 34 };

/** A nice step for an axis running to `max`: 1, 2 or 5 times a power of ten. */
function niceMax(max: number, ticks = 4): { max: number; step: number } {
  if (max <= 0) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { max: Math.ceil(max / step) * step, step };
}

/** Which of `n` evenly spaced labels to print so they never collide. */
function labelEvery(n: number, width: number, labelPx = 46): number {
  return Math.max(1, Math.ceil((n * labelPx) / Math.max(1, width)));
}

export interface LineSeries {
  id: string;
  name: string;
  values: number[];
}

export interface Goal {
  value: number;
  label: string;
  /** the series it belongs to, for its colour */
  series: string;
}

/**
 * Lines over time. Points marked `dashedTo` and before are drawn dashed —
 * the days reconstructed rather than written down.
 */
export function LineChart({
  labels,
  series,
  goals,
  dashedTo,
  height = 220,
  tip,
  label,
}: {
  labels: string[];
  series: LineSeries[];
  goals: Goal[];
  /** index of the last estimated point, or -1 */
  dashedTo: number;
  height?: number;
  tip: (i: number) => ReactNode;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const top = Math.max(1, ...series.flatMap((s) => s.values));
  // A goal is drawn when it is within reach of the chart: under twice the top.
  const shown = goals.filter((g) => g.value <= Math.max(top * 2, 10));
  const { max, step } = niceMax(Math.max(top, ...shown.map((g) => g.value)));
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const y = (v: number) => PAD.top + h - (v / max) * h;
  const every = labelEvery(n, w);
  const at = hover ?? n - 1;

  function path(values: number[], from: number, to: number) {
    let d = '';
    for (let i = Math.max(0, from); i <= Math.min(n - 1, to); i++) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i]!).toFixed(1)}`;
    return d;
  }

  function pick(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / Math.max(1, box.width)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div className="st-chart" ref={ref}>
      <div className="st-tip" aria-live="polite">
        {n ? tip(at) : ' '}
      </div>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {Array.from({ length: Math.round(max / step) + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line className="st-grid" x1={PAD.left} x2={PAD.left + w} y1={y(v)} y2={y(v)} />
              <text className="st-axis" x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % every === (n - 1) % every ? (
              <text key={i} className="st-axis" x={x(i)} y={height - 6} textAnchor="middle">
                {l}
              </text>
            ) : null,
          )}
          {shown.map((g) => (
            <g key={`${g.series}-${g.value}`} className="st-goal" data-series={g.series}>
              <line x1={PAD.left} x2={PAD.left + w} y1={y(g.value)} y2={y(g.value)} />
              <text x={PAD.left + w + 4} y={y(g.value) + 3.5}>
                {g.label}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <g key={s.id} className="st-line" data-series={s.id}>
              {dashedTo >= 0 && <path d={path(s.values, 0, Math.min(n - 1, dashedTo + 1))} data-estimated />}
              <path d={path(s.values, Math.max(0, dashedTo + 1), n - 1)} />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} />
              <text className="st-direct" x={x(n - 1) + 8} y={y(s.values[n - 1] ?? 0) + 4}>
                {s.values[n - 1] ?? 0}
              </text>
            </g>
          ))}
          {hover !== null && (
            <g className="st-cross">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} />
              {series.map((s) => (
                <circle key={s.id} data-series={s.id} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} />
              ))}
            </g>
          )}
          <rect
            className="st-hit"
            x={PAD.left}
            y={PAD.top}
            width={w}
            height={h}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
    </div>
  );
}

export interface BarSeries {
  id: string;
  name: string;
  values: number[];
}

/** Bars over time, stacked when there is more than one series. */
export function BarChart({
  labels,
  series,
  height = 170,
  tip,
  label,
}: {
  labels: string[];
  series: BarSeries[];
  height?: number;
  tip: (i: number) => ReactNode;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const { max, step } = niceMax(Math.max(1, ...totals), 3);
  const w = Math.max(0, width - PAD.left - 12);
  const h = height - PAD.top - PAD.bottom;
  const slot = n ? w / n : 0;
  const bar = Math.max(2, Math.min(28, slot * 0.66));
  const y = (v: number) => PAD.top + h - (v / max) * h;
  const every = labelEvery(n, w);
  const at = hover ?? n - 1;

  return (
    <div className="st-chart" ref={ref}>
      <div className="st-tip" aria-live="polite">
        {n ? tip(at) : ' '}
      </div>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {Array.from({ length: Math.round(max / step) + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line className="st-grid" x1={PAD.left} x2={PAD.left + w} y1={y(v)} y2={y(v)} />
              <text className="st-axis" x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {labels.map((l, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            let base = 0;
            return (
              <g key={i} data-hover={hover === i || undefined}>
                {series.map((s) => {
                  const v = s.values[i] ?? 0;
                  if (!v) return null;
                  const y0 = y(base);
                  base += v;
                  const y1 = y(base);
                  // a 2px gap between stacked pieces, taken from the upper one
                  const top = y1;
                  const hgt = Math.max(1, y0 - y1 - (base > v ? 2 : 0));
                  return (
                    <rect
                      key={s.id}
                      className="st-bar"
                      data-series={s.id}
                      x={cx - bar / 2}
                      y={top}
                      width={bar}
                      height={hgt}
                      rx={Math.min(3, bar / 3)}
                    />
                  );
                })}
                {i % every === (n - 1) % every && (
                  <text className="st-axis" x={cx} y={height - 6} textAnchor="middle">
                    {l}
                  </text>
                )}
                <rect
                  className="st-hit"
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={h}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** A legend: a swatch and a name per series. Always shown for two or more. */
export function Legend({ items }: { items: Array<{ id: string; name: string; dashed?: boolean }> }) {
  return (
    <div className="st-legend">
      {items.map((it) => (
        <span key={it.id} data-series={it.id}>
          <i data-dashed={it.dashed || undefined} />
          {it.name}
        </span>
      ))}
    </div>
  );
}
