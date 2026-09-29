import { useEffect, useRef, useState } from 'react';
import { heroOnPlan, hoodOf, type HoodLayout } from '../core/hoods';
import { placeOf } from '../core/places';
import type { Place as SavePlace } from '../core/types';
import { frameAround, loadPlans, PlanDrawing } from './HoodPlan';

/**
 * The corner map (prompt §9⅞ M2): always there, over the world under the
 * top bar — your neighbourhood in small around you. It folds itself away
 * indoors (a shop, a room) and opens again outdoors; folding or opening it
 * by hand holds until you next go in or out. A tap opens the 🗺 panel on
 * this neighbourhood.
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

export function Minimap({ place, onOpen }: { place: SavePlace; onOpen: (hood: string) => void }) {
  const [plans, setPlans] = useState<HoodLayout[]>([]);
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
        {plan && view && <PlanDrawing plan={plan} u={view.w / px.w} here={place} mini />}
      </svg>
    </div>
  );
}
