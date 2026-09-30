import { hoodOf, wayThere } from '../core/hoods';
import { placeOf, type MapLinks, type Place } from '../core/places';
import { districtInfo } from '../core/districts';
import type { WorldSave } from '../core/types';
import { takeMeTo, useGuide } from './takeMeThere';
import { stamped } from './stamped';

/**
 * What the 🗺 tab says about a place you tapped: its name, pinyin, English,
 * its neighbourhood, and the way there — on foot, or the ride and the walk
 * from the station (core/hoods.ts `wayThere`). "Take me there" (M6) lays
 * footprints to it in the world; the same button stops them.
 */

let indexOnce: Promise<MapLinks> | null = null;
/** public/world/maps/index.json: every map's district and where its doors and edges lead */
export const loadIndex = () =>
  (indexOnce ??= fetch(stamped('/world/maps/index.json'))
    .then((r) => r.json() as Promise<MapLinks>)
    .catch(() => {
      indexOnce = null;
      return {} as MapLinks;
    }));

const KIND: Record<Place['kind'], string> = { street: 'street', sight: 'sight', inside: 'indoors', station: 'station' };
const names = (path: string[]) => path.map((m) => placeOf(m)?.zh ?? m).join(' → ');

export function PlaceCard({ place, save, index, onGo, py }: { place: Place; save: WorldSave; index: MapLinks; onGo: (station: string) => void; py: (s: string) => string }) {
  const way = wayThere(save, place.map, index);
  const hood = hoodOf(place.map);
  const d = districtInfo(index[place.map]?.district ?? '');
  const guide = useGuide();
  const taking = guide.to === place.map;
  return (
    <>
      <b className="han">{place.zh}</b>{' '}
      <span className="tiny muted">
        {py(place.zh)} · {place.en} · {KIND[place.kind]}
        {hood ? ` · ${hood.zh}` : ''}
      </span>
      <p className="small">
        {way.kind === 'here'
          ? 'You are here.'
          : way.kind === 'walk'
            ? `On foot: ${names(way.path)}.`
            : way.kind === 'ride'
              ? `${way.text}${way.then && way.then.length > 1 ? ` Then on foot: ${names(way.then)}.` : ''}${way.card ? '' : ' But first you need a 交通卡 — the ticket machine in any station sells them (40 元).'}`
              : way.text}
        {d && d.chapter > save.chapter && d.id !== save.district && ' (The story gets there later — you may go already.)'}
      </p>
      <span className="wp-place-acts">
        {way.kind !== 'here' && way.kind !== 'none' && (
          <button type="button" className="btn sm primary wp-take" aria-pressed={taking} title={taking ? undefined : 'Footprints lead the way in the world — close the map to follow them'} onClick={() => takeMeTo(taking ? null : place.map)}>
            {taking ? 'Stop the footprints' : 'Take me there'}
          </button>
        )}
        {way.kind === 'ride' && way.card && (
          <button type="button" className="btn sm" onClick={() => onGo(way.from)}>
            Go — to the station
          </button>
        )}
      </span>
    </>
  );
}
