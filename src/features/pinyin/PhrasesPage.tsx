import { useEffect, useMemo, useState } from 'react';
import type { NarratorDto, OwnTextDto } from '../../../shared/narration';
import type { EvalResult, EvalStatus } from '../../../shared/speechEval';
import { chosenNarrator, listNarrators, narrationOf, ownTexts } from '../../api/narration';
import { evalStatus, evaluatePhrase } from '../../api/speechEval';
import { pinyinOf } from '../../domain/ownText';
import { attemptOf, EVERYDAY, faultsOf, partsOf, troubles, verdictOf, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { isHanzi } from '../../domain/text';
import { playSamples } from '../../platform/audio/voiceOut';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { lastReading } from '../reader/lastRead';
import { addReading, narratedReadings, playLine, prepareClips, stopLine, type Clips } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { PronunciationKey } from '../settings/PronunciationKey';
import { RecordButton } from './RecordButton';
import { useRecorder } from './useRecorder';
import './phrases.css';
import './pinyin.css';

type Source = 'texts' | 'everyday' | 'own';

/* ------------------------------------------------------------ attempts, kept on this device */

const KEPT = 'hanzi.phrases.attempts';
const loadAttempts = (): Record<string, Attempt[]> => {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, Attempt[]>;
  } catch {
    return {};
  }
};
function keepAttempt(zh: string, a: Attempt): Record<string, Attempt[]> {
  const all = loadAttempts();
  all[zh] = [...(all[zh] ?? []), a].slice(-5);
  try {
    localStorage.setItem(KEPT, JSON.stringify(all));
  } catch {
    // kept for this visit only
  }
  return all;
}

const band = (score: number) => (score >= 75 ? 'good' : score >= 60 ? 'mid' : 'low');

/**
 * Phrases: a phrase heard in a narrator's voice, said, and scored by iFlytek —
 * the whole (tones, sounds, flow, what was left out) and every syllable — with
 * what to change, how the right sound is made, and what keeps going wrong
 * across everything said. The phrases come from the learner's texts, a set of
 * everyday ones, or their own texts in Voices.
 */
export function PhrasesPage() {
  useTitle('Phrases');
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [source, setSource] = useState<Source>('texts');
  const [textId, setTextId] = useState<string | null>(() => lastReading()?.textId ?? null);
  const [own, setOwn] = useState<OwnTextDto[] | null>(null);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(loadAttempts);

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null }, strictness: 'common' }));
  }, []);
  useEffect(() => {
    if (source !== 'own' || own) return;
    void ownTexts().then(
      (list) => {
        setOwn(list);
        setOwnId((id) => id ?? list[0]?.id ?? null);
      },
      () => setOwn([]),
    );
  }, [source, own]);

  const choosable = useMemo(() => [...texts].filter((t) => t.lines.length).sort((a, b) => (b.lastReadAt ?? b.createdAt) - (a.lastReadAt ?? a.createdAt)), [texts]);
  const text = choosable.find((t) => t.id === textId) ?? choosable[0] ?? null;
  const ownText = own?.find((t) => t.id === ownId) ?? own?.[0] ?? null;

  const { phrases, title, sourceId } = useMemo((): { phrases: Phrase[]; title: string; sourceId: string } => {
    if (source === 'everyday') return { phrases: EVERYDAY, title: 'Everyday phrases', sourceId: 'everyday' };
    if (source === 'own') {
      return { phrases: (ownText?.lines ?? []).map((zh) => ({ zh, py: pinyinOf(zh, lib), en: '' })), title: ownText?.title ?? 'My own', sourceId: `own:${ownText?.id ?? ''}` };
    }
    return { phrases: (text?.lines ?? []).map((l) => ({ zh: l.zh, py: l.py, en: l.en })), title: text?.titleZh || text?.title || '', sourceId: text?.id ?? '' };
  }, [source, text, ownText, lib]);

  useEffect(() => setCurrent(null), [sourceId]);

  if (status && !status.key.set) {
    return (
      <section className="ph">
        <div className="page-head">
          <h1>Phrases</h1>
        </div>
        <p className="small muted ph-lede">
          Say a phrase and see every syllable scored — its initial, final and tone — with what to change. The scoring is
          iFlytek's: add your keys once.
        </p>
        <PronunciationKey onChange={setStatus} />
      </section>
    );
  }

  if (current !== null && phrases[current]) {
    return (
      <PhraseView
        key={`${sourceId}:${current}`}
        phrases={phrases}
        index={current}
        title={title}
        sourceId={sourceId}
        lines={phrases.map((p) => p.zh)}
        tryAgain={attempts[phrases[current]!.zh] ?? []}
        onAttempt={(zh, a) => setAttempts(keepAttempt(zh, a))}
        onGo={(i) => setCurrent(i)}
        onBack={() => setCurrent(null)}
      />
    );
  }

  const latest = Object.values(attempts)
    .map((list) => list[list.length - 1])
    .filter((a): a is Attempt => Boolean(a));
  const trouble = troubles(latest);
  const best = (zh: string) => Math.max(-1, ...(attempts[zh] ?? []).map((a) => a.total));
  const firstNew = phrases.findIndex((p) => !(attempts[p.zh]?.length));

  return (
    <section className="ph">
      <div className="page-head">
        <h1>Phrases</h1>
        <span className="spacer" />
        <div className="seg sm" role="group" aria-label="Where the phrases come from">
          {(
            [
              ['texts', 'My texts'],
              ['everyday', 'Everyday'],
              ['own', 'My own'],
            ] as const
          ).map(([id, name]) => (
            <button key={id} aria-pressed={source === id} onClick={() => setSource(id)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="ph-columns">
        <div className="ph-list-col">
          {source === 'texts' && (
            <select className="ph-pick" value={text?.id ?? ''} onChange={(e) => setTextId(e.target.value)} aria-label="Text">
              {sets
                .map((s) => ({ s, list: choosable.filter((t) => t.setId === s.id) }))
                .filter((g) => g.list.length)
                .map(({ s, list }) => (
                  <optgroup key={s.id} label={s.name}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titleZh || t.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          )}
          {source === 'own' &&
            (own && own.length ? (
              <select className="ph-pick" value={ownText?.id ?? ''} onChange={(e) => setOwnId(e.target.value)} aria-label="Your text">
                {own.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="small muted">{own === null ? 'Getting your texts…' : 'No texts of your own yet: write one in Voices, and a narrator reads it.'}</p>
            ))}

          <ul className="list ph-list">
            {phrases.map((p, i) => {
              const b = best(p.zh);
              return (
                <li key={`${i}-${p.zh}`}>
                  <button className="ph-row" onClick={() => setCurrent(i)}>
                    <span className="tiny muted ph-n">{i + 1}</span>
                    <span className="ph-row-text">
                      <span className="hanzi ph-row-zh">{p.zh}</span>
                      {p.en && <span className="tiny muted ph-row-en">{p.en}</span>}
                    </span>
                    <span className="ph-score" data-band={b < 0 ? 'none' : band(b)}>
                      {b < 0 ? 'New' : Math.round(b)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {phrases.length > 0 && (
            <div className="ph-start">
              <button className="btn primary" onClick={() => setCurrent(firstNew >= 0 ? firstNew : 0)}>
                {firstNew >= 0 ? `Start with line ${firstNew + 1}` : 'Start again from the top'}
              </button>
            </div>
          )}
        </div>

        <aside className="ph-trouble-col">
          <h2 className="block-title">What keeps going wrong</h2>
          {trouble.length ? (
            <>
              <p className="small muted" style={{ margin: '0 0 8px' }}>
                From the last time you said each of {latest.length} phrase{latest.length === 1 ? '' : 's'}.
              </p>
              <ul className="list ph-trouble">
                {trouble.map((t) => {
                  const at = phrases.findIndex((p) => t.chars.some((c) => p.zh.includes(c.char)));
                  return (
                    <li key={t.kind} className="ph-trouble-row">
                      <span className="grow">
                        <b>{t.title}</b>
                        <span className="small muted">
                          <span className="hanzi">{t.chars.slice(0, 4).map((c) => `${c.char} ${partsOf(c.symbol).marked}`).join(' · ')}</span> — {t.count} time{t.count === 1 ? '' : 's'}
                        </span>
                      </span>
                      {at >= 0 && (
                        <button className="btn sm" onClick={() => setCurrent(at)}>
                          Practise
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="small muted">Nothing yet: say a few phrases and what keeps going wrong gathers here.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ one phrase */

interface Tile {
  char: string;
  py: string;
  /** the syllable iFlytek scored for it, in the latest try */
  i: number | null;
}

function PhraseView({
  phrases,
  index,
  title,
  sourceId,
  lines,
  tryAgain,
  onAttempt,
  onGo,
  onBack,
}: {
  phrases: Phrase[];
  index: number;
  title: string;
  sourceId: string;
  lines: string[];
  tryAgain: Attempt[];
  onAttempt: (zh: string, a: Attempt) => void;
  onGo: (i: number) => void;
  onBack: () => void;
}) {
  const lib = useLibrary();
  const phrase = phrases[index]!;
  const [result, setResult] = useState<EvalResult | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [clips, setClips] = useState<Clips | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [reading, setReading] = useState(false);
  const [readingFailed, setReadingFailed] = useState<string | null>(null);

  // The example: this phrase cut from a narrator's reading of the lines it is among.
  useEffect(() => {
    let live = true;
    void narratedReadings(lines).then(async (list) => {
      const c = chosenNarrator();
      const r = list.find((x) => x.n.narratorId === c) ?? list[0];
      if (r && live) setClips(await prepareClips(sourceId, r));
      else if (live) void listNarrators().then((n) => live && setNarrators(n), () => live && setNarrators([]));
    }, () => undefined);
    return () => {
      live = false;
      stopLine();
    };
  }, [lines, sourceId]);

  async function readThem() {
    const n = narrators?.find((x) => x.id === chosenNarrator()) ?? narrators?.[0];
    if (!n) return;
    setReading(true);
    setReadingFailed(null);
    try {
      const made = await narrationOf(n.id, lines, { generate: true });
      if (made) {
        const r = { n: made, name: n.name };
        addReading(lines, r);
        setClips(await prepareClips(sourceId, r));
      }
    } catch (err) {
      setReadingFailed(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setReading(false);
    }
  }

  const recorder = useRecorder((s) => {
    setSamples(s);
    setChecking(true);
    setError(null);
    evaluatePhrase(phrase.zh, s).then(
      (r) => {
        setResult(r);
        setPicked(null);
        onAttempt(phrase.zh, attemptOf(r, Date.now()));
      },
      (err: Error) => setError(err.message),
    ).finally(() => setChecking(false));
  }, 15_000);

  // The phrase's characters with their pinyin, and which scored syllable each one is.
  const tiles = useMemo((): Tile[] => {
    const py = alignPinyin({ zh: phrase.zh, py: phrase.py }, lib);
    let k = 0;
    let s = 0;
    const scored = (result?.syllables ?? []).filter((x) => x.said !== 'added');
    return [...phrase.zh].map((char) => {
      if (!isHanzi(char)) return { char, py: '', i: null };
      const t: Tile = { char, py: py[k++] ?? '', i: null };
      // Scored syllables follow the characters in order; one is matched to a character only when it is that character.
      while (s < scored.length && scored[s]!.char !== char) s++;
      if (s < scored.length) {
        t.i = result!.syllables.indexOf(scored[s]!);
        s++;
      }
      return t;
    });
  }, [phrase, lib, result]);

  const verdict = result ? verdictOf(result) : null;
  const firstWrong = result ? tiles.findIndex((t) => t.i !== null && faultsOf(result.syllables[t.i]!).length > 0) : -1;
  const sel = picked ?? (firstWrong >= 0 ? firstWrong : null);
  const selTile = sel !== null ? tiles[sel] : null;
  const selSyl = selTile?.i != null && result ? result.syllables[selTile.i]! : null;
  const selFaults = selSyl ? faultsOf(selSyl) : [];
  const state = checking ? 'checking' : recorder.state;
  const scores = result
    ? [
        ['Tones', result.tone],
        ['Initials, finals', result.sounds],
        ['Fluency', result.fluency],
        ['Completeness', result.completeness],
      ]
    : null;

  return (
    <section className="ph ph-view">
      <div className="ph-view-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to the phrases">
          <Icon name="back" />
        </button>
        <span className="ph-view-title">
          <span className="hanzi">{title}</span>
          <span className="tiny muted">
            Line {index + 1} of {phrases.length}
          </span>
        </span>
        <button className="icon-btn" onClick={() => onGo(index - 1)} disabled={index === 0} aria-label="Previous phrase">
          <Icon name="prev" />
        </button>
        <button className="icon-btn" onClick={() => onGo(index + 1)} disabled={index >= phrases.length - 1} aria-label="Next phrase">
          <Icon name="next" />
        </button>
      </div>

      <div className="ph-phrase" aria-label={phrase.zh}>
        {tiles.map((t, i) => {
          const syl = t.i !== null && result ? result.syllables[t.i]! : null;
          const faults = syl ? faultsOf(syl) : [];
          if (!t.py) {
            return (
              <span key={i} className="ph-punct hanzi">
                {t.char}
              </span>
            );
          }
          const mark = !result ? '' : !syl ? '' : faults.length === 0 ? '' : faults[0]!.kind.startsWith('tone') ? 'tone' : faults[0]!.kind === 'missed' ? 'missed' : faults[0]!.kind.startsWith('initial') || faults[0]!.kind.startsWith('final') ? 'sound' : 'extra';
          return (
            <button
              key={i}
              className="ph-tile"
              data-state={!result || !syl ? undefined : faults.length ? 'bad' : 'ok'}
              aria-pressed={sel === i}
              onClick={() => setPicked(i)}
              disabled={!result}
            >
              <span className="ph-tile-py">{t.py}</span>
              <span className="ph-tile-zh hanzi">{t.char}</span>
              <span className="ph-tile-mark">{mark}</span>
            </button>
          );
        })}
      </div>
      {phrase.en && <p className="ph-en">{phrase.en}</p>}

      <div className="ph-controls">
        <div className="ph-hear">
          <button className="btn" onClick={() => clips && playLine(clips, index, 1)} disabled={!clips}>
            <Icon name="play" size={18} /> Hear it
          </button>
          <button className="btn quiet" onClick={() => clips && playLine(clips, index, 0.75)} disabled={!clips}>
            Slowly
          </button>
        </div>
        <RecordButton state={state} level={recorder.level} onToggle={recorder.toggle} />
        <div className="ph-hear">
          <button className="btn quiet" onClick={() => samples && void playSamples(samples)} disabled={!samples}>
            Hear yours
          </button>
        </div>
      </div>
      {!clips && narrators !== null && (
        <p className="small muted ph-note">
          {narrators.length === 0 ? (
            'No narrator has read these yet. Make one in Voices, and it reads them for you to copy.'
          ) : (
            <>
              No narrator has read these yet.{' '}
              <button className="btn quiet sm" onClick={() => void readThem()} disabled={reading}>
                {reading ? 'Reading… up to a minute' : `Have ${narrators.find((x) => x.id === chosenNarrator())?.name ?? narrators[0]!.name} read them`}
              </button>{' '}
              Once, with MiniMax; kept after.
            </>
          )}
          {readingFailed && <span className="ph-error"> {readingFailed}</span>}
        </p>
      )}
      {(error || recorder.error) && (
        <p className="narrator-error ph-error-box" role="alert">
          {error ?? recorder.error}
        </p>
      )}

      {result && verdict && scores && (
        <div className="ph-result">
          <section className="ph-card">
            <div className="ph-total">
              <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${Math.round(result.total)} out of 100`}>
                <circle cx="38" cy="38" r="32" fill="none" stroke="var(--line)" strokeWidth="8" />
                <circle
                  cx="38"
                  cy="38"
                  r="32"
                  fill="none"
                  stroke={`var(--${result.total >= 75 ? 'jade' : result.total >= 60 ? 'gold' : 'red'})`}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="201"
                  strokeDashoffset={201 * (1 - Math.min(100, result.total) / 100)}
                  transform="rotate(-90 38 38)"
                />
                <text x="38" y="45" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--ink)">
                  {Math.round(result.total)}
                </text>
              </svg>
              <span className="ph-verdict">
                <b>{verdict.headline}</b>
                <span className="small muted">{verdict.detail}</span>
              </span>
            </div>
            {scores.map(([name, score]) => (
              <div key={name as string} className="ph-meter">
                <span>{name}</span>
                <span className="ph-bar">
                  <i style={{ width: `${Math.min(100, score as number)}%`, background: `var(--${band(score as number) === 'good' ? 'jade' : band(score as number) === 'mid' ? 'gold' : 'red'})` }} />
                </span>
                <b>{Math.round(score as number)}</b>
              </div>
            ))}
            {tryAgain.length > 1 && (
              <div className="ph-tries">
                <span className="tiny muted">Your tries</span>
                {tryAgain.map((a, i) => (
                  <span key={a.at} className="ph-try" data-last={i === tryAgain.length - 1 || undefined}>
                    {Math.round(a.total)}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="ph-card ph-detail">
            {selTile && selSyl ? (
              <>
                <div className="ph-detail-head">
                  <span className="hanzi ph-detail-zh" data-state={selFaults.length ? 'bad' : 'ok'}>
                    {selTile.char}
                  </span>
                  <b className="ph-detail-py">{selTile.py}</b>
                  <span className="small ph-detail-verdict" data-state={selFaults.length ? 'bad' : 'ok'}>
                    {selFaults.length ? selFaults.map((f) => f.title).join(' · ') : 'Said well'}
                  </span>
                </div>
                {selFaults.length ? (
                  <ul className="ph-faults">
                    {selFaults.map((f) => (
                      <li key={f.kind}>{f.how}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    Initial, final and tone as they should be.
                  </p>
                )}
                <div className="ph-detail-actions">
                  <button className="btn quiet" onClick={() => clips && playLine(clips, index, 0.75)} disabled={!clips}>
                    Hear the phrase slowly
                  </button>
                  <button
                    className="btn quiet"
                    disabled={!samples || selSyl.to <= selSyl.from}
                    onClick={() => samples && void playSamples(samples.subarray(Math.floor((selSyl.from / 1000) * 16000), Math.ceil((selSyl.to / 1000) * 16000)))}
                  >
                    Hear your {selTile.char}
                  </button>
                </div>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {result.syllables.length ? 'Tap a character to see how it was said.' : 'iFlytek heard no syllables: say the whole phrase, clearly, close to the microphone.'}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
