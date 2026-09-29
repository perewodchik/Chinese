import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLibrary } from '../../features/shared/library';
import { DISTRICTS, districtInfo } from '../core/districts';
import { formatTime, dayOf } from '../core/clock';
import { districtCentre, districtFrame, PLACES, placeOf, SKETCHES, walkPath, type MapLinks, type Place } from '../core/places';
import { LINES } from '../core/travel';
import type { WorldSave } from '../core/types';
import { mapHint } from './panelRows';
import { pinyinOf } from './pinyin';

/**
 * The 🗺 tab: Beijing drawn as a map — the ring roads, the lakes, the
 * palace and the parks, the subway lines — with every place of the game on
 * it and the ways on foot between them. It opens on the district you are
 * in; drag to move, pinch or scroll to zoom, tap a district to go in, tap a
 * place for the way there.
 */

type View = { x: number; y: number; w: number; h: number };

// a little room above the drawing, for the buttons over it
const CITY: View = { x: -4, y: -9, w: 168, h: 105 };
const MIN_W = 14;
/** closer than this, the places get their names and the ways between them show */
const NEAR_W = 64;

let indexOnce: Promise<MapLinks> | null = null;
const loadIndex = () =>
  (indexOnce ??= fetch('/world/maps/index.json')
    .then((r) => r.json() as Promise<MapLinks>)
    .catch(() => {
      indexOnce = null;
      return {} as MapLinks;
    }));

/** where each subway line, bus and train is drawn (they pass the places' own stations) */
const ROUTES: Record<string, ReadonlyArray<readonly [number, number]>> = {
  l1: [[36, 50.2], [119, 50.2], [122.4, 49.6], [136, 49.6]],
  l2: [[62, 24.4], [62, 20.6], [104, 20.6], [104, 58], [62, 58], [62, 24.4]],
  l5: [[100.6, 6], [100.6, 20.6], [100.2, 50.2], [100.2, 58], [96.8, 69.4], [96.8, 90]],
  l6: [[48, 33.6], [75.4, 33.6], [88.6, 32.4], [104, 33.4], [114, 38.6], [132, 38.6]],
  l8: [[86.4, 7.4], [86.4, 14], [81.4, 20.6], [79.6, 28.4], [88.6, 32.4], [91.4, 40], [91.4, 50.2], [85.2, 58], [85.2, 70]],
  l10: [[68, 10.8], [112, 10.8], [117.4, 20], [117.4, 36.2], [122.4, 49.6], [121, 80.4], [112, 88]],
  b332: [[60, 26], [42, 22], [24, 17.4]],
  b34: [[96.8, 69.4], [121, 80.4]],
  jingzhang: [[59.6, 21.6], [40, 12.6], [17.4, 7]],
};

/** 西山 and the hills of the Great Wall, as little peaks */
const HILLS: ReadonlyArray<readonly [number, number, number]> = [
  [4, 30, 1.2], [9, 27, 1], [6, 36, 1], [12, 33, 0.8], [3, 46, 0.9], [9, 42, 0.7], [16, 30, 0.7],
  [37, 8, 0.8], [43, 5, 0.7], [4, 12, 0.8], [7, 17, 0.6],
];
const pts = (a: ReadonlyArray<readonly [number, number]>) => a.map(([x, y]) => `${x},${y}`).join(' ');
/** keeps the view on the drawing, at the box's shape (`aspect` = width / height) */
const clampView = (v: View, aspect = 1.6): View => {
  // on a tall box, the whole city is framed by its height
  const w = Math.min(Math.max(CITY.w, CITY.h * aspect) * 1.1, Math.max(MIN_W, v.w));
  const h = w / aspect;
  return { w, h, x: Math.min(160 - w * 0.3, Math.max(-w * 0.7, v.x)), y: Math.min(100 - h * 0.3, Math.max(-h * 0.7, v.y)) };
};
const short = (name: string) => name.split(' · ')[0]!;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CityMap({ save, onGo }: { save: WorldSave; onGo: (station: string) => void }) {
  const lib = useLibrary();
  const [index, setIndex] = useState<MapLinks>({});
  const [view, setView] = useState<View>(CITY);
  const [picked, setPicked] = useState<{ place: Place } | { district: string } | null>(null);
  const [box, setBox] = useState({ w: 800, h: 500 });
  const px = box.w;
  const aspect = box.w / Math.max(1, box.h);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
  /** a frame (of a district, of the city) widened to the box's shape, centred */
  const fit = (f: View): View => {
    const a = aspectRef.current;
    const w = Math.max(f.w, f.h * a);
    return clampView({ x: f.x + f.w / 2 - w / 2, y: f.y + f.h / 2 - w / a / 2, w, h: w / a }, a);
  };
  const svg = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const anim = useRef(0);
  const here = save.place.map;
  const hereDistrict = index[here]?.district ?? save.district;

  useEffect(() => {
    let on = true;
    void loadIndex().then((i) => {
      if (!on) return;
      setIndex(i);
      // open on the district you are in
      const f = districtFrame(i[here]?.district ?? save.district, i);
      if (f) setView(fit(f));
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = { w: el.clientWidth || 800, h: el.clientHeight || 500 };
      setBox(next);
      // the box changed shape: keep the middle of the view where it was
      const v = viewRef.current;
      const a = next.w / Math.max(1, next.h);
      setView(clampView({ x: v.x, y: v.y + v.h / 2 - v.w / a / 2, w: v.w, h: v.w / a }, a));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const glide = (to: View) => {
    cancelAnimationFrame(anim.current);
    const from = viewRef.current;
    const target = fit(to);
    if (reduced()) return setView(target);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 380);
      const e = 1 - (1 - k) ** 3;
      setView({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  /** zoom by `k` keeping the point (fx, fy) of the drawing where it is */
  const zoomAt = (k: number, fx: number, fy: number) => {
    cancelAnimationFrame(anim.current);
    const v = viewRef.current;
    const w = v.w * k;
    const r = w / v.w;
    setView(clampView({ x: fx - (fx - v.x) * r, y: fy - (fy - v.y) * r, w, h: v.h * r }, aspectRef.current));
  };
  const toUnits = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    const v = viewRef.current;
    return [v.x + ((clientX - r.left) / r.width) * v.w, v.y + ((clientY - r.top) / r.height) * v.h] as const;
  };

  // scroll (or a trackpad pinch) zooms where the pointer is
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [fx, fy] = toUnits(e.clientX, e.clientY);
      zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), fx, fy);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag to move, two fingers to pinch; a drag is not a tap
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const pinch = useRef<{ d: number } | null>(null);
  const onDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    }
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      const prev = pointers.current.get(ev.pointerId);
      if (!prev) return;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) dragged.current = true;
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const r = svg.current!.getBoundingClientRect();
      const v = viewRef.current;
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const [fx, fy] = toUnits((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        zoomAt(pinch.current.d / Math.max(1, d), fx, fy);
        pinch.current = { d };
        return;
      }
      if (!dragged.current) return;
      setView(clampView({ ...v, x: v.x - ((ev.clientX - prev.x) / r.width) * v.w, y: v.y - ((ev.clientY - prev.y) / r.height) * v.h }, aspectRef.current));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      pointers.current.delete(ev.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const near = view.w <= NEAR_W;
  /** one screen pixel, in the drawing's units: marks and names stay the same size at any zoom */
  const u = view.w / Math.max(1, px);
  const shown = useMemo(() => PLACES.filter((p) => !SKETCHES.has(p.map) && index[p.map]), [index]);
  const walks = useMemo(() => {
    const out = new Map<string, [Place, Place]>();
    for (const a of shown)
      for (const l of index[a.map]?.links ?? []) {
        const b = placeOf(l);
        if (b && !SKETCHES.has(b.map)) out.set([a.map, b.map].sort().join(' '), [a, b]);
      }
    return [...out.values()];
  }, [shown, index]);

  const pickDistrict = (id: string) => {
    if (dragged.current) return;
    setPicked({ district: id });
    const f = districtFrame(id, index);
    if (f) glide(f);
  };
  const pickPlace = (p: Place) => {
    if (dragged.current) return;
    setPicked({ place: p });
  };

  const pickedMap = picked && 'place' in picked ? picked.place.map : null;
  const focus = picked && 'district' in picked ? picked.district : pickedMap ? index[pickedMap]?.district : null;

  return (
    <>
      <div className="wp-city">
        <svg
          ref={svg}
          className="wp-city-svg"
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="img"
          aria-label="A map of Beijing with the places of the game"
          onPointerDown={onDown}
          style={{ fontSize: 13 * u }}
        >
          <rect x={-200} y={-200} width={560} height={500} className="c-land" />
          {/* the ring roads: 4th, 3rd, and the 2nd where the old city wall stood */}
          <rect x={32} y={8.5} width={104} height={86} rx={12} className="c-ring" />
          <rect x={46} y={12.8} width={76} height={73.6} rx={8} className="c-ring" />
          <path d="M62 20.6 H104 V56 H108.4 V76.4 H57.6 V56 H62 Z" className="c-ring c-ring-2" />
          <line x1={32} y1={50.2} x2={136} y2={50.2} className="c-road" />
          <line x1={83} y1={4} x2={83} y2={78} className="c-axis" />
          {/* 西山 in the north-west */}
          {HILLS.map(([x, y, k], i) => (
            <path key={i} d={`M${x - 3 * k} ${y} L${x} ${y - 2.4 * k} L${x + 3 * k} ${y}`} className="c-hill" />
          ))}
          {/* parks */}
          <rect x={12} y={9} width={17} height={16} rx={3} className="c-park" />
          <rect x={77.4} y={1} width={14} height={10} rx={2} className="c-park" />
          <rect x={79.6} y={33.4} width={6.8} height={3.8} rx={1} className="c-park" />
          <rect x={71} y={30} width={8.6} height={11} rx={2} className="c-park" />
          <rect x={86} y={64.4} width={10} height={10.8} rx={1.4} className="c-park" />
          {/* water: 昆明湖, 什刹海 (西海, 后海, 前海), 北海, 中南海 */}
          <ellipse cx={20.6} cy={19.6} rx={5.8} ry={4.4} className="c-water" />
          <path d="M65.6 20.8 Q68 19.4 69.6 21.6 L75 24.2 Q78 25 79 28 Q78.8 30 77 29.4 L72.6 27.4 Q69 26.4 67.4 24 Q65 22.6 65.6 20.8 Z" className="c-water" />
          <path d="M72.8 32 Q75.4 30.6 77.6 32.4 Q79 35 78 38 Q76.4 40.6 74 39.6 Q72 37 72.8 32 Z" className="c-water" />
          <path d="M74 41.4 Q77.2 40.6 78.6 42.6 L78.4 48.4 Q76.6 50 74.4 48.6 Q73.2 45 74 41.4 Z" className="c-water" />
          {/* the palace and the square */}
          <rect x={79.2} y={37.8} width={7.6} height={10} className="c-palace" />
          <rect x={80.6} y={50.9} width={4.8} height={5.2} className="c-square" />
          {/* the Great Wall on the hills */}
          <polyline points="2,6 5,3.6 8,5 11,2.4 14,4.2 17,1.6 20,3.4 24,1.2 28,2.8" className="c-wall" />
          {!near && (
            <g className="c-note">
              <text x={20.6} y={20.2} textAnchor="middle">昆明湖</text>
              <text x={30} y={6.2}>60 km</text>
            </g>
          )}
          {/* subway, bus and train */}
          {LINES.map((l) =>
            ROUTES[l.id] ? (
              <polyline key={l.id} points={pts(ROUTES[l.id]!)} className="c-line" data-mode={l.mode} style={{ stroke: l.color }}>
                <title>
                  {l.zh} · {l.en}
                </title>
              </polyline>
            ) : null,
          )}
          {/* the ways on foot between places */}
          {near &&
            walks.map(([a, b]) => (
              <line key={`${a.map}-${b.map}`} x1={a.at[0]} y1={a.at[1]} x2={b.at[0]} y2={b.at[1]} className="c-walk" />
            ))}
          {/* districts, from the whole city */}
          {!near &&
            DISTRICTS.map((d) => {
              const c = districtCentre(d.id, index);
              if (!c) return null;
              return (
                <g
                  key={d.id}
                  className="c-district"
                  data-here={d.id === hereDistrict ? '' : undefined}
                  data-visited={save.districts.includes(d.id) ? '' : undefined}
                  data-later={d.chapter > save.chapter ? '' : undefined}
                  aria-pressed={focus === d.id}
                  onClick={() => pickDistrict(d.id)}
                  role="button"
                  aria-label={`${d.name} · ${d.en}`}
                >
                  <circle cx={c[0]} cy={c[1]} r={20 * u} className="c-hit" />
                  <circle cx={c[0]} cy={c[1]} r={5 * u} className="c-dot" />
                  <text x={c[0]} y={c[1] - 9 * u} textAnchor="middle">
                    {short(d.name)}
                  </text>
                </g>
              );
            })}
          {/* the places */}
          {shown.map((p) => {
            const d = index[p.map]?.district ?? '';
            const isHere = p.map === here;
            const labelled = near;
            const [x, y] = p.at;
            const r = (p.kind === 'inside' ? 3.4 : p.kind === 'station' ? 3.8 : 4.2) * u;
            const lx = p.label === 'r' ? x + 7 * u : p.label === 'l' ? x - 7 * u : x;
            const ly = p.label === 't' ? y - 8 * u : p.label === 'r' || p.label === 'l' ? y + 4.5 * u : y + 16 * u;
            const anchor = p.label === 'r' ? 'start' : p.label === 'l' ? 'end' : 'middle';
            if (!near && !isHere) return <circle key={p.map} cx={x} cy={y} r={1.8 * u} className="c-speck" />;
            return (
              <g
                key={p.map}
                className="c-place"
                data-kind={p.kind}
                data-here={isHere ? '' : undefined}
                data-far={save.districts.includes(d) || isHere ? undefined : ''}
                aria-pressed={pickedMap === p.map}
                role="button"
                aria-label={`${p.zh} · ${p.en}`}
                onClick={() => pickPlace(p)}
              >
                <circle cx={x} cy={y} r={16 * u} className="c-hit" />
                {isHere && <circle cx={x} cy={y} r={9 * u} className="c-here-ring" />}
                {p.kind === 'inside' ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={u} className="c-mark" /> : <circle cx={x} cy={y} r={r} className="c-mark" />}
                {labelled && (
                  <text x={lx} y={ly} textAnchor={anchor}>
                    {p.zh}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="wp-city-tools">
          <button type="button" className="btn sm" onClick={() => (setPicked(null), glide(CITY))} aria-pressed={view.w > NEAR_W}>
            北京
          </button>
          {districtFrame(hereDistrict, index) && (
            <button type="button" className="btn sm" onClick={() => (setPicked(null), glide(districtFrame(hereDistrict, index)!))}>
              Where I am
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn sm" aria-label="Closer" onClick={() => zoomAt(0.7, view.x + view.w / 2, view.y + view.h / 2)}>
            +
          </button>
          <button type="button" className="btn sm" aria-label="Further" onClick={() => zoomAt(1 / 0.7, view.x + view.w / 2, view.y + view.h / 2)}>
            −
          </button>
        </div>
      </div>
      <div className="wp-route">
        {picked && 'place' in picked ? (
          <PlaceInfo place={picked.place} save={save} index={index} onGo={onGo} py={(s) => pinyinOf(s, lib)} />
        ) : picked && 'district' in picked ? (
          <DistrictInfo id={picked.district} save={save} onGo={onGo} py={(s) => pinyinOf(s, lib)} />
        ) : (
          <p className="small muted">
            {placeOf(here) ? (
              <>
                You are at <span className="han">{placeOf(here)!.zh}</span>.{' '}
              </>
            ) : null}
            Tap a place for the way there. Drag to move the map, pinch or scroll to zoom.
          </p>
        )}
      </div>
      <p className="tiny muted">
        Day {dayOf(save.clock)} · {formatTime(save.clock)} · stations used: {save.stations.length}
      </p>
    </>
  );
}

const KIND: Record<Place['kind'], string> = { street: 'street', sight: 'sight', inside: 'indoors', station: 'station' };

function PlaceInfo({ place, save, index, onGo, py }: { place: Place; save: WorldSave; index: MapLinks; onGo: (station: string) => void; py: (s: string) => string }) {
  const here = save.place.map;
  const walk = walkPath(index, here, place.map);
  const d = districtInfo(index[place.map]?.district ?? '');
  const hint = d && !walk ? mapHint(save, d) : null;
  // from the station you get off at, on foot
  const arrive = hint?.kind === 'route' || hint?.kind === 'no-card' ? d?.stations.map((s) => [`station-${s}`, `stop-${s}`]).flat().find((m) => index[m]) : undefined;
  const after = arrive ? walkPath(index, arrive, place.map) : null;
  const names = (path: string[]) => path.map((m) => placeOf(m)?.zh ?? m).join(' → ');
  return (
    <>
      <b className="han">{place.zh}</b>{' '}
      <span className="tiny muted">
        {py(place.zh)} · {place.en} · {KIND[place.kind]}
        {d ? ` · ${short(d.name)}` : ''}
      </span>
      <p className="small">
        {place.map === here
          ? 'You are here.'
          : walk
            ? `On foot: ${names(walk)}.`
            : hint && 'text' in hint
              ? `${hint.text}${after && after.length > 1 ? ` Then on foot: ${names(after)}.` : ''}`
              : ''}
        {d && d.chapter > save.chapter && d.id !== save.district && ' (The story gets there later — you may go already.)'}
      </p>
      {!walk && hint?.kind === 'route' && (
        <button type="button" className="btn sm primary" onClick={() => onGo(hint.from)}>
          Go — to the station
        </button>
      )}
    </>
  );
}

function DistrictInfo({ id, save, onGo, py }: { id: string; save: WorldSave; onGo: (station: string) => void; py: (s: string) => string }) {
  const d = districtInfo(id);
  if (!d) return null;
  const hint = mapHint(save, d);
  return (
    <>
      <b className="han">{d.name}</b> <span className="tiny muted">{py(d.name)} · {d.en}</span>
      <p className="small">
        {hint.kind === 'here' ? 'You are here. Tap a place for the way there.' : 'text' in hint ? hint.text : ''}
        {d.chapter > save.chapter && d.id !== save.district && ' (The story gets there later — you may go already.)'}
      </p>
      {hint.kind === 'route' && (
        <button type="button" className="btn sm primary" onClick={() => onGo(hint.from)}>
          Go — to the station
        </button>
      )}
    </>
  );
}
