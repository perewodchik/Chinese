import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import type { PartOfDay } from '../../world/core/types';
import type { RunningWorld } from '../../world/engine/boot';
import { oneOf, useQuery } from '../../navigation/query';
import { useTitle } from '../../ui/useTitle';

const TIMES: PartOfDay[] = ['morning', 'day', 'evening', 'night'];

/** Where the prototype maps put you. Replaced by the save once the game runs on it. */
const STARTS: Record<string, [number, number]> = {
  'hutong-proto': [14, 7],
  'tiananmen-proto': [19, 22],
};

/**
 * 走走 on the page: a box the canvas fills. Below 690px it takes the whole
 * screen and the site's bar goes, as 点单 does on a phone.
 *
 *   /play/world?map=hutong-proto&time=night&frame=1024x768
 *
 * `frame` pins the box to a size, for review screenshots.
 */
export function WorldPage() {
  useTitle('走走 Zǒuzou');
  const [query] = useQuery();
  const mapId = oneOf(query.get('map'), Object.keys(STARTS), 'hutong-proto');
  const time = oneOf(query.get('time'), TIMES, 'day') as PartOfDay;
  const frame = /^(\d+)x(\d+)$/.exec(query.get('frame') ?? '');
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.worldFull = '';
    return () => {
      delete html.dataset.worldFull;
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let world: RunningWorld | null = null;
    let gone = false;
    setState('loading');
    import('../../world/engine/boot')
      .then(({ startWorld }) =>
        startWorld(el, { map: mapId, time, hero: STARTS[mapId]!, onReady: () => !gone && setState('ready') }),
      )
      .then((w) => {
        if (gone) w.destroy();
        else {
          world = w;
          (window as unknown as { __world?: RunningWorld }).__world = w;
        }
      })
      .catch(() => !gone && setState('failed'));
    return () => {
      gone = true;
      world?.destroy();
      delete (window as unknown as { __world?: RunningWorld }).__world;
    };
  }, [mapId, time]);

  return (
    <div className="world-shell" data-state={state} data-framed={frame ? '' : undefined}>
      <div
        className="world-canvas"
        ref={box}
        style={frame ? { width: Number(frame[1]), height: Number(frame[2]) } : undefined}
      />
      {/* On a phone the site's bar is gone; this is the way back out. */}
      <Link className="world-exit" to={paths.play()} aria-label="Leave the game">
        ‹
      </Link>
      {state !== 'ready' && (
        <div className="world-loading small">{state === 'failed' ? 'The game could not start. Reload to try again.' : 'Opening Beijing…'}</div>
      )}
    </div>
  );
}
