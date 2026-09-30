import { useEffect, useRef, useState, type ReactNode } from 'react';
import { heroOnPlan, hoodOf, type HoodLayout } from '../core/hoods';
import { placeOf } from '../core/places';
import type { Place as SavePlace } from '../core/types';
import { frameAround, loadPlans, PlanDrawing } from './HoodPlan';
import { placeZh } from './Journal';
import { takeMeTo, useGuide } from './takeMeThere';

/**
 * The corner map (prompt §9⅞ M2): always there, over the world under the
 * top bar — your neighbourhood in small around you. It folds itself away
 * indoors (a shop, a room) and opens again outdoors; folding or opening it
 * by hand holds until you next go in or out. A tap opens the 🗺 panel on
 * this neighbourhood. While you are being taken somewhere (M6), it draws the
 * way from you, and a chip under it says where to, with × to stop.
 */

const KEY = 'zouzou:minimap';
/** tiles across the corner map */
const ACROSS = 32;

type Manual = { indoor: boolean; open: boolean };
const readManual = (): Manual | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Manual | null;
    return v && typeof v.indoor === 'boolean' && typeof v.open === 'boolean' ? v : null;
  } catch {
    return null;
  }
};
const writeManual = (m: Manual) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private window: it just forgets */
  }
};

export function Minimap({
  place,
  onOpen,
  goals,
  marks,
  children,
}: {
  place: SavePlace;
  onOpen: (hood: string) => void;
  /** the followed quest's maps, ringed in gold (§10 J2) */
  goals?: ReadonlySet<string>;
  /** §13 Q1: dots in the quest marks' colours */
  marks?: ReadonlyMap<string, 'main' | 'side' | 'next'>;
  children?: ReactNode;
}) {
  const [plans, setPlans] = useState<HoodLayout[]>([]);
  const guide = useGuide();
  const [manual, setManual] = useState<Manual | null>(readManual);
  const box = useRef<SVGSVGElement>(null);
  const [px, setPx] = useState({ w: 200, h: 132 });
  useEffect(() => {
    let on = true;
    void loadPlans().then((p) => on && setPlans(p));
    return () => {
      on = false;
    };
  }, []);

  const hood = hoodOf(place.map);
  const plan = hood ? plans.find((p) => p.id === hood.id) : undefined;
  const indoor = placeOf(place.map)?.kind === 'inside';
  // a hand-set state holds only while you stay in (or out)
  const open = manual && manual.indoor === indoor ? manual.open : !indoor;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPx({ w: el.clientWidth || 200, h: el.clientHeight || 132 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  const toggle = () => {
    const m = { indoor, open: !open };
    setManual(m);
    writeManual(m);
  };
  if (!hood) return null;

  const at = plan ? heroOnPlan(plan, place.map, place.tile) : null;
  const view = plan ? frameAround(plan, at, ACROSS, px.w / Math.max(1, px.h)) : null;
  return (
    <div className="wm" data-open={open ? '' : undefined}>
      <button type="button" className="wm-head" onClick={toggle} aria-expanded={open} aria-label={open ? 'Fold the map away' : 'Open the map'}>
        <span className="han">{hood.zh}</span>
        <span className="wm-chev" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      <svg
        ref={box}
        className="wm-map"
        viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 10 10'}
        role="button"
        aria-label={`Map of ${hood.en}. Open the big map.`}
        onClick={() => onOpen(hood.id)}
        style={open ? undefined : { display: 'none' }}
      >
        {plan && view && <PlanDrawing plan={plan} u={view.w / px.w} here={place} goals={goals} {...(marks ? { marks } : {})} route={guide.route} mini />}
      </svg>
      {/* under the map: the next hop of the quest you follow (§10 J3c); folded away with it */}
      {open && children}
      {/* M6: where the footprints lead — shown folded or not, so it can always be stopped */}
      {guide.to && (
        <span className="wm-guide">
          <Prints />
          <span className="han">{placeZh(guide.to)}</span>
          <button type="button" className="wm-guide-x" onClick={() => takeMeTo(null)} aria-label={`Stop the footprints to ${placeZh(guide.to)}`}>
            ×
          </button>
        </span>
      )}
    </div>
  );
}

/** two small shoe prints, the "Take me there" sign */
function Prints() {
  return (
    <svg className="wm-prints" viewBox="0 0 12 12" width="14" height="14" aria-hidden>
      <rect x="1.5" y="5" width="3" height="4" rx="1.2" />
      <rect x="2" y="9.6" width="2" height="1.6" rx="0.6" />
      <rect x="7.5" y="1" width="3" height="4" rx="1.2" />
      <rect x="8" y="5.6" width="2" height="1.6" rx="0.6" />
    </svg>
  );
}
