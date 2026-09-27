import { Link } from 'react-router';
import { GAMES } from '../../games/registry';
import { Seal } from '../../games/kit/Seal';
import type { Band } from '../../games/types';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { usePlayContext } from './usePlayContext';
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
 */
export function PlayPage() {
  useTitle('Play');
  const [query, setQuery] = useQuery();
  const band = Number(oneOf(query.get('band'), BANDS, '1')) as Band;
  const play = useStore((s) => s.play);
  const ctx = usePlayContext(band, 'check');
  const sealed = GAMES.filter((g) => (play.games[g.id]?.seal ?? 0) > 0).length;

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

      <div className="drill-grid">
        {GAMES.map((g) => {
          const can = !ctx
            ? { ok: false as const, reason: 'Getting ready…' }
            : !g.bands.includes(band)
              ? { ok: false as const, reason: `Only for HSK ${g.bands.join(' and ')}` }
              : g.available(ctx);
          const stats = play.games[g.id];
          const body = (
            <>
              <span className="mark hanzi">{g.mark}</span>
              <span className="name">{g.name}</span>
              <span className="blurb">{g.blurb}</span>
              <span className="figures">
                {can.ok ? (
                  stats ? (
                    <>
                      <i>
                        played {stats.plays}×
                      </i>
                      <i>best {Math.round(stats.best * 100)}%</i>
                    </>
                  ) : (
                    <i>not played yet</i>
                  )
                ) : (
                  <i>{can.reason}</i>
                )}
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
