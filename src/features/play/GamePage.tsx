import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { finishGame } from '../../store/commands';
import { keepMenuWords } from '../../store/wordCommands';
import { gameById } from '../../games/registry';
import { Photo } from '../../games/kit/Photo';
import { newSeed } from '../../games/kit/rng';
import { Seal } from '../../games/kit/Seal';
import type { Band, GameManifest, RoundResult, WordHost } from '../../games/types';
import { sealFor, type GameStats } from '../../domain/play';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { Say } from '../../ui/Say';
import { useTitle } from '../../ui/useTitle';
import { useWordKnowledge } from '../words/useWordKnowledge';
import { usePlayContext } from './usePlayContext';
import '../../games/kit/kit.css';

/**
 * One round of one game.
 *
 *   /play/:gameId?band=1&seed=k3f9
 *
 * The host around every game: it finds the game in the registry, loads its
 * code, hands it a context built from the seed in the address (so a reload
 * replays the same round), draws the frame and the progress, and when the
 * game says it is over, records it and shows the results — the seal, and
 * every prompt missed with its answer to look at again.
 */
export function GamePage() {
  const { gameId } = useParams();
  const game = gameById(gameId);
  if (!game) {
    return (
      <div className="empty">
        <span className="big">玩</span>
        There is no game called “{gameId}”.
        <div style={{ marginTop: 12 }}>
          <Link className="btn" to={paths.play()}>
            All games
          </Link>
        </div>
      </div>
    );
  }
  return <Host game={game} />;
}

const loaded = new Map<string, ReturnType<typeof lazy>>();
function componentOf(game: GameManifest) {
  let c = loaded.get(game.id);
  if (!c) {
    c = lazy(game.load);
    loaded.set(game.id, c);
  }
  return c;
}

function Host({ game }: { game: GameManifest }) {
  useTitle(game.name);
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const band = Number(oneOf(query.get('band'), ['1', '2'], String(game.bands[0]))) as Band;
  const seed = query.get('seed');

  // A round without a seed gets one, written into the address so a reload replays it.
  useEffect(() => {
    if (!seed) setQuery('seed', newSeed());
  }, [seed, setQuery]);

  const ctx = usePlayContext(band, seed ?? 'waiting');
  const Game = componentOf(game);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [over, setOver] = useState(false);
  const recorded = useRef(false);
  const stats = useStore((s) => s.play.games[game.id]);
  // What the record was before this round, and when it began — for the results.
  const before = useRef(stats);
  const started = useRef(Date.now());
  const [took, setTook] = useState(0);

  // A new seed is a new round.
  useEffect(() => {
    setResults([]);
    setOver(false);
    recorded.current = false;
    started.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, band]);

  const report = useCallback((r: RoundResult) => setResults((rs) => [...rs, r]), []);
  const finish = useCallback(() => setOver(true), []);

  // The word drawer opens over the game (it lives in the address, beside the
  // seed), so a word met mid-order can be kept without leaving the order.
  const openItem = useOpenItem();
  const knowledge = useWordKnowledge();
  const words = useMemo<WordHost>(
    () => ({
      open: openItem,
      status: knowledge.status,
      keepList: keepMenuWords,
      openList: (id) => navigate(paths.collection(id)),
    }),
    [openItem, knowledge, navigate],
  );

  useEffect(() => {
    if (!over || recorded.current || !results.length) return;
    recorded.current = true;
    before.current = stats;
    setTook(Math.round((Date.now() - started.current) / 1000));
    finishGame(
      game.id,
      results.filter((r) => r.firstTry).length,
      results.length,
      results.flatMap((r) => r.items),
    );
  }, [over, results, game.id]);

  const can = useMemo(() => (ctx ? game.available(ctx) : null), [ctx, game]);
  const again = () => navigate(paths.game(game.id, band, newSeed()), { replace: true });
  const leave = useCallback(() => navigate(paths.play(band)), [navigate, band]);

  return (
    <div className="game-page" data-game={game.id}>
      <header className="game-head">
        <Link className="btn ghost sm" to={paths.play(band)} aria-label="Leave the game">
          ✕
        </Link>
        <span className="game-name">
          <span className="hanzi">{game.mark}</span> {game.name}
        </span>
        <span className="game-dots" aria-label={`${results.length} of ${game.rounds} done`}>
          {Array.from({ length: game.rounds }, (_, i) => (
            <i key={i} data-state={results[i] ? (results[i].firstTry ? 'right' : results[i].correct ? 'nearly' : 'wrong') : undefined} />
          ))}
        </span>
      </header>

      {!ctx || !seed ? (
        <div className="game-stage game-wait" aria-hidden />
      ) : can && !can.ok ? (
        <div className="empty">
          <span className="big">空</span>
          {can.reason}
        </div>
      ) : over ? (
        <Results game={game} results={results} onAgain={again} band={band} seconds={took} before={before.current} />
      ) : (
        <Suspense fallback={<div className="game-stage game-wait" aria-hidden />}>
          <div className="game-stage">
            <Game key={`${seed}-${band}`} ctx={ctx} rounds={game.rounds} report={report} finish={finish} words={words} leave={leave} />
          </div>
        </Suspense>
      )}
    </div>
  );
}

function Results({
  game,
  results,
  onAgain,
  band,
  seconds,
  before,
}: {
  game: GameManifest;
  results: RoundResult[];
  onAgain: () => void;
  band: Band;
  seconds: number;
  /** the record before this round, if the game had been played */
  before: GameStats | undefined;
}) {
  const lib = useLibrary();
  const first = results.filter((r) => r.firstTry).length;
  const second = results.filter((r) => r.correct && !r.firstTry).length;
  const missed = results.filter((r) => !r.correct).length;
  const share = results.length ? first / results.length : 0;
  const seal = sealFor(share);
  const best = before?.best ?? null;
  const verdict =
    seal === 3
      ? 'Every one right first time. The gold seal is yours.'
      : seal === 2
        ? 'A clear seal — only a few slipped.'
        : seal === 1
          ? 'A faint seal. Another round will make it clearer.'
          : 'No seal this time. The ones marked below are worth another look.';
  const compared =
    best === null
      ? 'Your first round of this game.'
      : share > best
        ? `A new best — up from ${Math.round(best * 100)}%.`
        : share === best
          ? `The same as your best, ${Math.round(best * 100)}%.`
          : `Your best is ${Math.round(best * 100)}%.`;
  // the ones that went wrong first, so what needs another look is on top
  const order = [...results.keys()].sort(
    (a, b) => rank(results[a]) - rank(results[b]) || a - b,
  );

  return (
    <div className="game-results">
      <Seal mark={game.mark} level={seal} size={112} />
      <h2>
        {first} of {results.length} first time
      </h2>
      <p className="game-results-verdict">{verdict}</p>

      <dl className="game-results-stats">
        <div data-kind="first">
          <dt>First time</dt>
          <dd>{first}</dd>
        </div>
        <div data-kind="second">
          <dt>Second try</dt>
          <dd>{second}</dd>
        </div>
        <div data-kind="missed">
          <dt>Missed</dt>
          <dd>{missed}</dd>
        </div>
      </dl>
      <p className="tiny muted game-results-meta">
        {Math.round(share * 100)}% · {clock(seconds)} · {compared}
        {before ? ` Played ${before.plays + 1} times.` : ''}
      </p>

      <div className="game-results-actions">
        <button type="button" className="btn primary" onClick={onAgain} autoFocus>
          Play again
        </button>
        <Link className="btn" to={paths.play(band)}>
          Another game
        </Link>
      </div>

      <section className="game-review" aria-label="Every prompt in this round">
        <h3 className="game-review-title">This round, one by one</h3>
        <ul>
          {order.map((i) => {
            const r = results[i];
            // the answer when it is a word; otherwise the word the prompt was about
            const word = lib.byWord.has(r.answer)
              ? r.answer
              : (r.items.find((id) => id.startsWith('w'))?.slice(1) ?? r.answer);
            const info = lib.byWord.get(word);
            const state = r.firstTry ? 'right' : r.correct ? 'nearly' : 'wrong';
            return (
              <li key={i} data-state={state}>
                <Photo word={word} />
                <span className="game-review-text">
                  <span className="hanzi">{r.answer}</span>
                  <span className="game-review-py">{info && info.w === r.answer ? info.py : '\u00a0'}</span>
                  <span className="tiny muted">{info && info.w === r.answer ? `${r.prompt} · ${info.d.split(';')[0]}` : r.prompt}</span>
                </span>
                <span className="game-review-mark" aria-label={STATE_LABEL[state]}>
                  {state === 'right' ? '✓' : state === 'nearly' ? '2nd' : '✗'}
                </span>
                <Say text={r.answer} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const STATE_LABEL = { right: 'right first time', nearly: 'right on the second try', wrong: 'missed' } as const;

const rank = (r: RoundResult) => (r.correct ? (r.firstTry ? 2 : 1) : 0);

/** 1:05 */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
