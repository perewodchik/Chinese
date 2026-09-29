import { HOODS, hoodOf } from '../core/hoods';
import { AT, extent, labelBox, linePoints, linesThrough, roundedPath, WALK_LINKS } from '../core/metro';
import { LINES, station } from '../core/travel';
import type { WorldSave } from '../core/types';
import { usePanZoom } from './usePanZoom';

/**
 * The whole city as a metro diagram (prompt §9⅞ M4), drawn from
 * core/metro.ts: the game's lines in their colours, interchanges as white
 * rings, the stations with somewhere to go in bold — tap one for its
 * neighbourhood. You are a red ring; your task a gold one.
 */

/** drawing units per grid unit */
const G = 10;

/** the station a neighbourhood is drawn at on the diagram */
const hoodAt = new Map(HOODS.map((h) => [h.stations[0]!, h]));

export function MetroMap({ save, goals, onHood }: { save: WorldSave; goals: ReadonlySet<string>; onHood: (hood: string) => void }) {
  const e = extent();
  const bounds = { x: (e.x - 2.5) * G, y: (e.y - 1.5) * G, w: (e.w + 6) * G, h: (e.h + 3) * G };
  const pz = usePanZoom(bounds, 60);
  const { view, u } = pz;
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
      <span className="mm-key tiny">Bold: places to go. Dashed: bus and train.</span>
    </div>
  );
}

