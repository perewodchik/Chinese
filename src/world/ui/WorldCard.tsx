import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '../../features/auth/session';
import { paths } from '../../navigation/paths';
import { readSave } from '../core/migrate';
import type { WorldSave } from '../core/types';
import { worldApi } from '../sync/gateway';
import { browserLocal } from '../sync/local';
import { cardView, later, STORY_SPIRITS } from './card';
import './card.css';

const fromRaw = (raw: unknown): WorldSave | null => {
  if (raw == null) return null;
  const r = readSave(raw);
  return r.ok ? r.save : null;
};

/**
 * 走走 on /play (concept §13): first on the page, above 点单, a pixel
 * banner that follows the saved game clock, the one progress line, where
 * you stopped and Continue — or Start the first time. The device's copy
 * answers at once; the server's follows if it is newer. The banner's box
 * has its size before the picture arrives, so nothing moves.
 */
export function WorldCard() {
  const user = useUser();
  const [save, setSave] = useState<WorldSave | null>(() => fromRaw(browserLocal(user.id).read()?.save));
  useEffect(() => {
    let live = true;
    void worldApi
      .load()
      .then((dto) => live && setSave((cur) => later(cur, fromRaw(dto.save))))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user.id]);

  const v = cardView(save);
  return (
    <Link className="world-card" to={paths.world()} aria-label={`走走 Zǒuzou, walk Beijing — ${v.started ? 'continue' : 'start'}`}>
      <span className="world-card-art">
        <img src={`/world/art/banner-${v.time}.png`} alt="" width={960} height={320} draggable={false} />
        <span className="world-card-label">Game</span>
      </span>
      <span className="world-card-body">
        <span className="world-card-title">
          <b className="hanzi">走走</b> Zǒuzou · <i>Walk Beijing</i>
        </span>
        <span className="world-card-progress small">
          <span className="long">
            Chapter {v.chapter} · spirits {v.spirits}/{STORY_SPIRITS} · 成语 {v.idioms} · stamps {v.stamps}
          </span>
          <span className="short" aria-hidden>
            <span className="hanzi">章</span>
            {v.chapter} · <span className="hanzi">灵</span>
            {v.spirits}/{STORY_SPIRITS} · <span className="hanzi">成</span>
            {v.idioms} · <span className="hanzi">印</span>
            {v.stamps}
          </span>
        </span>
        <span className="world-card-where small muted">
          {v.started ? <span className="hanzi">{v.where}</span> : 'A walk through Beijing: talk your way around, find the lantern’s spirits.'}
        </span>
        <span className="btn primary sm world-card-go">{v.started ? 'Continue' : 'Start'}</span>
      </span>
    </Link>
  );
}
