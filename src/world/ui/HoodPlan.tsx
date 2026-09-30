import type { ReactNode } from 'react';
import { HOODS, heroOnPlan, type HoodLayout, type LaidExit, type LaidRoom } from '../core/hoods';
import { placeOf } from '../core/places';
import { linesAt } from '../core/travel';
import { HOODS_STAMP, MINI_STAMPS } from './stamps.gen';
import type { Pad, View } from './usePanZoom';

/**
 * One neighbourhood drawn from its plan (core/hoods.ts): every street and
 * park as the miniature of its map, every shop, room and station hall as a
 * picture card at its door, the ways into the next neighbourhood as
 * arrows, and you as a red dot on your very tile. The minimap and the 🗺
 * panel both draw with it; the minimap just shows less (no card names).
 *
 * M8: every built file is loaded by its content hash (stamps.gen.ts), so a
 * browser never shows an old picture; a street picture of the wrong shape is
 * drawn letterboxed, never stretched. Where two streets meet, a crossing.
 */

/** A map's miniature, by its build stamp. */
export const miniUrl = (map: string) => `/world/minis/${map}.png?v=${MINI_STAMPS[map] ?? '0'}`;

let plansOnce: Promise<HoodLayout[]> | null = null;
export const loadPlans = () =>
  (plansOnce ??= fetch(`/world/maps/hoods.json?v=${HOODS_STAMP}`)
    .then((r) => r.json() as Promise<HoodLayout[]>)
    .catch(() => {
      plansOnce = null;
      return [] as HoodLayout[];
    }));

const zhOfHood = (id: string) => HOODS.find((h) => h.id === id)?.zh ?? id;
/** the glyph in a quest mark: the story and a side quest to start "!", a step under way "…" */
const MARK_GLYPH = { main: '!', side: '!', next: '…' } as const;
/** a station's subway lines as their numbers, e.g. ['6', '8'] */
const lineNumbers = (map: string) =>
  linesAt(map.replace(/^station-/, ''))
    .filter((l) => l.mode === 'subway')
    .map((l) => ({ n: l.zh.replace('号线', ''), color: l.color }));
/** the point of a card nearest a door: where the lead line from the door ends */
const nearest = (r: LaidRoom, x: number, y: number) => [Math.min(Math.max(x, r.x), r.x + r.w), Math.min(Math.max(y, r.y), r.y + r.h)] as const;

const ARROW: Record<LaidExit['side'], string> = { up: '↑', down: '↓', left: '←', right: '→' };

export interface PlanProps {
  plan: HoodLayout;
  /** one screen pixel in plan tiles */
  u: number;
  here?: { map: string; tile: readonly [number, number] } | null;
  /** the maps you have been to; the rest are drawn faint (undefined: all as seen) */
  visited?: ReadonlySet<string>;
  /** where the current task is */
  goals?: ReadonlySet<string>;
  /** §13 Q1: places with a quest mark — red the story, gold a side quest to start, 「…」 a step under way */
  marks?: ReadonlyMap<string, 'main' | 'side' | 'next'>;
  picked?: string | null;
  onPick?: (map: string) => void;
  onExit?: (hood: string) => void;
  /** the small corner map: no card names, smaller type */
  mini?: boolean;
  children?: ReactNode;
}

export function PlanDrawing({ plan, u, here, visited, goals, marks, picked, onPick, onExit, mini, children }: PlanProps) {
  const seen = (m: string) => !visited || visited.has(m) || m === here?.map;
  const fs = (mini ? 10.5 : 12.5) * u;
  const dot = here ? heroOnPlan(plan, here.map, here.tile) : null;
  const joins = plan.joins ?? [];
  const doors = plan.doors ?? [];
  // a door mark is a tile, but never smaller than a few screen pixels
  const dm = Math.max(0.8, (mini ? 4 : 6) * u);
  // where each name sits, so a quest mark can sit on its pill
  const roomLabelY = (r: LaidRoom) => (r.door[1] > r.y + r.h / 2 ? r.y - 10 * u : r.y + r.h + 10 * u);
  // a street's name in its middle, moved along the street off any door mark it would cover
  const areaLabel = (a: (typeof plan.areas)[number]): readonly [number, number, number] => {
    const w = pillWidth(placeOf(a.map)?.zh ?? a.map, fs, u);
    const h = fs + 6 * u;
    const along = a.w >= a.h;
    let [x, y] = [a.x + a.w / 2, a.y + a.h / 2];
    const clear = 1.5 * dm;
    for (const d of doors) {
      if (d.from !== a.map) continue;
      const [cx, cy] = [d.x + 0.5, d.y + 0.5];
      if (Math.abs(cx - x) > w / 2 + clear || Math.abs(cy - y) > h / 2 + clear) continue;
      if (along) x = cx > x ? cx - w / 2 - clear : cx + w / 2 + clear;
      else y = cy > y ? cy - h / 2 - clear : cy + h / 2 + clear;
    }
    return [x, y, w];
  };
  const labelAt = (m: string): readonly [number, number, number] | null => {
    const a = plan.areas.find((x) => x.map === m);
    if (a) return areaLabel(a);
    const r = plan.rooms.find((x) => x.map === m);
    if (r && !mini) return [r.x + r.w / 2, roomLabelY(r), pillWidth(placeOf(m)?.zh ?? m, fs * 0.92, u)];
    return null;
  };
  return (
    <g className="hp" data-mini={mini ? '' : undefined} style={{ fontSize: fs }}>
      {plan.areas.map((a) => (
        <g
          key={a.map}
          className="hp-area"
          data-seen={seen(a.map) ? '' : undefined}
          data-picked={picked === a.map ? '' : undefined}
          onClick={onPick ? () => onPick(a.map) : undefined}
          role={onPick ? 'button' : undefined}
          aria-label={onPick ? `${placeOf(a.map)?.zh ?? a.map} · ${placeOf(a.map)?.en ?? ''}` : undefined}
        >
          {/* letterboxed, never stretched: a picture of another shape shows as one, not as streaks */}
          <image href={miniUrl(a.map)} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="xMidYMid meet" className="hp-img" />
          <rect x={a.x} y={a.y} width={a.w} height={a.h} className="hp-edge" />
        </g>
      ))}
      {/* where one street runs on into the next: a crossing over the seam, so it reads as one way */}
      {joins.map((j) => {
        const across = j.h === 0;
        const t = 1.6;
        return (
          <g key={`j-${j.a}-${j.b}`} className="hp-join" aria-hidden>
            <rect x={across ? j.x : j.x - t / 2} y={across ? j.y - t / 2 : j.y} width={across ? j.w : t} height={across ? t : j.h} className="hp-join-road" />
            <line x1={j.x} y1={j.y} x2={j.x + j.w} y2={j.y + j.h} strokeWidth={t * 0.8} strokeDasharray="0.45 0.45" className="hp-join-zebra" />
          </g>
        );
      })}
      {/* lead lines: from each door to the nearest edge of its card */}
      {plan.rooms.map((r) => {
        const [dx, dy] = [r.door[0] + 0.5, r.door[1] + 0.5];
        const [ex, ey] = nearest(r, dx, dy);
        return <line key={`d-${r.map}`} x1={dx} y1={dy} x2={ex} y2={ey} className="hp-path" />;
      })}
      {plan.rooms.map((r) => {
        const p = placeOf(r.map);
        const station = r.map.startsWith('station-');
        return (
          <g
            key={r.map}
            className="hp-room"
            data-station={station ? '' : undefined}
            data-seen={seen(r.map) ? '' : undefined}
            data-picked={picked === r.map ? '' : undefined}
            onClick={onPick ? () => onPick(r.map) : undefined}
            role={onPick ? 'button' : undefined}
            aria-label={onPick ? `${p?.zh ?? r.map} · ${p?.en ?? ''}` : undefined}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={0.6} className="hp-card" />
            <image href={miniUrl(r.map)} x={r.x + 0.4} y={r.y + 0.4} width={r.w - 0.8} height={r.h - 0.8} preserveAspectRatio="xMidYMid slice" className="hp-img" />
          </g>
        );
      })}
      {/* the doors themselves, on the street tile you step on; a station's is its roundel */}
      {doors.map((d) => {
        const station = d.to.startsWith('station-');
        const zh = placeOf(d.to)?.zh ?? d.to;
        return station ? (
          <g key={`dm-${d.from}-${d.to}`} className="hp-door" data-station="">
            <title>{`The way into ${zh}`}</title>
            <circle cx={d.x + 0.5} cy={d.y + 0.5} r={dm * 0.9} className="hp-roundel" />
            <rect x={d.x + 0.5 - dm * 0.9} y={d.y + 0.5 - dm * 0.16} width={dm * 1.8} height={dm * 0.32} className="hp-roundel-bar" />
          </g>
        ) : (
          <g key={`dm-${d.from}-${d.to}`} className="hp-door">
            <title>{`The door of ${zh}`}</title>
            <rect x={d.x + 0.5 - dm / 2} y={d.y + 0.5 - dm / 2} width={dm} height={dm} rx={dm * 0.15} className="hp-door-mark" />
          </g>
        );
      })}
      {/* names on top of everything, so a card never covers a street's name */}
      {plan.areas.map((a) => {
        const [x, y] = areaLabel(a);
        return <Label key={`n-${a.map}`} x={x} y={y} text={placeOf(a.map)?.zh ?? a.map} u={u} fs={fs} picked={picked === a.map} faint={!seen(a.map)} />;
      })}
      {!mini &&
        plan.rooms.map((r) => {
          // the name on the far side from the door, clear of the street; a station's lines beside it
          const zh = placeOf(r.map)?.zh ?? r.map;
          const y = roomLabelY(r);
          const lines = r.map.startsWith('station-') ? lineNumbers(r.map) : [];
          const w = pillWidth(zh, fs * 0.92, u);
          const rr = fs * 0.62;
          return (
            <g key={`n-${r.map}`}>
              <Label x={r.x + r.w / 2} y={y} text={zh} u={u} fs={fs * 0.92} picked={picked === r.map} faint={!seen(r.map)} />
              {lines.map((l, i) => (
                <g key={l.n} className="hp-line" aria-label={`Line ${l.n}`}>
                  <circle cx={r.x + r.w / 2 + w / 2 + rr * (1.2 + 2.2 * i)} cy={y} r={rr} style={{ fill: l.color }} />
                  <text x={r.x + r.w / 2 + w / 2 + rr * (1.2 + 2.2 * i)} y={y + rr * 0.42} textAnchor="middle" style={{ fontSize: rr * 1.25 }}>
                    {l.n}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      {plan.exits.map((e) => {
        const off = 14 * u;
        const [dx, dy] = { up: [0, -off], down: [0, off], left: [-off, 0], right: [off, 0] }[e.side];
        const text = e.side === 'left' || e.side === 'up' ? `${ARROW[e.side]} ${zhOfHood(e.hood)}` : `${zhOfHood(e.hood)} ${ARROW[e.side]}`;
        return (
          <g key={`x-${e.hood}-${e.map}`} className="hp-exit" onClick={onExit ? () => onExit(e.hood) : undefined} role={onExit ? 'button' : undefined}>
            <Label x={e.x + dx!} y={e.y + dy!} text={text} u={u} fs={fs} anchor={e.side === 'left' ? 'end' : e.side === 'right' ? 'start' : 'middle'} exit />
          </g>
        );
      })}
      {[...(goals ?? [])].map((g) => {
        const at = heroOnPlan(plan, g, [0, 0]);
        const r = plan.rooms.find((x) => x.map === g) ?? plan.areas.find((x) => x.map === g);
        return at && r ? <rect key={`g-${g}`} x={r.x - 3 * u} y={r.y - 3 * u} width={r.w + 6 * u} height={r.h + 6 * u} rx={1} className="hp-goal" /> : null;
      })}
      {/* quest marks sit on the name they belong to (on the card's corner in the small map, which has no names) */}
      {[...(marks ?? [])].map(([m, kind]) => {
        const l = labelAt(m);
        const r = plan.rooms.find((x) => x.map === m) ?? plan.areas.find((x) => x.map === m);
        if (!r) return null;
        const rad = (mini ? 5 : 7) * u;
        const [cx, cy] = l ? [l[0] + l[2] / 2, l[1] - (fs + 6 * u) / 2] : [r.x + r.w - rad, r.y + rad];
        const what = kind === 'main' ? 'The story goes on here' : kind === 'side' ? 'A side quest starts here' : 'A step under way is here';
        return (
          <g key={`m-${m}`} className="hp-mark" data-kind={kind}>
            <title>{what}</title>
            <circle cx={cx} cy={cy} r={rad} />
            <text x={cx} y={cy + rad * 0.42} textAnchor="middle" style={{ fontSize: rad * 1.3 }}>
              {MARK_GLYPH[kind]}
            </text>
          </g>
        );
      })}
      {dot && (
        <g className="hp-here" aria-label="You are here">
          <circle cx={dot[0]} cy={dot[1]} r={(mini ? 7 : 10) * u} className="hp-here-ring" />
          <circle cx={dot[0]} cy={dot[1]} r={(mini ? 3.5 : 5) * u} className="hp-here-dot" />
        </g>
      )}
      {children}
    </g>
  );
}

/** Screen pixels past each side of a plan for the names drawn outside it: the rooms' names, and the exits' out to the side. */
export function planPad(plan: HoodLayout): Pad {
  const pad = { l: 24, r: 24, t: 24, b: 24 };
  for (const e of plan.exits) {
    const side = ({ left: 'l', right: 'r', up: 't', down: 'b' } as const)[e.side];
    const across = e.side === 'left' || e.side === 'right' ? 14 + pillWidth(`${ARROW[e.side]} ${zhOfHood(e.hood)}`, 12.5, 1) + 4 : 14 + 12.5 + 10;
    pad[side] = Math.max(pad[side], across);
  }
  // a card on the plan's left or right edge has its name (and a station's lines) half out past it
  for (const r of plan.rooms) {
    const fs = 12.5 * 0.92;
    const half = pillWidth(placeOf(r.map)?.zh ?? r.map, fs, 1) / 2 + (r.map.startsWith('station-') ? lineNumbers(r.map).length * fs * 0.62 * 2.2 + 4 : 0) + 6;
    if (r.x + r.w >= plan.x + plan.w - 0.5) pad.r = Math.max(pad.r, half);
    if (r.x <= plan.x + 0.5) pad.l = Math.max(pad.l, half);
  }
  return pad;
}

// hanzi are one em wide; arrows and spaces about half
const pillWidth = (text: string, fs: number, u: number) => [...text].reduce((n, c) => n + (/[㐀-鿿]/.test(c) ? 1 : 0.55), 0) * fs + 10 * u;

/** A name on a small pill, sized in screen pixels whatever the zoom. */
function Label({ x, y, text, u, fs, picked, faint, anchor = 'middle', exit }: { x: number; y: number; text: string; u: number; fs: number; picked?: boolean; faint?: boolean; anchor?: 'start' | 'middle' | 'end'; exit?: boolean }) {
  const w = pillWidth(text, fs, u);
  const h = fs + 6 * u;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <g className="hp-label" data-picked={picked ? '' : undefined} data-faint={faint ? '' : undefined} data-exit={exit ? '' : undefined}>
      <rect x={x0} y={y - h / 2} width={w} height={h} rx={h / 2} />
      <text x={x0 + w / 2} y={y + fs * 0.36} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

/** The plan's frame around a point (the minimap follows you), `w` tiles across. */
export function frameAround(plan: HoodLayout, at: readonly [number, number] | null, w: number, aspect: number): View {
  const h = w / aspect;
  const [cx, cy] = at ?? [plan.x + plan.w / 2, plan.y + plan.h / 2];
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
