import { hoodCounts, markedMaps } from '../core/sidequests';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../features/shared/library';
import { formatTime, dayOf } from '../core/clock';
import { goalMaps } from '../core/goal';
import type { RouteLeg } from '../core/journal';
import { heroOnPlan, HOODS, hoodOf, type HoodLayout } from '../core/hoods';
import { placeOf, type MapLinks } from '../core/places';
import type { WorldSave } from '../core/types';
import { loadIndex, PlaceCard } from './PlaceCard';
import type { WorldContent } from './content';
import { loadPlans, PlanDrawing, planPad } from './HoodPlan';
import { MetroMap } from './MetroMap';
import { pinyinOf } from './pinyin';
import { usePanZoom } from './usePanZoom';
import { Seg } from '../../ui/Seg';

/**
 * The 🗺 tab (prompt §9⅞ M3): it opens on your neighbourhood — the streets
 * as they are, the shops and stations as pictures at their doors, the task
 * in hand ringed, the places you have not been to yet faint. "北京" shows
 * the whole city as a metro diagram (M4); a neighbourhood there, or an
 * arrow at a plan's edge, opens that neighbourhood.
 */
export function MapTab({
  save,
  content,
  onGo,
  start,
  route,
}: {
  save: WorldSave;
  content: WorldContent;
  onGo: (station: string) => void;
  start?: string | null;
  /** the journal's "Show on map" (§10 J3b): the legs to draw on the metro, and the map they lead to */
  route?: { legs: readonly RouteLeg[]; to: string } | null;
}) {
  const lib = useLibrary();
  // §13 Q1: side quests per neighbourhood on the metro map, quest marks on the plans
  const counts = useMemo(() => hoodCounts(save, content), [save, content]);
  const marks = useMemo(() => (save.settings.questMarks === false ? undefined : markedMaps(save, content)), [save, content]);
  const [plans, setPlans] = useState<HoodLayout[]>([]);
  const [index, setIndex] = useState<MapLinks>({});
  const here = hoodOf(save.place.map)?.id ?? HOODS[0]!.id;
  const [hood, setHood] = useState(start ?? here);
  const [city, setCity] = useState(!!route);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    void Promise.all([loadPlans(), loadIndex()]).then(([p, i]) => {
      if (!on) return;
      setPlans(p);
      setIndex(i);
    });
    return () => {
      on = false;
    };
  }, []);

  const visited = useMemo(() => (save.visited ? new Set(save.visited) : undefined), [save.visited]);
  const goals = useMemo(() => new Set([...goalMaps(save, content.quests, content.scenes, content.npcs, content.shops), ...(route ? [route.to] : [])]), [save, content, route]);
  const goHood = (id: string) => {
    setHood(id);
    setCity(false);
    setPicked(null);
  };
  const i = HOODS.findIndex((h) => h.id === hood);
  const step = (d: number) => goHood(HOODS[(i + d + HOODS.length) % HOODS.length]!.id);
  const info = HOODS[i]!;

  return (
    <>
      <div className="wp-maphead">
        <Seg
          label="Map"
          value={city ? 'city' : 'hood'}
          options={[
            { id: 'city', label: '北京 · metro' },
            { id: 'hood', label: 'Neighbourhood' },
          ]}
          onChange={(v) => (v === 'city' ? (setCity(true), setPicked(null)) : goHood(hood))}
          size="sm"
        />
        {!city && (
          <span className="wp-hoodpick">
            <button type="button" className="btn sm ghost" aria-label="The neighbourhood before" onClick={() => step(-1)}>
              ‹
            </button>
            <b className="han">{info.zh}</b>
            <button type="button" className="btn sm ghost" aria-label="The next neighbourhood" onClick={() => step(1)}>
              ›
            </button>
          </span>
        )}
      </div>
      {city ? (
        <MetroMap save={save} goals={goals} onHood={goHood} route={route?.legs ?? null} counts={counts} />
      ) : (
        <HoodView key={hood} plan={plans.find((p) => p.id === hood)} save={save} visited={visited} goals={goals} marks={marks} picked={picked} onPick={setPicked} onExit={goHood} />
      )}
      <div className="wp-route">
        {picked && placeOf(picked) ? (
          <PlaceCard place={placeOf(picked)!} save={save} index={index} onGo={onGo} py={(s) => pinyinOf(s, lib)} />
        ) : (
          <p className="small muted">
            {city ? (
              'Tap a neighbourhood to see its streets.'
            ) : (
              <>
                <span className="han">{info.zh}</span> · {info.en}. {hood === here ? 'You are the red dot. ' : ''}Tap a place for the way there
                {[...goals].some((g) => hoodOf(g)?.id === hood) ? '; the ringed one is where your task is' : ''}.
              </>
            )}
          </p>
        )}
      </div>
      <p className="tiny muted">
        Day {dayOf(save.clock)} · {formatTime(save.clock)} · stations used: {save.stations.length}
      </p>
    </>
  );
}

function HoodView({
  plan,
  save,
  visited,
  goals,
  marks,
  picked,
  onPick,
  onExit,
}: {
  plan: HoodLayout | undefined;
  save: WorldSave;
  visited: ReadonlySet<string> | undefined;
  goals: ReadonlySet<string>;
  marks: ReadonlyMap<string, 'main' | 'side' | 'next'> | undefined;
  picked: string | null;
  onPick: (m: string) => void;
  onExit: (hood: string) => void;
}) {
  const bounds = plan ? { x: plan.x, y: plan.y, w: plan.w, h: plan.h } : { x: 0, y: 0, w: 100, h: 60 };
  // room around the plan, in screen pixels, for the names of rooms and exits
  const pad = useMemo(() => (plan ? planPad(plan) : undefined), [plan]);
  const pz = usePanZoom(bounds, 16, pad);
  // A new plan (or the first): the whole neighbourhood when it fits at a readable size (8 px a
  // tile, where names stop running into each other); on a phone, the part around you — drag for the rest.
  const framed = useRef<string | null>(null);
  useEffect(() => {
    if (!plan || framed.current === plan.id || pz.box.w < 50) return;
    framed.current = plan.id;
    const across = pz.box.w / 8;
    if (bounds.w <= across) {
      pz.glide(bounds, true);
      return;
    }
    const at = heroOnPlan(plan, save.place.map, save.place.tile) ?? [plan.areas[0]!.x + plan.areas[0]!.w / 2, plan.areas[0]!.y + plan.areas[0]!.h / 2];
    const h = across / (pz.box.w / Math.max(1, pz.box.h));
    pz.glide({ x: at[0] - across / 2, y: at[1] - h / 2, w: across, h }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, pz.box.w]);
  const tap = (fn: () => void) => () => {
    if (!pz.dragged.current) fn();
  };
  const { view } = pz;
  return (
    <div className="wp-city">
      <svg ref={pz.svg} className="wp-city-svg wp-plan" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} onPointerDown={pz.onPointerDown} role="img" aria-label="A plan of the neighbourhood">
        <rect x={bounds.x - 400} y={bounds.y - 400} width={bounds.w + 800} height={bounds.h + 800} className="c-land" />
        {plan && (
          <PlanDrawing
            plan={plan}
            u={pz.u}
            here={save.place}
            visited={visited}
            goals={goals}
            {...(marks ? { marks } : {})}
            picked={picked}
            onPick={(m) => tap(() => onPick(m))()}
            onExit={(h) => tap(() => onExit(h))()}
          />
        )}
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
    </div>
  );
}
