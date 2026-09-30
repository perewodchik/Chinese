import { useEffect } from 'react';
import { HOODS, hoodOf } from '../core/hoods';
import type { RouteLeg } from '../core/journal';
import { AT, extent, labelBox, linePoints, linesThrough, roundedPath, WALK_LINKS } from '../core/metro';
import { LINES, station } from '../core/travel';
import type { WorldSave } from '../core/types';
import { boxOf, routePoints } from './metroRoute';
import { usePanZoom } from './usePanZoom';

/**
 * The whole city as a metro diagram (prompt §9⅞ M4), drawn from
 * core/metro.ts: the game's lines in their colours, interchanges as white
 * rings, the stations with somewhere to go in bold — tap one for its
 * neighbourhood. You are a red ring; your task a gold one.
 *
 * With a `route` (§10 J3b, the journal's "Show on map"), the ride is drawn
 * thick in its lines' colours over the others dimmed, with rings where you
 * change and pins for you and for there, and the view fits the route.
 */

/** drawing units per grid unit */
const G = 10;

/** screen pixels past the lines for the stations' names, and the key along the bottom */
const PAD = { l: 44, r: 44, t: 12, b: 36 };

/** the station a neighbourhood is drawn at on the diagram */
const hoodAt = new Map(HOODS.map((h) => [h.stations[0]!, h]));

export function MetroMap({
  save,
  goals,
  onHood,
  route,
  counts,
}: {
  save: WorldSave;
  goals: ReadonlySet<string>;
  onHood: (hood: string) => void;
  route?: readonly RouteLeg[] | null;
  /** §13 Q1: side quests per neighbourhood — new ones you could start, ones under way */
  counts?: ReadonlyMap<string, { new: number; on: number }>;
}) {
  const e = extent();
  const bounds = { x: (e.x - 2.5) * G, y: (e.y - 1.5) * G, w: (e.w + 6) * G, h: (e.h + 3) * G };
  const pz = usePanZoom(bounds, 60, PAD);
  const { view, u } = pz;
  const rides = (route ?? []).filter((l): l is Extract<RouteLeg, { kind: 'ride' }> => l.kind === 'ride');
  const walks = (route ?? []).flatMap((l) => {
    if (l.kind !== 'walk' || l.maps.length !== 2) return [];
    const [a, b] = l.maps.map((m) => m.replace(/^(station|stop)-/, ''));
    return a && b && AT[a] && AT[b] ? [[a, b] as const] : [];
  });
  const changes = (route ?? []).flatMap((l) => (l.kind === 'change' && AT[l.at] ? [l.at] : []));
  const start = rides[0]?.from;
  const end = rides.at(-1)?.to;
  const paths = rides.map((l) => ({ leg: l, points: routePoints(l.line, l.stops) }));
  // fit the view to the route (once it is known and the box has its size)
  const routeKey = rides.map((l) => `${l.line}:${l.from}>${l.to}`).join('|');
  useEffect(() => {
    const b = boxOf(paths.flatMap((p) => p.points));
    if (!b || !pz.measured || pz.box.w < 50) return;
    const pad = 1.6;
    pz.glide({ x: (b.x - pad) * G, y: (b.y - pad) * G, w: (b.w + pad * 2) * G, h: (b.h + pad * 2) * G }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, pz.box.w, pz.measured]);
  const here = hoodOf(save.place.map);
  const goalHoods = new Set([...goals].map((m) => hoodOf(m)?.id).filter(Boolean));
  const pxPerGrid = G / u;
  const minor = pxPerGrid >= 24;
  const tap = (fn: () => void) => () => {
    if (!pz.dragged.current) fn();
  };

  return (
    <div className="wp-city">
      <svg
        ref={pz.svg}
        className="wp-city-svg wp-metro"
        data-route={rides.length ? '' : undefined}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onPointerDown={pz.onPointerDown}
        role="img"
        aria-label="The metro map of the game's Beijing"
      >
        <rect x={bounds.x - 400} y={bounds.y - 400} width={bounds.w + 800} height={bounds.h + 800} className="c-land" />
        {/* a few landmarks, faint: the palace, the lakes, the parks, the Wall on its hills */}
        <g className="mm-marks">
          <rect x={3.9 * G} y={3.7 * G} width={1.5 * G} height={2.6 * G} rx={2} className="c-palace" />
          <path d={`M${2.6 * G} ${0.7 * G} Q${3.4 * G} ${0.4 * G} ${4 * G} ${1.1 * G} Q${4.1 * G} ${2.2 * G} ${3.3 * G} ${2.3 * G} Q${2.5 * G} ${1.8 * G} ${2.6 * G} ${0.7 * G} Z`} className="c-water" />
          <rect x={6.9 * G} y={11.8 * G} width={1.7 * G} height={2.2 * G} rx={3} className="c-park" />
          <rect x={2.4 * G} y={-8.9 * G} width={1.7 * G} height={2.4 * G} rx={3} className="c-park" />
          <ellipse cx={-8.4 * G} cy={-5.6 * G} rx={1.2 * G} ry={0.8 * G} className="c-water" />
          <polyline points={[-11, -9, -10, -10.4, -9, -9.6, -8.6, -11, -7.4, -10.6, -6.4, -11.6].map((v) => v * G).join(' ')} className="c-wall" />
        </g>
        {WALK_LINKS.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={AT[a]![0] * G} y1={AT[a]![1] * G} x2={AT[b]![0] * G} y2={AT[b]![1] * G} className="mm-walk" />
        ))}
        {LINES.map((l) => (
          <path key={l.id} d={roundedPath(linePoints(l.id), 0.7, G)} className="mm-line" data-mode={l.mode} style={{ stroke: l.color }}>
            <title>
              {l.zh} · {l.en}
            </title>
          </path>
        ))}
        {/* the ride, thick in its lines' colours (J3b) */}
        {walks.map(([a, b]) => (
          <line key={`rw-${a}-${b}`} x1={AT[a]![0] * G} y1={AT[a]![1] * G} x2={AT[b]![0] * G} y2={AT[b]![1] * G} className="mm-route-walk" />
        ))}
        {paths.map(({ leg, points }, i) => (
          <path key={`r-${i}`} d={roundedPath(points, 0.7, G)} className="mm-route" data-mode={leg.mode} style={{ stroke: LINES.find((l) => l.id === leg.line)?.color }} />
        ))}
        {Object.keys(AT).map((s) => {
          const [x, y] = AT[s]!;
          const hood = hoodAt.get(s);
          const lines = linesThrough(s);
          const inter = lines.length > 1;
          const first = LINES.find((l) => l.id === lines[0]);
          const isHere = hood && hood.id === here?.id;
          const isGoal = hood && goalHoods.has(hood.id);
          const r = (hood ? 6.5 : inter ? 5 : 3.2) * u;
          return (
            <g
              key={s}
              className="mm-st"
              data-game={hood ? '' : undefined}
              data-inter={inter ? '' : undefined}
              role={hood ? 'button' : undefined}
              aria-label={hood ? `${station(s).zh} · ${hood.en}` : undefined}
              onClick={hood ? tap(() => onHood(hood.id)) : undefined}
            >
              {hood && <circle cx={x * G} cy={y * G} r={18 * u} className="mm-hit" />}
              {isGoal && <circle cx={x * G} cy={y * G} r={r + 6 * u} className="mm-goal" />}
              {isHere && <circle cx={x * G} cy={y * G} r={r + 4 * u} className="mm-here" />}
              <circle cx={x * G} cy={y * G} r={r} className="mm-dot" style={inter || hood ? undefined : { stroke: first?.color }} />
            </g>
          );
        })}
        {/* §13 Q1: "3 new · 1 on" over each neighbourhood with side quests */}
        {Object.keys(AT).map((s) => {
          const hood = hoodAt.get(s);
          const n = hood && counts?.get(hood.id);
          if (!n) return null;
          const [x, y] = AT[s]!;
          const text = [n.new ? `${n.new} new` : '', n.on ? `${n.on} on` : ''].filter(Boolean).join(' · ');
          const fs = 9.5 * u;
          const w = text.length * fs * 0.56 + 8 * u;
          return (
            <g key={`q-${s}`} className="mm-count" data-new={n.new ? '' : undefined} aria-label={`${hood!.en}: ${text}`}>
              <rect x={x * G - w / 2} y={y * G - 26 * u} width={w} height={fs + 5 * u} rx={3 * u} />
              <text x={x * G} y={y * G - 26 * u + fs + 0.5 * u} textAnchor="middle" style={{ fontSize: fs }}>
                {text}
              </text>
            </g>
          );
        })}
        {changes.map((c) => (
          <circle key={`c-${c}`} cx={AT[c]![0] * G} cy={AT[c]![1] * G} r={9 * u} className="mm-change" />
        ))}
        {start && AT[start] && <Pin x={AT[start]![0] * G} y={AT[start]![1] * G} u={u} label="you" kind="you" />}
        {end && AT[end] && <Pin x={AT[end]![0] * G} y={AT[end]![1] * G} u={u} label="there" kind="there" />}
        {Object.keys(AT).map((s) => {
          const hood = hoodAt.get(s);
          if (!hood && !minor) return null;
          const fs = (hood ? 13 : 10.5) * u;
          const b = labelBox(s, fs / G);
          const tx = b.anchor === 'start' ? b.x : b.anchor === 'end' ? b.x + b.w : b.x + b.w / 2;
          return (
            <text
              key={`t-${s}`}
              x={tx * G}
              y={(b.y + b.h * 0.86) * G}
              textAnchor={b.anchor}
              className="mm-name"
              data-game={hood ? '' : undefined}
              style={{ fontSize: fs }}
              onClick={hood ? tap(() => onHood(hood.id)) : undefined}
            >
              {station(s).zh}
            </text>
          );
        })}
      </svg>
      <div className="wp-city-tools">
        <span className="spacer" />
        <button type="button" className="btn sm" aria-label="Closer" onClick={() => pz.zoomBy(0.7)}>
          +
        </button>
        <button type="button" className="btn sm" aria-label="Further" onClick={() => pz.zoomBy(1 / 0.7)}>
          −
        </button>
      </div>
      <span className="mm-key tiny">{rides.length ? 'Your way there, in its lines’ colours. ↔ where you change.' : 'Bold: places to go. Dashed: bus and train.'}</span>
    </div>
  );
}


/** A pin over a station: where you get on, and where you are going (J3b). Sized in screen pixels. */
function Pin({ x, y, u, label, kind }: { x: number; y: number; u: number; label: string; kind: 'you' | 'there' }) {
  const h = 22 * u;
  return (
    <g className="mm-pin" data-kind={kind} transform={`translate(${x} ${y})`}>
      <path d={`M0 ${-4 * u} L${-6 * u} ${-17 * u} H${6 * u} Z`} className="mm-pin-tail" />
      <rect x={-19 * u} y={-8 * u - h - 8 * u} width={38 * u} height={h} rx={6 * u} className="mm-pin-box" />
      <text x={0} y={-8 * u - h * 0.5 - 8 * u + 4.5 * u} textAnchor="middle" style={{ fontSize: 12 * u }} className="mm-pin-text">
        {label}
      </text>
    </g>
  );
}
