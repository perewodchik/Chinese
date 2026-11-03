import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { paths } from '../../navigation/paths';
import type { OwnTextDto } from '../../../shared/narration';
import type { EvalStatus } from '../../../shared/speechEval';
import { ownTexts } from '../../api/narration';
import { evalStatus } from '../../api/speechEval';
import { pinyinOf } from '../../domain/ownText';
import { EVERYDAY, partsOf, troubles, type Attempt, type Phrase } from '../../domain/phrases';
import { shelve, type GeneratedText } from '../../domain/text';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { PronunciationKey } from '../settings/PronunciationKey';
import { keepAttempt, loadAttempts, mergedAttempts } from './phraseAttempts';
import { LineStudio } from './LineStudio';
import { band } from './ScoredLine';
import './phrases.css';
import './pinyin.css';



/** What was being said last: a source and a line, to carry on from. */
const LAST = 'hanzi.phrases.last';
interface Last {
  sourceId: string;
  index: number;
}
const loadLast = (): Last | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST) ?? 'null') as Last | null;
  } catch {
    return null;
  }
};
const keepLast = (l: Last) => {
  try {
    localStorage.setItem(LAST, JSON.stringify(l));
  } catch {
    // kept for this visit only
  }
};

/** Something to say line by line: one of the learner's texts, the everyday phrases, or one of their own. */
interface Source {
  id: string;
  title: string;
  sub: string;
  phrases: Phrase[];
}

/**
 * Phrases: choose a text, then say it line by line — each line heard in a
 * narrator's voice, said, and scored by SpeechSuper or iFlytek, then on to the
 * next. Choosing and saying are two screens: the choice is a list of texts by
 * shelf, each with how far it has got; the saying is one line at a time with
 * the whole text's lines as a strip along the top, so it is always clear
 * where in the text you are and what comes next.
 */
export function PhrasesPage() {
  useTitle('Phrases');
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [own, setOwn] = useState<OwnTextDto[] | null>(null);
  // Which text is being said, and where, is in the address: /speaking/say/:source?line=3.
  const navigate = useNavigate();
  const { source: sourceParam } = useParams();
  const [search] = useSearchParams();
  const open: Last | null = sourceParam ? { sourceId: sourceParam, index: Math.max(0, Number(search.get('line') ?? 1) - 1 || 0) } : null;
  const done = search.get('done') === '1';
  const [attempts, setAttempts] = useState(loadAttempts);

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }));
    void ownTexts().then(setOwn, () => setOwn([]));
    // The account's tries, every device's, merged with this one's.
    void mergedAttempts().then((all) => all && setAttempts(all));
  }, []);

  // The shelves as Read has them, chapters in reading order; the shelf read most lately first.
  const shelves = useMemo(() => {
    const source = (t: GeneratedText): Source => ({
      id: t.id,
      title: t.titleZh || t.title,
      sub: t.titleZh && t.title !== t.titleZh ? t.title : '',
      phrases: t.lines.map((l) => ({ zh: l.zh, py: l.py, en: l.en })),
    });
    const { bySet, loose } = shelve(
      texts.filter((t) => t.lines.length),
      sets,
    );
    const lately = (list: GeneratedText[]) => Math.max(...list.map((t) => t.lastReadAt ?? t.createdAt));
    const groups = sets
      .filter((x) => bySet.get(x.id)?.length)
      .map((x) => ({ name: x.name, at: lately(bySet.get(x.id)!), list: bySet.get(x.id)!.map(source) }));
    if (loose.length) groups.push({ name: 'Other texts', at: lately(loose), list: loose.map(source) });
    return groups.sort((x, y) => y.at - x.at);
  }, [texts, sets]);

  const everyday: Source = { id: 'everyday', title: 'Everyday phrases', sub: 'Twenty to start from: greetings, shopping, asking again', phrases: EVERYDAY };
  const owns = useMemo(
    (): Source[] => (own ?? []).map((t) => ({ id: `own:${t.id}`, title: t.title || 'Untitled', sub: 'From Voices', phrases: t.lines.map((zh) => ({ zh, py: pinyinOf(zh, lib), en: '' })) })),
    [own, lib],
  );
  const all = useMemo(() => [...shelves.flatMap((g) => g.list), everyday, ...owns], [shelves, owns]);
  const find = (id: string) => all.find((x) => x.id === id) ?? null;

  const best = (zh: string) => Math.max(-1, ...(attempts[zh] ?? []).map((a) => a.total));
  const progressOf = (src: Source) => {
    const scores = src.phrases.map((p) => best(p.zh)).filter((b) => b >= 0);
    return { said: scores.length, avg: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : -1 };
  };

  function start(src: Source, at?: number) {
    const firstNew = src.phrases.findIndex((p) => !attempts[p.zh]?.length);
    const index = at ?? (firstNew >= 0 ? firstNew : 0);
    keepLast({ sourceId: src.id, index });
    navigate(paths.speakingSay(src.id, index), { replace: Boolean(open) });
  }

  if (status && !status.key.set) {
    if (open) return <Navigate to={paths.speaking()} replace />;
    return (
      <section className="ph">
        <div className="page-head">
          <h1>Phrases</h1>
        </div>
        <p className="small muted ph-lede">
          Choose a text and say it line by line: every syllable is scored — its initial, final and tone — with what to
          change. The scoring is SpeechSuper's or iFlytek's: add your keys once.
        </p>
        <PronunciationKey onChange={setStatus} />
      </section>
    );
  }

  const source = open ? find(open.sourceId) : null;
  if (open && !(source && source.phrases.length)) {
    // Its own texts come from the server: wait for them before saying it is gone.
    if (open.sourceId.startsWith('own:') && own === null) return null;
    return <Navigate to={paths.speaking()} replace />;
  }
  if (open && source) {
    const scores = source.phrases.map((p) => best(p.zh));
    const toTexts = () => navigate(paths.speaking());
    if (done) {
      return <Finished source={source} scores={scores} onAgain={(i) => start(source, i)} onBack={toTexts} />;
    }
    const index = Math.min(open.index, source.phrases.length - 1);
    const go = (i: number) => {
      keepLast({ sourceId: source.id, index: i });
      navigate(paths.speakingSay(source.id, i), { replace: true });
    };
    return (
      <LineStudio
        key={`${source.id}:${index}`}
        phrases={source.phrases}
        index={index}
        title={source.title}
        sourceId={source.id}
        lines={source.phrases.map((p) => p.zh)}
        scores={scores}
        onAttempt={(zh, a, r, id) => setAttempts(keepAttempt(zh, a, source.id, r, id))}
        onGo={go}
        onNext={() => (index + 1 < source.phrases.length ? go(index + 1) : navigate(`${paths.speakingSay(source.id)}?done=1`, { replace: true }))}
        onBack={toTexts}
      />
    );
  }

  const latest = Object.values(attempts)
    .map((list) => list[list.length - 1])
    .filter((a): a is Attempt => Boolean(a));
  const trouble = troubles(latest);
  const last = loadLast();
  const lastSource = last ? find(last.sourceId) : null;

  const row = (src: Source) => {
    const p = progressOf(src);
    return (
      <button key={src.id} className="ph-text" onClick={() => start(src)}>
        <span className="ph-text-name">
          <span className="hanzi ph-text-zh">{src.title}</span>
          <span className="tiny muted ph-text-sub">
            {src.phrases.length} lines{p.said ? ` · ${p.said} said` : ''}
            {src.sub ? ` · ${src.sub}` : ''}
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
    <section className="ph">
      <div className="page-head">
        <h1>Phrases</h1>
        <span className="spacer" />
        <Link className="btn quiet sm" to={paths.speakingHistory()}>
          Your tries
        </Link>
      </div>
      <p className="small muted ph-lede">Choose a text and say it line by line: each line is scored, then on to the next.</p>

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

          {shelves.map((g) => (
            <section key={g.name} className="block">
              <h2 className={`block-title${/\p{Script=Han}/u.test(g.name) ? ' hanzi ph-shelf' : ''}`}>{g.name}</h2>
              <div className="list">{g.list.map(row)}</div>
            </section>
          ))}

          <section className="block">
            <h2 className="block-title">Everyday</h2>
            <div className="list">{row(everyday)}</div>
          </section>

          <section className="block">
            <h2 className="block-title">Your own texts</h2>
            {owns.length ? (
              <div className="list">{owns.map(row)}</div>
            ) : (
              <p className="small muted">{own === null ? 'Getting your texts…' : 'None yet: write one in Voices, and a narrator reads it.'}</p>
            )}
          </section>
        </div>

        <aside className="block ph-aside">
          <h2 className="block-title">What keeps going wrong</h2>
          {trouble.length ? (
            <>
              <p className="small muted" style={{ margin: '0 0 8px' }}>
                From the last time you said each of {latest.length} line{latest.length === 1 ? '' : 's'}.
              </p>
              <ul className="list ph-trouble">
                {trouble.map((t) => (
                  <li key={t.kind} className="ph-trouble-row">
                    <span className="grow">
                      <b>{t.title}</b>
                      <span className="small muted">
                        <span className="hanzi">{t.chars.slice(0, 4).map((c) => `${c.char} ${partsOf(c.symbol).marked}`).join('  ')}</span> — {t.count} time{t.count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="small muted">Nothing yet: say a few lines and what keeps going wrong gathers here.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ a text finished */

function Finished({ source, scores, onAgain, onBack }: { source: Source; scores: number[]; onAgain: (i: number) => void; onBack: () => void }) {
  const said = scores.filter((x) => x >= 0);
  const avg = said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null;
  const weak = scores.findIndex((x) => x >= 0 && x < 75);
  return (
    <section className="ph">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" /> Texts
      </button>
      <div className="page-head">
        <h1 className="hanzi ph-done-title">{source.title}</h1>
      </div>
      <p className="small muted ph-lede">
        {avg === null ? 'Nothing was scored this time.' : `To the end: ${said.length} of ${source.phrases.length} lines said, ${avg} on average.`}
      </p>
      <div className="list">
        {source.phrases.map((p, i) => (
          <button key={i} className="ph-text" onClick={() => onAgain(i)}>
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
        {weak >= 0 && (
          <button className="btn primary lg" onClick={() => onAgain(weak)}>
            Say the weak lines again
          </button>
        )}
        <button className={`btn lg ${weak >= 0 ? 'tonal' : 'primary'}`} onClick={onBack}>
          Choose another text
        </button>
      </div>
    </section>
  );
}

