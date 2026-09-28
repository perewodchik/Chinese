import { Link } from 'react-router';
import { GAMES } from '../../games/registry';
import { Seal } from '../../games/kit/Seal';
import type { Band, GameManifest } from '../../games/types';
import type { GameStats } from '../../domain/play';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { usePlayContext } from './usePlayContext';
import { WorldCard } from '../../world/ui/WorldCard';
import '../../games/kit/kit.css';

const BANDS = ['1', '2'] as const;

/**
 * The games: short rounds of HSK 1–2 made into play — where things are, what
 * they are counted with, what time it is, what a word looks like.
 *
 *   /play?band=2
 *
 * Practice, not review: nothing played here is scheduled (see domain/play).
 * What a game keeps is its seal — the red stamp for the best round so far —
 * and those are laid out along the top like a stamp book.
 *
 * The 点单 shops come first, in a section of their own: each is a
 * shopfront — a photo of what it sells under the brand's colour — since they
 * are places to go into rather than drills.
 */
export function PlayPage() {
  useTitle('Play');
  const [query, setQuery] = useQuery();
  const band = Number(oneOf(query.get('band'), BANDS, '1')) as Band;
  const play = useStore((s) => s.play);
  const ctx = usePlayContext(band, 'check');
  const sealed = GAMES.filter((g) => (play.games[g.id]?.seal ?? 0) > 0).length;
  const games = GAMES.filter((g) => !g.shop);
  const shops = GAMES.filter((g) => g.shop);
  const canPlay = (g: GameManifest): Availability =>
    !ctx
      ? { ok: false, reason: 'Getting ready…' }
      : !g.bands.includes(band)
        ? { ok: false, reason: `Only for HSK ${g.bands.join(' and ')}` }
        : g.available(ctx);

  return (
    <div className="play-page">
      <div className="row">
        <div>
          <h1>Play</h1>
          <div className="small muted">Short games with the words of HSK 1 and 2. Nothing here is scheduled.</div>
        </div>
        <div className="spacer" />
        <Seg
          size="sm"
          label="Words up to"
          value={String(band) as (typeof BANDS)[number]}
          options={[
            { id: '1', label: 'HSK 1' },
            { id: '2', label: 'HSK 1–2' },
          ]}
          onChange={(v) => setQuery('band', v, '1')}
        />
      </div>

      <WorldCard />

      <section className="play-book" aria-label="Seals">
        <div className="play-book-seals">
          {GAMES.map((g) => (
            <Seal key={g.id} mark={g.mark} level={play.games[g.id]?.seal ?? 0} size={34} />
          ))}
        </div>
        <span className="tiny muted">
          {sealed} of {GAMES.length} sealed
        </span>
      </section>

      <section className="play-shops" aria-labelledby="play-shops-h">
        <div className="play-shops-head">
          <h2 id="play-shops-h">
            <span className="hanzi">点单</span> Order in China
          </h2>
          <p className="small muted">
            Real shops’ WeChat mini-programs. A friend texts you an order in Chinese; you find it on the menu, choose the
            options and pay.
          </p>
        </div>
        <div className="shop-grid">
          {shops.map((g) => {
            const shop = g.shop!;
            const can = canPlay(g);
            const stats = play.games[g.id];
            const body = (
              <>
                <span className="shop-front" style={{ '--shop': shop.colour } as React.CSSProperties}>
                  <img src={`/images/menu/${shop.photo}.jpg`} alt="" loading="lazy" draggable={false} />
                  <span className="shop-sign">
                    <b className="hanzi">{g.name}</b>
                    <i>{shop.latin}</i>
                  </span>
                </span>
                <span className="shop-body">
                  <span className="shop-kind">{shop.kind}</span>
                  <span className="shop-blurb">{g.blurb}</span>
                  <span className="shop-figures">
                    <Figures can={can} stats={stats} />
                    <span className="spacer" />
                    <Seal mark={g.mark} level={stats?.seal ?? 0} size={26} />
                  </span>
                </span>
              </>
            );
            return can.ok ? (
              <Link key={g.id} className="shop-card" to={paths.game(g.id, band)}>
                {body}
              </Link>
            ) : (
              <button key={g.id} type="button" className="shop-card" disabled>
                {body}
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="play-games-h">Quick games</h2>
      <div className="drill-grid">
        {games.map((g) => {
          const can = canPlay(g);
          const stats = play.games[g.id];
          const body = (
            <>
              <span className="mark hanzi">{g.mark}</span>
              <span className="name">{g.name}</span>
              <span className="blurb">{g.blurb}</span>
              <span className="figures">
                <Figures can={can} stats={stats} />
              </span>
            </>
          );
          return can.ok ? (
            <Link key={g.id} className="drill-card play-card" to={paths.game(g.id, band)}>
              {body}
              <span className="play-card-seal">
                <Seal mark={g.mark} level={stats?.seal ?? 0} size={30} />
              </span>
            </Link>
          ) : (
            <button key={g.id} type="button" className="drill-card play-card" disabled>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Availability = { ok: true } | { ok: false; reason: string };

function Figures({ can, stats }: { can: Availability; stats: GameStats | undefined }) {
  if (!can.ok) return <i>{can.reason}</i>;
  if (!stats) return <i>not played yet</i>;
  return (
    <>
      <i>played {stats.plays}×</i>
      <i>best {Math.round(stats.best * 100)}%</i>
    </>
  );
}
