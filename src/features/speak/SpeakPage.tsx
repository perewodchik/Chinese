import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import type { EvalStatus } from '../../../shared/speechEval';
import { evalStatus } from '../../api/speechEval';
import { partsOf, troubles, type Attempt } from '../../domain/phrases';
import { bestOf, linesWithFault, today, weakLines } from '../../domain/speak';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { NeedsKey } from '../../ui/NeedsKey';
import { keepAttempt, loadAttempts, mergedAttempts } from './attempts';
import { band } from '../pinyin/ScoredLine';
import { armAutoplay, SayLine } from './SayLine';
import { keepSet, useNarrator, useSources, type Source } from './sources';
import { VoiceSheet } from './VoiceSheet';
import '../pinyin/phrases.css';
import './speak.css';
import { accountKey } from '../../platform/accountStorage';

/** Where the learner stopped: a source and a line, to carry on from. */
const LAST = 'hanzi.phrases.last';
interface Last {
  sourceId: string;
  index: number;
}
const loadLast = (): Last | null => {
  try {
    return JSON.parse(localStorage.getItem(accountKey(LAST)) ?? 'null') as Last | null;
  } catch {
    return null;
  }
};
const keepLast = (l: Last) => {
  try {
    localStorage.setItem(accountKey(LAST), JSON.stringify(l));
  } catch {
    // kept for this visit only
  }
};

function useAttempts() {
  const [attempts, setAttempts] = useState(loadAttempts);
  useEffect(() => {
    let live = true;
    void mergedAttempts().then((all) => live && all && setAttempts(all));
    return () => {
      live = false;
    };
  }, []);
  return [attempts, setAttempts] as const;
}

function useEvalStatus() {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }));
  }, []);
  return [status, setStatus] as const;
}

/**
 * The new Speak's first screen: what to do today first — carry on, the lines
 * to say again, the sounds that keep going wrong, each a sitting of its own —
 * then every text to say, by shelf, and who reads them.
 */
export function SpeakHome() {
  useTitle('Speak');
  const navigate = useNavigate();
  const src = useSources();
  const [attempts] = useAttempts();
  const [status] = useEvalStatus();
  const voice = useNarrator();
  const [sheet, setSheet] = useState(false);

  const best = useMemo(() => bestOf(attempts), [attempts]);
  const progressOf = (s: Source) => {
    const said = s.phrases.map((p) => best.get(p.zh)).filter((b): b is number => b !== undefined);
    return { said: said.length, avg: said.length ? said.reduce((x, y) => x + y, 0) / said.length : -1 };
  };
  const weak = useMemo(() => weakLines(attempts), [attempts]);
  const latest = useMemo(
    () =>
      Object.values(attempts)
        .map((l) => l[l.length - 1])
        .filter((a): a is Attempt => Boolean(a)),
    [attempts],
  );
  const trouble = useMemo(() => troubles(latest, 4), [latest]);
  const day = useMemo(() => today(attempts), [attempts]);
  const last = loadLast();
  const lastSource = last ? src.find(last.sourceId) : null;

  function start(s: Source, at?: number) {
    const firstNew = s.phrases.findIndex((p) => !best.has(p.zh));
    const index = at ?? (firstNew >= 0 ? firstNew : 0);
    keepLast({ sourceId: s.id, index });
    armAutoplay();
    navigate(paths.speakingSay(s.id, index));
  }
  function startSet(id: string, title: string, sub: string, lines: string[]) {
    keepSet(id, { title, sub, lines });
    const s = src.find(id);
    if (s) start(s, 0);
  }


  const row = (s: Source) => {
    const p = progressOf(s);
    return (
      <button key={s.id} className="ph-text" onClick={() => start(s)}>
        <span className="ph-text-name">
          <span className="hanzi ph-text-zh">{s.title}</span>
          <span className="tiny muted ph-text-sub">
            {s.phrases.length} line{s.phrases.length === 1 ? '' : 's'}
            {p.said ? ` · ${p.said} said` : ''}
            {s.sub ? ` · ${s.sub}` : ''}
          </span>
        </span>
        <span className="ph-score" data-band={p.avg < 0 ? 'none' : band(p.avg)}>
          {p.avg < 0 ? 'New' : Math.round(p.avg)}
        </span>
        <Icon name="chevron" className="muted" />
      </button>
    );
  };

  return (
    <section className="ph sk-home">
      <div className="page-head">
        <h1>Phrases</h1>
        <span className="spacer" />
        <Link className="btn quiet sm" to={paths.speakingHistory()}>
          Your tries
        </Link>
      </div>
      <p className="small muted ph-lede">
        Hear a line, say it, fix the words that were off.{' '}
        {day.said ? `Today: ${day.said} line${day.said === 1 ? '' : 's'} said${day.green ? `, ${day.green} of them green` : ''}.` : ''}
      </p>
      {status && !status.key.set && (
        <NeedsKey to={paths.settings()} action="Add the keys in Settings">
          You can hear every line and say it back; scoring each syllable needs your own SpeechSuper keys.
        </NeedsKey>
      )}

      <div className="ph-columns">
        <div>
          {lastSource && last && (
            <section className="ph-continue">
              <span className="ph-text-name">
                <span className="small muted">Where you stopped</span>
                <span className="hanzi ph-text-zh">{lastSource.title}</span>
                <span className="tiny muted">
                  Line {Math.min(last.index, lastSource.phrases.length - 1) + 1} of {lastSource.phrases.length}
                </span>
              </span>
              <button className="btn primary" onClick={() => start(lastSource, Math.min(last.index, lastSource.phrases.length - 1))}>
                Carry on
              </button>
            </section>
          )}

          {(weak.length > 0 || trouble.length > 0) && (
            <section className="block">
              <h2 className="block-title">To work on</h2>
              <div className="list">
                {weak.length > 0 && (
                  <button className="ph-text" onClick={() => startSet('weak', 'Lines to say again', 'Under 75 last time', weak)}>
                    <span className="ph-text-name">
                      <b>Lines to say again</b>
                      <span className="tiny muted ph-text-sub">
                        {weak.length} line{weak.length === 1 ? '' : 's'} not yet green, the latest first
                      </span>
                    </span>
                    <Icon name="chevron" className="muted" />
                  </button>
                )}
                {trouble.map((t) => {
                  const lines = linesWithFault(attempts, t.kind);
                  if (!lines.length) return null;
                  return (
                    <button key={t.kind} className="ph-text" onClick={() => startSet(`fault:${t.kind}`, t.title, `${lines.length} lines with it`, lines)}>
                      <span className="ph-text-name">
                        <b>{t.title}</b>
                        <span className="tiny muted ph-text-sub">
                          <span className="hanzi">{t.chars.slice(0, 4).map((c) => `${c.char} ${partsOf(c.symbol).marked}`).join('  ')}</span> · {lines.length} line{lines.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <Icon name="chevron" className="muted" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {src.shelves.map((g) => (
            <section key={g.name} className="block">
              <h2 className={`block-title${/\p{Script=Han}/u.test(g.name) ? ' hanzi ph-shelf' : ''}`}>{g.name}</h2>
              <div className="list">{g.list.map(row)}</div>
            </section>
          ))}

          <section className="block">
            <h2 className="block-title">Everyday</h2>
            <div className="list">{row(src.everyday)}</div>
          </section>

          {/* Shown once there is one: an empty block with nothing to do in it is not shown (guidelines). */}
          {src.owns.length > 0 && (
            <section className="block">
              <h2 className="block-title">Your own texts</h2>
              <div className="list">{src.owns.map(row)}</div>
            </section>
          )}
        </div>

        <aside className="block ph-aside">
          <h2 className="block-title">The voice</h2>
          <div className="list">
            <button className="ph-text" onClick={() => setSheet(true)} disabled={voice.list === null}>
              <span className="ph-text-name">
                <b>{voice.narrator?.name ?? (voice.list === null ? 'Finding your narrator…' : 'No narrator yet')}</b>
                <span className="tiny muted ph-text-sub">{voice.narrator ? 'Reads every line for you to copy, and slowly' : voice.failed ?? 'Make one in Voices, with your MiniMax key'}</span>
              </span>
              <Icon name="chevron" className="muted" />
            </button>
          </div>
        </aside>
      </div>
      {sheet && <VoiceSheet list={voice.list ?? []} current={voice.narrator} wholeIds={[]} failed={voice.failed} onChoose={voice.choose} onClose={() => setSheet(false)} />}
    </section>
  );
}

/** A text, or a set made for a sitting, said line by line on the whole screen: /speaking/say/:source?line=3. */
export function SpeakSay() {
  useTitle('Speak');
  const navigate = useNavigate();
  const { source: id } = useParams();
  const [search] = useSearchParams();
  const src = useSources();
  const [attempts, setAttempts] = useAttempts();
  const [status] = useEvalStatus();
  const best = useMemo(() => bestOf(attempts), [attempts]);
  const done = search.get('done') === '1';
  const asked = Math.max(0, Number(search.get('line') ?? 1) - 1 || 0);

  const source = id ? src.find(id) : null;
  if (!source || !source.phrases.length) {
    // Its own texts come from the server: wait for them before saying it is gone.
    if (id?.startsWith('own:') && !src.ownLoaded) return null;
    return <Navigate to={paths.speaking()} replace />;
  }
  const scores = source.phrases.map((p) => best.get(p.zh) ?? -1);
  const toHome = () => navigate(paths.speaking());
  const go = (i: number) => {
    keepLast({ sourceId: source.id, index: i });
    navigate(paths.speakingSay(source.id, i), { replace: true });
  };

  if (done) {
    return (
      <Finished
        source={source}
        scores={scores}
        onAgain={(lines) => {
          keepSet(`again:${source.id}`, { title: source.title, sub: 'The lines not yet green', lines });
          armAutoplay();
          navigate(paths.speakingSay(`again:${source.id}`, 0), { replace: true });
        }}
        onLine={(i) => {
          armAutoplay();
          go(i);
        }}
        onBack={toHome}
      />
    );
  }

  const index = Math.min(asked, source.phrases.length - 1);
  const zh = source.phrases[index]!.zh;
  return (
    <SayLine
      key={`${source.id}:${index}`}
      source={source}
      index={index}
      scores={scores}
      tries={attempts[zh] ?? []}
      onAttempt={(line, a, r, attemptIdOf) => setAttempts(keepAttempt(line, a, source.id, r, attemptIdOf))}
      onGo={go}
      onNext={() => (index + 1 < source.phrases.length ? go(index + 1) : navigate(`${paths.speakingSay(source.id)}?done=1`, { replace: true }))}
      onBack={toHome}
      canScore={!status || status.key.set}
    />
  );
}

/** A text said to the end: how it went, every line's number, and the lines not yet green to say again. */
function Finished({ source, scores, onAgain, onLine, onBack }: { source: Source; scores: number[]; onAgain: (lines: string[]) => void; onLine: (i: number) => void; onBack: () => void }) {
  const said = scores.filter((x) => x >= 0);
  const avg = said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null;
  const weak = source.phrases.filter((_, i) => scores[i]! >= 0 && scores[i]! < 75).map((p) => p.zh);
  const green = scores.filter((x) => x >= 75).length;
  return (
    <section className="ph sk-done">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" /> Phrases
      </button>
      <div className="page-head">
        <h1 className="hanzi ph-done-title">{source.title}</h1>
      </div>
      <p className="small muted ph-lede">
        {avg === null ? 'Nothing was scored this time.' : `To the end: ${green} of ${source.phrases.length} lines green, ${avg} on average.`}
      </p>
      <div className="list">
        {source.phrases.map((p, i) => (
          <button key={i} className="ph-text" onClick={() => onLine(i)}>
            <span className="tiny muted ph-n">{i + 1}</span>
            <span className="ph-text-name">
              <span className="hanzi ph-line-zh">{p.zh}</span>
            </span>
            <span className="ph-score" data-band={scores[i]! < 0 ? 'none' : band(scores[i]!)}>
              {scores[i]! < 0 ? '–' : Math.round(scores[i]!)}
            </span>
          </button>
        ))}
      </div>
      <div className="page-foot ph-foot">
        {weak.length > 0 && (
          <button className="btn primary lg" onClick={() => onAgain(weak)}>
            Say the {weak.length} line{weak.length === 1 ? '' : 's'} not yet green
          </button>
        )}
        <button className={`btn lg ${weak.length ? 'tonal' : 'primary'}`} onClick={onBack}>
          Back to Phrases
        </button>
      </div>
    </section>
  );
}
