import type { ReactNode } from 'react';
import { HOODS, heroOnPlan, type HoodLayout, type LaidExit } from '../core/hoods';
import { placeOf } from '../core/places';
import type { View } from './usePanZoom';

/**
 * One neighbourhood drawn from its plan (core/hoods.ts): every street and
 * park as the miniature of its map, every shop, room and station hall as a
 * picture card at its door, the ways into the next neighbourhood as
 * arrows, and you as a red dot on your very tile. The minimap and the 🗺
 * panel both draw with it; the minimap just shows less (no card names).
 */

let plansOnce: Promise<HoodLayout[]> | null = null;
export const loadPlans = () =>
  (plansOnce ??= fetch('/world/maps/hoods.json')
    .then((r) => r.json() as Promise<HoodLayout[]>)
    .catch(() => {
      plansOnce = null;
      return [] as HoodLayout[];
    }));

const zhOfHood = (id: string) => HOODS.find((h) => h.id === id)?.zh ?? id;
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
  picked?: string | null;
  onPick?: (map: string) => void;
  onExit?: (hood: string) => void;
  /** the small corner map: no card names, smaller type */
  mini?: boolean;
  children?: ReactNode;
}

export function PlanDrawing({ plan, u, here, visited, goals, picked, onPick, onExit, mini, children }: PlanProps) {
  const seen = (m: string) => !visited || visited.has(m) || m === here?.map;
  const fs = (mini ? 10.5 : 12.5) * u;
  const dot = here ? heroOnPlan(plan, here.map, here.tile) : null;
  return (
    <g className="hp" data-mini={mini ? '' : undefined} style={{ fontSize: fs }}>
      {/* the paths from a street to the doors of its shops */}
      {plan.rooms.map((r) => (
        <line key={`d-${r.map}`} x1={r.door[0] + 0.5} y1={r.door[1] + 0.5} x2={r.x + r.w / 2} y2={r.door[1] < r.y ? r.y : r.y + r.h} className="hp-path" />
      ))}
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
          <image href={`/world/minis/${a.map}.png`} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="none" className="hp-img" />
          <rect x={a.x} y={a.y} width={a.w} height={a.h} className="hp-edge" />
        </g>
      ))}
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
            <image href={`/world/minis/${r.map}.png`} x={r.x + 0.4} y={r.y + 0.4} width={r.w - 0.8} height={r.h - 0.8} preserveAspectRatio="xMidYMid slice" className="hp-img" />
            {station && <circle cx={r.x + 0.3} cy={r.y + 0.3} r={mini ? 5 * u : 9 * u} className="hp-roundel" />}
          </g>
        );
      })}
      {/* names on top of everything, so a card never covers a street's name */}
      {plan.areas.map((a) => (
        <Label key={`n-${a.map}`} x={a.x + a.w / 2} y={a.y + a.h / 2} text={placeOf(a.map)?.zh ?? a.map} u={u} fs={fs} picked={picked === a.map} faint={!seen(a.map)} />
      ))}
      {!mini &&
        plan.rooms.map((r) => (
          // the name on the far side from the door, clear of the street
          <Label key={`n-${r.map}`} x={r.x + r.w / 2} y={r.door[1] > r.y + r.h / 2 ? r.y - 10 * u : r.y + r.h + 10 * u} text={placeOf(r.map)?.zh ?? r.map} u={u} fs={fs * 0.92} picked={picked === r.map} faint={!seen(r.map)} />
        ))}
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

/** A name on a small pill, sized in screen pixels whatever the zoom. */
function Label({ x, y, text, u, fs, picked, faint, anchor = 'middle', exit }: { x: number; y: number; text: string; u: number; fs: number; picked?: boolean; faint?: boolean; anchor?: 'start' | 'middle' | 'end'; exit?: boolean }) {
  // hanzi are one em wide; arrows and spaces about half
  const w = [...text].reduce((n, c) => n + (/[㐀-鿿]/.test(c) ? 1 : 0.55), 0) * fs + 10 * u;
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
