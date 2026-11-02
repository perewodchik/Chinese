import { useEffect, useMemo, useRef, useState } from 'react';
import type { NarratorDto, OwnTextDto } from '../../../shared/narration';
import type { EvalResult, EvalStatus, SyllableEval } from '../../../shared/speechEval';
import { chosenNarrator, listNarrators, narrationOf, ownTexts } from '../../api/narration';
import { evalStatus, evaluatePhrase } from '../../api/speechEval';
import { pinyinOf } from '../../domain/ownText';
import { attemptOf, EVERYDAY, faultsOf, noteOf, numbered, partsOf, troubles, verdictOf, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { isHanzi, shelve, type GeneratedText } from '../../domain/text';
import { heardAnything } from '../../platform/audio/mic';
import { playSamples } from '../../platform/audio/voiceOut';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { addReading, narratedReadings, playLine, prepareClips, stopLine, type Clips } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { PronunciationKey } from '../settings/PronunciationKey';
import { attemptId, keepTry, loadHistory } from './speechHistory';
import { RecordButton } from './RecordButton';
import { useRecorder } from './useRecorder';
import './phrases.css';
import './pinyin.css';


/** How fast, and how the voice ended, when the service says (SpeechSuper does). */
function paceOf(r: EvalResult): string {
  const parts: string[] = [];
  if (r.speed) parts.push(`${Math.round(r.speed)} syllables a minute${r.speed > 260 ? ', quick for a learner' : r.speed < 120 ? ', slow — join the words' : ''}`);
  if (r.ending) parts.push(`your voice ${r.ending === 'rise' ? 'rose' : 'fell'} at the end`);
  return parts.length ? parts.join(' · ') + '.' : '';
}

/* ------------------------------------------------------------ attempts, kept on this device */

const KEPT = 'hanzi.phrases.attempts';
const loadAttempts = (): Record<string, Attempt[]> => {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, Attempt[]>;
  } catch {
    return {};
  }
};
/** Keeps a try on this device at once and in the account, with the service's whole answer. */
function keepAttempt(zh: string, a: Attempt, sourceId: string, result: EvalResult): Record<string, Attempt[]> {
  const all = loadAttempts();
  all[zh] = [...(all[zh] ?? []), a].slice(-5);
  saveAttempts(all);
  keepTry({ id: attemptId(), at: a.at, kind: 'phrase', sourceId, text: zh, good: a.faults.length === 0, summary: a, result });
  return all;
}

function saveAttempts(all: Record<string, Attempt[]>) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(all));
  } catch {
    // kept for this visit only
  }
}

const NOTHING_HEARD = 'Nothing was heard: the microphone gave only silence. Tap the button and say the line again; if it keeps happening, reload the page.';

const band = (score: number) => (score >= 75 ? 'good' : score >= 60 ? 'mid' : 'low');

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
  const [open, setOpen] = useState<Last | null>(null);
  const [done, setDone] = useState(false);
  const [attempts, setAttempts] = useState(loadAttempts);

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }));
    void ownTexts().then(setOwn, () => setOwn([]));
    // The account's tries, every device's, in place of this one's.
    void loadHistory().then((h) => {
      if (!h) return;
      const all = Object.fromEntries(Object.entries(h.phrases).map(([zh, list]) => [zh, list.map((x) => x.summary as Attempt)]));
      saveAttempts(all);
      setAttempts(all);
    });
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
    setDone(false);
    setOpen({ sourceId: src.id, index });
    keepLast({ sourceId: src.id, index });
  }

  if (status && !status.key.set) {
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
  if (open && source && source.phrases.length) {
    const scores = source.phrases.map((p) => best(p.zh));
    if (done) {
      return <Finished source={source} scores={scores} onAgain={(i) => start(source, i)} onBack={() => setOpen(null)} />;
    }
    const index = Math.min(open.index, source.phrases.length - 1);
    const go = (i: number) => {
      setOpen({ sourceId: source.id, index: i });
      keepLast({ sourceId: source.id, index: i });
    };
    return (
      <PhraseView
        key={`${source.id}:${index}`}
        phrases={source.phrases}
        index={index}
        title={source.title}
        sourceId={source.id}
        lines={source.phrases.map((p) => p.zh)}
        scores={scores}
        tryAgain={attempts[source.phrases[index]!.zh] ?? []}
        onAttempt={(zh, a, r) => setAttempts(keepAttempt(zh, a, source.id, r))}
        onGo={go}
        onNext={() => (index + 1 < source.phrases.length ? go(index + 1) : setDone(true))}
        onBack={() => setOpen(null)}
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

/* ------------------------------------------------------------ one phrase */

interface Tile {
  char: string;
  py: string;
  /** the syllable the service scored for it, in the latest try */
  i: number | null;
}

function PhraseView({
  phrases,
  index,
  title,
  sourceId,
  lines,
  scores: lineScores,
  tryAgain,
  onAttempt,
  onGo,
  onNext,
  onBack,
}: {
  phrases: Phrase[];
  index: number;
  title: string;
  sourceId: string;
  lines: string[];
  /** each line's best score, −1 for not said yet */
  scores: number[];
  tryAgain: Attempt[];
  onAttempt: (zh: string, a: Attempt, r: EvalResult) => void;
  onGo: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const lib = useLibrary();
  const phrase = phrases[index]!;
  const [result, setResult] = useState<EvalResult | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
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
    // By the lines' text, not the array: the parent makes a new one each render,
    // and every run stops what is playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join('\n'), sourceId]);

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

  // Each character's reading, for the tiles and for the service.
  const readings = useMemo(() => alignPinyin({ zh: phrase.zh, py: phrase.py }, lib), [phrase, lib]);

  const recorder = useRecorder((s) => {
    setSamples(s);
    setError(null);
    setNote(null);
    // Silence is not sent to be scored: it would come back as every syllable left out.
    if (!heardAnything(s)) {
      setNote(NOTHING_HEARD);
      return;
    }
    setChecking(true);
    evaluatePhrase(phrase.zh, s, numbered(readings)).then(
      (r) => {
        setActive(null);
        // Not the phrase at all is not a try at it: nothing marked, nothing counted.
        if (r.rejected) {
          setResult(null);
          setNote('That did not sound like this line. Hear it once more, then say all of it, close to the microphone.');
          return;
        }
        setResult(r);
        onAttempt(phrase.zh, attemptOf(r, Date.now()), r);
      },
      (err: Error) => setError(err.message),
    ).finally(() => setChecking(false));
  }, 15_000);

  // The phrase's characters with their pinyin, and which scored syllable each one is.
  const tiles = useMemo((): Tile[] => {
    const py = readings;
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
  }, [phrase, readings, result]);

  const verdict = result ? verdictOf(result) : null;
  // Each character with the punctuation after it, so a full stop never starts a line alone.
  const groups = tiles.reduce<number[][]>((out, t, i) => {
    if (!t.py && out.length) out[out.length - 1]!.push(i);
    else out.push([i]);
    return out;
  }, []);

  // Every character scored, as a card: a strip to swipe on a phone, all of them at once on an iPad.
  const cards = result
    ? tiles.flatMap((tile, ti) => (tile.i === null ? [] : [{ ti, tile, syl: result.syllables[tile.i]!, note: noteOf(result.syllables[tile.i]!) }]))
    : [];

  // On a phone the strip and the characters above follow each other: a tap on
  // a character brings its card, a swipe lights the character of the card in view.
  const strip = useRef<HTMLDivElement>(null);
  const bring = (ti: number) => {
    setActive(ti);
    const el = document.getElementById(`ph-syl-${ti}`);
    const box = strip.current;
    if (!el || !box) return;
    if (box.scrollWidth > box.clientWidth + 4) {
      box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const ticking = useRef(false);
  function onStripScroll() {
    const box = strip.current;
    if (!box || ticking.current || box.scrollWidth <= box.clientWidth + 4) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const mid = box.scrollLeft + box.clientWidth / 2;
      let best: number | null = null;
      let dist = Infinity;
      for (const c of cards) {
        const el = document.getElementById(`ph-syl-${c.ti}`);
        if (!el) continue;
        const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid);
        if (d < dist) {
          dist = d;
          best = c.ti;
        }
      }
      if (best !== null) setActive(best);
    });
  }
  // A new score opens on its first character that is not green.
  useEffect(() => {
    if (!result) return;
    const first = cards.find((c) => c.note.band !== 'good') ?? cards[0];
    if (first) requestAnimationFrame(() => bring(first.ti));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const state = checking ? 'checking' : recorder.state;
  const scores = result
    ? [
        ['Tones', result.tone],
        ['Initials, finals', result.sounds],
        ['Fluency', result.fluency],
        ['Completeness', result.completeness],
        ...(result.rhythm !== undefined ? [['Rhythm', result.rhythm]] : []),
      ]
    : null;
  const pace = result ? paceOf(result) : '';

  return (
    <section className="ph ph-view">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" /> Texts
      </button>
      <div className="ph-view-head">
        <span className="hanzi ph-view-name">{title}</span>
        <span className="small muted ph-view-at">
          Line {index + 1} of {phrases.length}
        </span>
      </div>
      <div className="ph-strip" role="group" aria-label="The text's lines">
        {lineScores.map((b, i) => (
          <button
            key={i}
            className="ph-cell"
            data-band={b < 0 ? 'none' : band(b)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Line ${i + 1}${b < 0 ? '' : `, ${Math.round(b)}`}`}
            onClick={() => onGo(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="ph-phrase" aria-label={phrase.zh}>
        {groups.map((g) => (
          <span key={g[0]} className="ph-word">
            {g.map((i) => {
              const t = tiles[i]!;
              const syl = t.i !== null && result ? result.syllables[t.i]! : null;
              const faults = syl ? faultsOf(syl) : [];
              const note = syl ? noteOf(syl) : null;
              if (!t.py) {
                return (
                  <span key={i} className="ph-punct hanzi">
                    {t.char}
                  </span>
                );
              }
              const mark = !result ? '' : !syl ? '' : faults.length === 0 ? (note?.band === 'good' ? '' : 'nearly') : faults[0]!.kind.startsWith('tone') ? 'tone' : faults[0]!.kind === 'missed' ? 'not heard' : faults[0]!.kind.startsWith('initial') || faults[0]!.kind.startsWith('final') ? 'sound' : 'extra';
              return (
                <button
                  key={i}
                  className="ph-tile"
                  data-state={!note ? undefined : note.band === 'good' ? 'ok' : note.band === 'mid' && !faults.length ? 'nearly' : 'bad'}
                  aria-pressed={active === i}
                  onClick={() => bring(i)}
                  disabled={!result}
                >
                  <span className="ph-tile-py">{t.py}</span>
                  <span className="ph-tile-zh hanzi">{t.char}</span>
                  <span className="ph-tile-mark">{mark}</span>
                </button>
              );
            })}
          </span>
        ))}
      </div>
      {phrase.en && <p className="ph-en">{phrase.en}</p>}

      <div className="ph-controls">
        <button className="btn ph-side" onClick={() => clips && playLine(clips, index, 1)} disabled={!clips}>
          <Icon name="play" size={18} /> Hear it
        </button>
        <RecordButton state={state} level={recorder.level} onToggle={recorder.toggle} />
        <button className="btn ph-side" onClick={() => samples && void playSamples(samples)} disabled={!samples}>
          <Icon name="play" size={18} /> Yours
        </button>
      </div>
      <div className="ph-next">
        <button className="btn quiet" onClick={() => onGo(index - 1)} disabled={index === 0}>
          <Icon name="prev" size={18} /> Previous
        </button>
        <button className="btn quiet" onClick={() => clips && playLine(clips, index, 0.75)} disabled={!clips}>
          Slowly
        </button>
        <button className={`btn ${result ? 'primary' : 'quiet'}`} onClick={onNext}>
          {index + 1 < phrases.length ? (result ? 'Next line' : 'Skip') : 'Finish'} <Icon name="next" size={18} />
        </button>
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
      {note && (
        <p className="small muted ph-note" role="status">
          {note}
        </p>
      )}
      {(error || recorder.error) && (
        <p className="narrator-error ph-error-box" role="alert">
          {error ?? recorder.error}
        </p>
      )}

      {result && cards.length > 0 && (
        <section className="ph-chars-block" aria-label="Each character">
          <div className="ph-chars-head">
            <h2 className="block-title">Each character</h2>
            <span className="small muted ph-chars-count">
              {cards.filter((c) => c.note.band === 'good').length} of {cards.length} green
            </span>
          </div>
          <div className="ph-chars" ref={strip} onScroll={onStripScroll}>
            {cards.map(({ ti, tile, syl, note }) => (
              <article
                key={ti}
                id={`ph-syl-${ti}`}
                className="ph-char"
                data-band={note.band}
                data-active={active === ti || undefined}
                onClick={() => setActive(ti)}
              >
                <header className="ph-char-head">
                  <span className="hanzi ph-char-zh">{tile.char}</span>
                  <span className="ph-char-py">{shown(syl, tile.py)}</span>
                  <span className="ph-char-score" data-band={note.band}>
                    {syl.said === 'missed' ? '0' : syl.score !== undefined ? Math.round(syl.score) : note.band === 'good' ? 'Right' : 'Fix'}
                  </span>
                </header>
                {syl.said !== 'missed' && syl.toneScore !== undefined && (
                  <div className="ph-char-parts">
                    {(
                      [
                        ['Initial', syl.initialScore],
                        ['Final', syl.finalScore],
                        ['Tone', syl.toneScore],
                      ] as const
                    )
                      .filter(([, v]) => v !== undefined)
                      .map(([name, v]) => (
                        <span key={name} className="ph-char-part" data-band={band(v!)}>
                          <span className="tiny muted">{name}</span>
                          <span className="ph-bar">
                            <i style={{ width: `${Math.max(4, Math.min(100, v!))}%` }} />
                          </span>
                          <b>{Math.round(v!)}</b>
                        </span>
                      ))}
                  </div>
                )}
                {note.faults.length ? (
                  <div className="ph-char-notes">
                    {note.faults.map((f) => (
                      <div key={f.kind} className="ph-char-note">
                        <b>{f.title}</b>
                        <span className="small">{f.how}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small ph-char-good">
                    Said well{syl.sandhi ? ` — and with its tone changed here, as it should be` : ''}.
                  </p>
                )}
                {syl.pause && <p className="tiny muted ph-char-pause">You paused after it.</p>}
                {syl.said !== 'missed' && syl.to > syl.from && (
                  <button
                    className="btn quiet sm ph-char-hear"
                    disabled={!samples}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (samples) void playSamples(samples.subarray(Math.floor((syl.from / 1000) * 16000), Math.ceil((syl.to / 1000) * 16000)));
                    }}
                  >
                    <Icon name="play" size={16} /> Your {tile.char}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
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
            {pace && <p className="small muted ph-pace">{pace}</p>}
            {result.quiet && <p className="small ph-error">The recording was very quiet: hold the device closer, or speak up.</p>}
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

        </div>
      )}

    </section>
  );
}

/** The reading said here: with the tone sandhi gives it, when it gives one. */
function shown(s: SyllableEval, py: string): string {
  if (!s.sandhi) return py;
  return partsOf(s.symbol.replace(/\d$/, '') + s.sandhi).marked;
}
