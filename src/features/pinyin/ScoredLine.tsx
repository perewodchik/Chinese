import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EvalResult, SyllableEval } from '../../../shared/speechEval';
import { charScore, noteOf, partsOf, verdictOf, type Attempt } from '../../domain/phrases';
import { isHanzi } from '../../domain/text';
import { playSamples } from '../../platform/audio/voiceOut';
import { Icon } from '../../ui/Icon';
import './phrases.css';

interface Tile {
  char: string;
  py: string;
  /** the syllable the service scored for it */
  i: number | null;
}

export const band = (score: number) => (score >= 75 ? 'good' : score >= 60 ? 'mid' : 'low');

/** How fast, and how the voice ended, when the service says (SpeechSuper does). */
function paceOf(r: EvalResult): string {
  const parts: string[] = [];
  if (r.speed) parts.push(`${Math.round(r.speed)} syllables a minute${r.speed > 260 ? ', quick for a learner' : r.speed < 120 ? ', slow — join the words' : ''}`);
  if (r.ending) parts.push(`your voice ${r.ending === 'rise' ? 'rose' : 'fell'} at the end`);
  return parts.length ? parts.join(' · ') + '.' : '';
}

/** The reading said here: with the tone sandhi gives it, when it gives one. */
function shown(s: SyllableEval, py: string): string {
  if (!s.sandhi) return py;
  return partsOf(s.symbol.replace(/\d$/, '') + s.sandhi).marked;
}

/**
 * A line and what came of saying it: its characters with their pinyin,
 * coloured by how each was said, the verdict on one row, and every character
 * as a card — a strip to swipe on a phone, a grid on an iPad. The same in
 * Phrases, as a line is said, and in the history of tries.
 *
 * While the line is being scored a loader stands where the verdict will be,
 * so it is plain that something is happening, and how long it may take.
 */
export function ScoredLine({
  zh,
  en,
  readings,
  result,
  samples = null,
  tryAgain = [],
  scoring = false,
  children,
}: {
  zh: string;
  en?: string;
  /** each character's pinyin, tone-marked */
  readings: string[];
  result: EvalResult | null;
  /** the recording, to hear a syllable of it again; none in the history */
  samples?: Float32Array | null;
  tryAgain?: Attempt[];
  scoring?: boolean;
  /** notes and errors, between the line and its verdict */
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => setActive(null), [result]);

  // The phrase's characters with their pinyin, and which scored syllable each one is.
  const tiles = useMemo((): Tile[] => {
    const py = readings;
    let k = 0;
    let s = 0;
    const scored = (result?.syllables ?? []).filter((x) => x.said !== 'added');
    return [...zh].map((char) => {
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
  }, [zh, readings, result]);

  const verdict = result ? verdictOf(result) : null;
  // What the total is close to: the characters' own numbers, averaged, a left-out one as 0.
  const charsAvg = (() => {
    const said = result?.syllables.filter((x) => x.said !== 'added') ?? [];
    if (!said.length || said.every((x) => x.score === undefined)) return null;
    return Math.round(said.reduce((n, x) => n + (x.said === 'missed' ? 0 : (x.score ?? 0)), 0) / said.length);
  })();
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
  // `tapped`: brought by a tap on a character, so the page may move to show it;
  // brought by a new score, only the strip turns, and the line stays where it is.
  const bring = (ti: number, tapped = true) => {
    setActive(ti);
    const el = document.getElementById(`${uid}-${ti}`);
    const box = strip.current;
    if (!el || !box) return;
    if (box.scrollWidth > box.clientWidth + 4) {
      box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior: tapped ? 'smooth' : 'auto' });
      if (tapped) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (tapped) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        const el = document.getElementById(`${uid}-${c.ti}`);
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
    if (first) requestAnimationFrame(() => bring(first.ti, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  const parts = result
    ? ([
        ['Tones', result.tone],
        ['Sounds', result.sounds],
        ['Flow', result.fluency],
        ['All said', result.completeness],
        ...(result.rhythm !== undefined ? [['Rhythm', result.rhythm]] : []),
      ] as Array<[string, number]>)
    : [];
  const pace = result ? paceOf(result) : '';

  return (
    <>
        <div className="ph-phrase" aria-label={zh} data-dim={scoring || undefined}>
          {groups.map((g) => (
            <span key={g[0]} className="ph-word">
              {g.map((i) => {
                const t = tiles[i]!;
                const syl = t.i !== null && result ? result.syllables[t.i]! : null;
                const note = syl ? noteOf(syl) : null;
                if (!t.py) {
                  return (
                    <span key={i} className="ph-punct hanzi">
                      {t.char}
                    </span>
                  );
                }
                return (
                  <button
                    key={i}
                    className="ph-tile"
                    data-state={!note ? undefined : note.band === 'good' ? 'ok' : note.band === 'mid' ? 'nearly' : 'bad'}
                    aria-pressed={active === i}
                    onClick={() => bring(i)}
                    disabled={!result}
                  >
                    <span className="ph-tile-py">{t.py}</span>
                    <span className="ph-tile-zh hanzi">{t.char}</span>
                  </button>
                );
              })}
            </span>
          ))}
        </div>
        {en && <p className="ph-en">{en}</p>}
        {children}
        {scoring && (
          <div className="ph-scoring" role="status">
            <span className="spinner ph-scoring-spin" aria-hidden />
            <span>
              <b>Scoring your line…</b>
              <span className="tiny muted">Usually two to five seconds.</span>
            </span>
          </div>
        )}
        {!scoring && result && verdict && (
          <section className="ph-sum">
            <span className="ph-sum-total" data-band={band(result.total)}>
              {Math.round(result.total)}
            </span>
            <span className="ph-sum-text">
              <b>{verdict.headline}</b>
              <span className="ph-sum-parts">
                {parts.map(([name, v]) => (
                  <span key={name} data-band={band(v)}>
                    {name} <b>{Math.round(v)}</b>
                  </span>
                ))}
              </span>
              {charsAvg !== null && (
                <span className="tiny muted ph-sum-why">
                  Total ≈ the average of the characters below ({charsAvg}), one not heard as 0 — so it can sit under every figure here.
                </span>
              )}
              {(pace || tryAgain.length > 1) && (
                <span className="tiny muted">
                  {pace}
                  {tryAgain.length > 1 ? `${pace ? ' ' : ''}Your tries: ${tryAgain.map((a) => Math.round(a.total)).join(' · ')}.` : ''}
                </span>
              )}
              {result.quiet && <span className="tiny ph-error">The recording was very quiet: hold the device closer.</span>}
            </span>
          </section>
        )}

        {!scoring && result && cards.length > 0 && (
          <div className="ph-chars" ref={strip} onScroll={onStripScroll} aria-label="Each character">
            {cards.map(({ ti, tile, syl, note }) => {
              const n = charScore(syl);
              return (
                <article key={ti} id={`${uid}-${ti}`} className="ph-char" data-band={note.band} data-active={active === ti || undefined} onClick={() => setActive(ti)}>
                  <header className="ph-char-head">
                    <span className="hanzi ph-char-zh">{tile.char}</span>
                    <span className="ph-char-py">{shown(syl, tile.py)}</span>
                    {samples && syl.said !== 'missed' && syl.to > syl.from && (
                      <button
                        className="icon-btn ph-char-hear"
                        aria-label={`Hear your ${tile.char}`}
                        disabled={!samples}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (samples) void playSamples(samples.subarray(Math.floor((syl.from / 1000) * 16000), Math.ceil((syl.to / 1000) * 16000)));
                        }}
                      >
                        <Icon name="play" size={16} />
                      </button>
                    )}
                    <span className="ph-char-score" data-band={note.band}>
                      {n !== undefined ? Math.round(n) : note.band === 'good' ? 'Right' : 'Fix'}
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
                            <b>{Math.round(v!)}</b>
                            <span className="ph-bar">
                              <i style={{ width: `${Math.max(4, Math.min(100, v!))}%` }} />
                            </span>
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
                    <p className="small ph-char-good">Said well{syl.sandhi ? ', with its tone changed here as it should be' : ''}.</p>
                  )}
                  {syl.pause && <p className="tiny muted ph-char-pause">You paused after it.</p>}
                </article>
              );
            })}
          </div>
        )}

    </>
  );
}
