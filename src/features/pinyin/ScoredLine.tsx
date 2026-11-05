import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EvalResult, SyllableEval } from '../../../shared/speechEval';
import { charScore, heardTag, noteOf, partsOf } from '../../domain/phrases';
import { parseSyllable } from '../../domain/pinyin/syllable';
import { isHanzi } from '../../domain/text';
import { playSamples } from '../../platform/audio/voiceOut';
import { stopLine } from '../reader/narratedClips';
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

/**
 * A character's initial, final and tone as the service heard them, and
 * nothing of the app's own: each part, its number, and what it sounded like
 * when that was something else (q → j, tone 2 → 1); a syllable not heard says
 * so. A pause between characters is the line's Flow, not shown here: on
 * one card it would make every card in the row taller. Without numbers (iFlytek) a part is right
 * or wrong.
 */
function CharParts({ syl }: { syl: SyllableEval }) {
  if (syl.said === 'missed') return <p className="ph-char-missed">not heard</p>;
  const p = partsOf(syl.symbol);
  const want = syl.sandhi ?? p.tone;
  const rows: Array<{ name: string; said: string; like?: string; n?: number; wrong: boolean }> = [
    ...(p.initial ? [{ name: 'Initial', said: p.initial, like: syl.initialLike, n: syl.initialScore, wrong: syl.initial }] : []),
    { name: 'Final', said: p.final, like: syl.finalLike, n: syl.finalScore, wrong: syl.final },
    { name: 'Tone', said: String(want), like: syl.tone && syl.heardTone && syl.heardTone !== want ? String(syl.heardTone) : undefined, n: syl.toneScore, wrong: syl.tone },
  ];
  return (
    <dl className="ph-char-parts">
      {rows.map((r) => (
        <div key={r.name} className="ph-char-part" data-band={r.n !== undefined ? band(r.n) : r.wrong ? 'low' : 'good'}>
          <dt>{r.name}</dt>
          <dd className="ph-char-said">
            {r.said}
            {r.like && (
              <>
                {' '}
                <span aria-label="sounded like">→</span> <b>{r.like}</b>
              </>
            )}
          </dd>
          <dd className="ph-char-n">{r.n !== undefined ? Math.round(r.n) : <Icon name={r.wrong ? 'close' : 'check'} size={14} />}</dd>
        </div>
      ))}
    </dl>
  );
}


/** A pinyin with its wrong part in red: the initial, the final, or (for the tone) the whole final underlined. */
function MarkedPinyin({ py, syl }: { py: string; syl: SyllableEval }) {
  const initial = parseSyllable(py).initial;
  const rest = py.slice(initial.length);
  return (
    <span className="ph-tile-py ph-marked">
      {initial && <span data-wrong={(syl.said === 'missed' || syl.initial) || undefined}>{initial}</span>}
      <span data-wrong={(syl.said === 'missed' || syl.final) || undefined} data-tone={syl.tone || undefined}>
        {rest}
      </span>
    </span>
  );
}

/** A syllable's sound out of a recording, by where the service found it. */
function hearPart(samples: Float32Array, s: SyllableEval) {
  stopLine();
  void playSamples(samples.subarray(Math.floor((s.from / 1000) * 16000), Math.ceil((s.to / 1000) * 16000)));
}

/**
 * The line in time: the voice's syllables above (when the voice has been
 * scored on this line), yours below, on one scale, each a block where the
 * service heard it, coloured as it was said; one not heard is a dashed block
 * after the last one said. A tap on a block plays that syllable. Only a try
 * with the service's timings has it: one kept as a summary has none.
 */
function Timeline({ result, samples, voice }: { result: EvalResult; samples: Float32Array | null; voice?: { result: EvalResult; samples?: Float32Array | null } }) {
  const lane = (r: EvalResult) => {
    const said = r.syllables.filter((s) => s.said !== 'added');
    let at = 0;
    return said.map((s) => {
      // Not heard: no place of its own in the recording, so a short dashed block after the one before.
      const from = s.said === 'missed' || s.to <= s.from ? at : s.from;
      const to = s.said === 'missed' || s.to <= s.from ? at + 250 : s.to;
      at = to;
      return { s, from, to, missed: s.said === 'missed', band: noteOf(s).band };
    });
  };
  const you = lane(result);
  const them = voice ? lane(voice.result) : [];
  const end = Math.max(1000, ...you.map((x) => x.to), ...them.map((x) => x.to));
  const pct = (ms: number) => `${(ms / end) * 100}%`;
  const row = (blocks: ReturnType<typeof lane>, rec: Float32Array | null | undefined, who: string) => (
    <div className="ph-time-lane" role="group" aria-label={who}>
      {blocks.map((b, i) => (
        <button
          key={i}
          className="ph-time-block hanzi"
          data-band={who === 'The voice' ? 'voice' : b.band}
          data-missed={b.missed || undefined}
          style={{ left: pct(b.from), width: `calc(${pct(b.to - b.from)} - 2px)` }}
          disabled={!rec || b.missed}
          onClick={() => rec && hearPart(rec, b.s)}
          aria-label={`${b.s.char}${b.missed ? ', not heard' : ''}`}
        >
          {b.s.char}
        </button>
      ))}
    </div>
  );
  const ticks = Array.from({ length: Math.floor(end / 1000) + 1 }, (_, i) => i);
  return (
    <div className="ph-time">
      {voice && (
        <>
          <span className="tiny muted">Voice</span>
          {row(them, voice.samples, 'The voice')}
        </>
      )}
      <span className="tiny muted">You</span>
      {row(you, samples, 'You')}
      <span />
      <div className="ph-time-axis" aria-hidden>
        {ticks.map((t) => (
          <span key={t} style={{ left: pct(t * 1000) }}>
            {t === 0 ? '0 s' : t}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * What the timeline shows, in words: where you paused, what was not heard.
 * Not when you began: a recording is trimmed to the voice, so it always starts
 * at once.
 */
function howItWent(r: EvalResult): string {
  const paused = r.syllables.filter((s) => s.pause).map((s) => s.char);
  let text = paused.length ? `You paused after ${paused.join(', ')}.` : '';
  const missed = r.syllables.filter((s) => s.said === 'missed').map((s) => s.char);
  if (missed.length) {
    const atEnd = r.syllables.slice(-missed.length).every((s) => s.said === 'missed');
    text += ` ${missed.join(' ')} ${missed.length === 1 ? 'was' : 'were'} not heard${atEnd ? ': the recording ends when you tap the square, so tap it after the last syllable' : ''}.`;
  }
  return text.trim();
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
  scoring = false,
  marks = false,
  voice,
  children,
}: {
  zh: string;
  en?: string;
  /** each character's pinyin, tone-marked */
  readings: string[];
  result: EvalResult | null;
  /** the recording, to hear a syllable of it again; none in the history */
  samples?: Float32Array | null;
  scoring?: boolean;
  /** the line itself says what was wrong: the wrong part of each pinyin in red, a short tag under the character */
  marks?: boolean;
  /** the voice's own try at the line, scored, for the timeline under the score */
  voice?: { result: EvalResult; samples?: Float32Array | null };
  /** notes and errors, between the line and its verdict */
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const [why, setWhy] = useState(false);
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
      // To the page's own left margin, as the strip snaps: the card in view starts where everything else does.
      box.scrollTo({ left: el.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft || '0'), behavior: tapped ? 'smooth' : 'auto' });
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
      const mid = box.scrollLeft + parseFloat(getComputedStyle(box).paddingLeft || '0');
      let best: number | null = null;
      let dist = Infinity;
      for (const c of cards) {
        const el = document.getElementById(`${uid}-${c.ti}`);
        if (!el) continue;
        const d = Math.abs(el.offsetLeft - mid);
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
  // What went wrong that the numbers do not say, on one line under them: a syllable not heard.
  const missed = result ? result.syllables.filter((s) => s.said === 'missed').map((s) => s.char) : [];
  const timed = Boolean(result?.syllables.some((s) => s.to > s.from));
  const told = result ? howItWent(result) : '';
  const opens = Boolean(pace || timed || told || (result?.rhythm !== undefined));

  return (
    <>
        <div className="ph-phrase" aria-label={zh} data-dim={scoring || undefined} data-marks={(marks && result) || undefined}>
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
                    {marks && syl ? <MarkedPinyin py={t.py} syl={syl} /> : <span className="ph-tile-py">{t.py}</span>}
                    <span className="ph-tile-zh hanzi">{t.char}</span>
                    {marks && <span className="ph-tile-tag">{syl ? heardTag(syl).replace(/ → /g, '→') : ''}</span>}
                  </button>
                );
              })}
            </span>
          ))}
        </div>
        {en && <p className="ph-en">{en}</p>}
        {children}
        {scoring && !result && (
          <div className="ph-scoring" role="status">
            <span className="spinner ph-scoring-spin" aria-hidden />
            <span>
              <b>Scoring your line…</b>
              <span className="tiny muted">Usually two to five seconds.</span>
            </span>
          </div>
        )}
        {result && (
          <section className="ph-sum-box" data-dim={scoring || undefined}>
            <div className="ph-sum">
              {scoring && (
                <span className="ph-sum-busy" role="status">
                  <span className="spinner" aria-hidden /> Scoring…
                </span>
              )}
              <span className="ph-sum-total" data-band={band(result.total)} aria-label={`${Math.round(result.total)} out of 100`}>
                {Math.round(result.total)}
              </span>
              <span className="ph-sum-text">
                <span className="ph-sum-parts">
                  {parts.map(([name, v]) => (
                    <span key={name} data-band={band(v)}>
                      {name} <b>{Math.round(v)}</b>
                    </span>
                  ))}
                </span>
                {missed.length > 0 && <span className="tiny ph-error">{missed.join(' ')} not heard</span>}
                {result.quiet && <span className="tiny ph-error">The recording was very quiet: hold the device closer.</span>}
              </span>
              {opens && (
                <button className="icon-btn ph-sum-more" aria-expanded={why} onClick={() => setWhy((w) => !w)} aria-label={why ? 'Hide how it went' : 'How it went'} title={why ? 'Hide how it went' : 'How it went'}>
                  <Icon name="chevron" size={18} />
                </button>
              )}
            </div>
            {why && opens && (
              <div className="ph-sum-open">
                {pace && <span className="tiny muted">{pace}</span>}
                {timed && <Timeline result={result} samples={samples} voice={voice} />}
                {told && <p className="small ph-sum-told">{told}</p>}
              </div>
            )}
          </section>
        )}

        {result && cards.length > 0 && (
          <div className="ph-chars" data-dim={scoring || undefined} ref={strip} onScroll={onStripScroll} aria-label="Each character">
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
                          // The narrator's line stops first: two voices at once is neither.
                          stopLine();
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
                  <CharParts syl={syl} />
                </article>
              );
            })}
          </div>
        )}

    </>
  );
}
