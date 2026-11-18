import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ensureStrokes } from '../../data/load';
import { paragraphs } from '../../domain/reading';
import { isHanzi, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { studyText } from '../../store/commands';
import { stickSpeed, useGamepad } from '../../platform/gamepad';
import { Glyph } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';
import { stored as storage } from '../../platform/storage';
import { cut, edge, GAP, held, INDENT, useEdges, useSquares, useWide } from './copyOutLayout';

/**
 * Copying the text out into a notebook, a piece at a time: the word to write
 * now in squares as big as the screen allows, its strokes one after another
 * underneath, and Back and Next under the squares.
 *
 * Copying a text by hand is the oldest way there is of getting it into the
 * hand and the eye at once, and it is what the learner does with a book open
 * beside a notebook: the writing is on paper, and the app keeps the place.
 *
 * Three ways through it — a word at a time, a character at a time, or the
 * whole text as one row of squares sliding past — and, on a screen wide
 * enough, the text itself on the left, where any word is a tap away. The
 * squares are the same size with the text shown or hidden; hiding it only
 * makes room for more of them.
 */

type By = 'word' | 'char' | 'whole';

const BY: Array<{ id: By; label: string }> = [
  { id: 'word', label: 'Word' },
  { id: 'char', label: 'Character' },
  { id: 'whole', label: 'Whole text' },
];

const BY_KEY = 'hanzi.copy.by';
const TEXT_KEY = 'hanzi.copy.text';

function stored<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try {
    const v = storage.get(key);
    return ok.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function keep(key: string, v: string) {
  try {
    storage.set(key, v);
  } catch {
    // remembered for this visit only
  }
}

export function CopyOut({ text, onClose }: { text: GeneratedText; onClose: () => void }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const wide = useWide();
  const [by, setByState] = useState<By>(() => stored(BY_KEY, ['word', 'char', 'whole'], 'word'));
  const [showText, setShowText] = useState(() => stored(TEXT_KEY, ['1', '0'], '1') === '1');
  const setBy = (v: By) => {
    setByState(v);
    keep(BY_KEY, v);
  };
  const toggleText = () => {
    setShowText((s) => !s);
    keep(TEXT_KEY, showText ? '0' : '1');
  };
  const sideText = wide && showText;

  // The whole text moves on a word at a time too; it only shows more of it.
  const { units, lines } = useMemo(() => cut(text, lib, by === 'char' ? 'char' : 'word'), [text, lib, by]);
  const paras = useMemo(() => paragraphs(text), [text]);
  const totalChars = useMemo(() => text.lines.reduce((n, l) => n + [...l.zh].filter(isHanzi).length, 0), [text.lines]);
  // Start where the last copy stopped, if it did not reach the end.
  const resumeAt = text.study?.copied && text.study.copied < totalChars ? text.study.copied : 0;
  const [at, setAtState] = useState(() => Math.max(0, units.findIndex((u) => u.before >= resumeAt)));
  /** the character of the unit whose strokes are shown */
  const [charAt, setCharAt] = useState(0);
  const setAt = (i: number, c = 0) => {
    setAtState(i);
    setCharAt(c);
  };
  const unit = units[Math.min(at, units.length - 1)];
  const done = at >= units.length;
  const chars = [...(unit?.text ?? '')];

  // Every character of the text in order, for the whole-text row.
  // A new paragraph starts on a new line two squares in, as in an exercise
  // book: the whole text's row shows those two squares, empty, before its
  // first character.
  const paraOf = useMemo(() => {
    const of = new Map<number, number>();
    paras.forEach((p, n) => of.set(p[0]!, n));
    return of;
  }, [paras]);
  const startsPara = (k: number) => {
    const u = units[k];
    return !!u && paraOf.has(u.line) && units[k - 1]?.line !== u.line;
  };
  const track = useMemo(
    () =>
      units.flatMap((u, k) => [
        ...(startsPara(k) ? [INDENT, INDENT].map((c, j) => ({ c, py: '', unit: k, j: j - 2 })) : []),
        ...[...u.text].map((c, j) => ({ c, py: u.py[j] ?? '', unit: k, j })),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [units, paraOf],
  );

  useEffect(() => {
    void ensureStrokes(lib, [...new Set(track.filter((t) => t.c !== INDENT).map((t) => t.c))]);
  }, [lib, track]);

  // The place is kept, as characters copied, whenever it moves on.
  useEffect(() => {
    const reached = done ? totalChars : (unit?.before ?? 0);
    if (reached > (text.study?.copied ?? 0)) studyText(text.id, { copied: reached });
  }, [done, unit, totalChars, text.id, text.study?.copied]);

  // Switching between the ways through keeps the place in the text.
  const place = useRef(unit?.before ?? 0);
  place.current = unit?.before ?? place.current;
  useEffect(() => {
    setAt(Math.max(0, units.findIndex((u) => u.before >= place.current)));
    // Only when the cutting changes; `units` is what changes then.
  }, [units]);

  const next = () => setAt(Math.min(units.length, at + 1));
  const back = () => setAt(Math.max(0, at - 1));
  // A character at a time, for the controller: through the word's characters,
  // then from its last to the first of the next word; back the same way, from
  // a word's first to the last of the word before.
  const nextChar = () => {
    if (!done && charAt < chars.length - 1) setCharAt(charAt + 1);
    else next();
  };
  const backChar = () => {
    if (!done && charAt > 0) return setCharAt(charAt - 1);
    const to = Math.max(0, Math.min(at, units.length) - 1);
    if (to === at) return;
    setAt(to, Math.max(0, [...(units[to]?.text ?? '')].length - 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.drawer')) return;
      // Enter or Space on a focused button is that button's, not Next.
      const onButton = document.activeElement instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ');
      if (e.key === 'Escape') onClose();
      else if (onButton) return;
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A game controller on the table (a Switch's A, R or the d-pad) moves on a
  // character at a time, the one being written, so the pen need not leave the
  // paper; not while a drawer is open.
  // Its left stick scrolls the row of squares, its right stick the strokes.
  useGamepad(
    (action) => {
      if (document.querySelector('.drawer')) return;
      if (action === 'next') nextChar();
      else backChar();
    },
    ({ left, right }, ms) => {
      if (document.querySelector('.drawer')) return;
      if (row.current) row.current.scrollLeft += (stickSpeed(left) * ms) / 1000;
      if (strip.current) strip.current.scrollLeft += (stickSpeed(right) * ms) / 1000;
    },
  );

  // The word drawer opens over the copying, not under it.
  useEffect(() => {
    document.documentElement.dataset.copying = '';
    return () => {
      delete document.documentElement.dataset.copying;
    };
  }, []);

  const pane = useRef<HTMLDivElement>(null);
  const strokeSize = wide ? 80 : 60;
  const sq = useSquares(pane, wide, strokeSize);
  const whole = by === 'whole';
  const n = whole ? track.length : chars.length;
  // Said over the squares too, where a word's squares are too big to show the two empty ones.
  const newPara = !done && startsPara(at) ? <span className="cw-new-para">New paragraph</span> : null;
  const across = Math.min(sq.across, Math.max(2, n));
  const slots = across * sq.side + (across - 1) * GAP;
  // The strokes and Back and Next stay two squares wide whatever the word: a longer word widens its squares, not them.
  const pair = 2 * sq.side + GAP;

  // The row of squares shows the place. A word's squares start at the left
  // edge, as far as the row goes. The whole text runs across the full width
  // and keeps the square being written in the middle, its neighbours on
  // either side; a tap on any square brings that one to the middle.
  const row = useRef<HTMLDivElement>(null);
  const rowEdges = useEdges(row, [n, sq.side, at, by]);
  const placed = useRef(false);
  useEffect(() => {
    const r = row.current;
    if (!r || !unit) return;
    const first = whole ? track.findIndex((t) => t.unit === at && t.j === 0) + charAt : Math.min(charAt, Math.max(0, n - across));
    // The first placing is at once; after that the whole text glides, with no snapping to spring back from.
    r.scrollTo({ left: Math.max(0, first) * (sq.side + GAP), behavior: whole && placed.current ? 'smooth' : 'auto' });
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, by, sq.side, across, whole ? charAt : -1]);

  // The strokes of the whole word in one row, the character being written at its left edge.
  const strip = useRef<HTMLDivElement>(null);
  const stripEdges = useEdges(strip, [unit?.text, charAt, sq.side]);
  // The strokes of the character chosen in the squares, and only that one:
  // a tap on another square shows its strokes instead.
  const stroked = chars[charAt];
  const strokeCount = (stroked && lib.strokes[stroked]?.s.length) || 0;
  // Another character starts its strokes from the first.
  useLayoutEffect(() => {
    strip.current?.scrollTo({ left: 0 });
  }, [charAt, at]);

  const meaning = unit
    ? (text.vocab.find((v) => v.w === unit.text)?.d ??
      text.glosses?.[unit.text]?.d ??
      lib.byWord.get(unit.text)?.d ??
      lib.byChar.get(unit.text)?.def
    )?.split(/;\s*/)[0]
    : undefined;
  const reading = unit?.py.join('') ?? '';
  const nextUnit = units[at + 1];

  // The sentence over the squares has room for two lines and never more, so
  // nothing under it moves from one sentence to the next; a longer one
  // scrolls inside that room to keep the word being copied in view.
  const sentence = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const p = sentence.current;
    const now = p?.querySelector<HTMLElement>('.cw-line-now');
    if (!p || !now) return;
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 33;
    p.scrollTop = Math.max(0, Math.floor(now.offsetTop / lh) * lh - lh);
  }, [at, by]);

  // The text on the left keeps the line being copied in view.
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    page.current?.querySelector('[data-now]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [at, sideText]);

  // The two squares a paragraph leaves empty: nothing to tap, the first saying why.
  const gap = (key: string | number, first: boolean) => (
    <div key={key} className="cw-cell" style={{ width: sq.side }}>
      <span className="cw-py">{first && <span className="cw-indent-say">New paragraph</span>}</span>
      <span className="cw-box cw-indent" style={{ width: sq.side, height: sq.side }} aria-hidden />
    </div>
  );

  const square = (c: string, py: string, key: string | number, state: 'done' | 'now' | 'ahead', onTap: () => void) => (
    <div key={key} className="cw-cell" style={{ width: sq.side }}>
      <span className="cw-py" data-now={state === 'now' || undefined}>
        {py}
      </span>
      <button
        className="cw-box"
        data-state={state}
        style={{ width: sq.side, height: sq.side }}
        onClick={onTap}
        aria-label={`${c}: its strokes`}
      >
        <Glyph char={c} strokes={lib.strokes} size={sq.side - 4} upto={state === 'ahead' ? 0 : undefined} ghost="var(--line)" />
      </button>
    </div>
  );

  return (
    <div className="co-scrim" role="dialog" aria-modal="true" aria-label="Copy out the text">
      <div className="cw" data-wide={wide || undefined} data-text={sideText || undefined}>
        <header className="cw-top">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
          <b className="hanzi cw-title">{text.titleZh || text.title}</b>
          <div className="co-progress" aria-hidden>
            <i style={{ width: `${((done ? totalChars : (unit?.before ?? 0)) / Math.max(1, totalChars)) * 100}%` }} />
          </div>
          <span className="small muted co-count">
            {done ? totalChars : (unit?.before ?? 0)} of {totalChars}
          </span>
          {wide && (
            <button className="icon-btn cw-textbtn" aria-pressed={showText} onClick={toggleText} title={showText ? 'Hide the text' : 'Show the text'}>
              <span className="hanzi">文</span>
            </button>
          )}
          <div className="seg sm cw-by" role="group" aria-label="A piece at a time">
            {BY.map((b) => (
              <button key={b.id} aria-pressed={by === b.id} onClick={() => setBy(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
        </header>

        <div className="cw-body">
          {sideText && (
            <div className="cw-page" ref={page}>
              <p className="tiny muted cw-page-hint">Tap any word to go there</p>
              {paras.map((para, n) => {
                // The English of the sentence being copied goes under it, so a paragraph
                // splits there and goes on below, its first line still indented.
                const cut = unit && para.includes(unit.line) ? para.indexOf(unit.line) + 1 : para.length;
                const sentences = (ls: number[]) =>
                  ls.map((i) => (
                    <span key={i} className="cw-sent" data-now={unit?.line === i || undefined}>
                      {held(lines[i]!).map((group, g) => (
                        <span key={g} className="cw-held">
                          {group.map(({ p, k }) =>
                            p.unit === null ? (
                              <span key={k} data-state={done || (unit && i < unit.line) ? 'done' : undefined}>
                                {p.text}
                              </span>
                            ) : (
                              <button
                                key={k}
                                data-state={done || p.unit < at ? 'done' : p.unit === at ? 'now' : undefined}
                                onClick={() => setAt(p.unit!)}
                              >
                                {p.text}
                              </button>
                            ),
                          )}
                        </span>
                      ))}
                    </span>
                  ));
                return (
                  <div key={n} className="cw-para">
                    {paras.length > 1 && <span className="cw-para-n">{n + 1}</span>}
                    <p className="hanzi">{sentences(para.slice(0, cut))}</p>
                    {unit && para.includes(unit.line) && text.lines[unit.line]?.en && (
                      <p className="cw-en">{text.lines[unit.line]!.en}</p>
                    )}
                    {cut < para.length && <p className="hanzi cw-para-on">{sentences(para.slice(cut))}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="cw-pane" ref={pane} style={{ '--slots': `${pair}px` } as CSSProperties}>
            {done || !unit ? (
              <div className="co-end">
                <span className="cs-seal hanzi">好</span>
                <h2>The whole text, copied out</h2>
                <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                  <button className="btn" onClick={() => setAt(0)}>
                    From the start again
                  </button>
                  <button className="btn primary" onClick={onClose}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {sideText ? (
                  <div className="cw-word">
                    {newPara}
                    <button className="hanzi cw-word-zh" onClick={() => openItem(itemForToken(lib, unit.text))}>
                      {unit.text}
                    </button>
                    <span className="cw-word-py">{reading}</span>
                    <span className="cw-word-d">{meaning}</span>
                    <span className="cw-say">
                      <Say text={unit.text} />
                    </span>
                  </div>
                ) : (
                  <div className="cw-line">
                    <p className="hanzi cw-line-zh" ref={sentence} data-para={paraOf.has(unit.line) || undefined}>
                      {lines[unit.line]!.map((p, k) =>
                        p.unit === at ? (
                          <button key={k} className="cw-line-now" onClick={() => openItem(itemForToken(lib, unit.text))}>
                            {p.text}
                          </button>
                        ) : (
                          <span key={k} data-done={(p.unit !== null && p.unit < at) || undefined}>
                            {p.text}
                          </span>
                        ),
                      )}
                    </p>
                    <div className="cw-line-meta">
                      <span className="cw-say">
                        <Say text={unit.text} />
                      </span>
                      <span className="cw-line-gloss">
                        {reading}
                        {meaning ? ` · ${meaning}` : ''}
                      </span>
                      {newPara}
                    </div>
                  </div>
                )}

                <div
                  className="cw-row-wrap"
                  data-whole={whole || undefined}
                  data-l={rowEdges.l || undefined}
                  data-r={rowEdges.r || undefined}
                  style={{ width: whole ? undefined : slots + 2 * edge(wide), '--edge': whole ? '64px' : `${edge(wide)}px` } as CSSProperties}
                >
                  <div
                    className="cw-row"
                    ref={row}
                    data-one={n === 1 || undefined}
                    style={{ paddingInline: whole ? `calc(50% - ${sq.side / 2}px)` : edge(wide) }}
                  >
                    {whole
                      ? track.map((t, k) =>
                          t.c === INDENT ? gap(k, t.j === -2) :
                          square(t.c, t.py, k, t.unit < at || (t.unit === at && t.j < charAt) ? 'done' : t.unit === at && t.j === charAt ? 'now' : 'ahead', () =>
                            setAt(t.unit, t.j),
                          ),
                        )
                      : chars.map((c, j) => square(c, unit.py[j] ?? '', `${at}-${j}`, j < charAt ? 'done' : j === charAt ? 'now' : 'ahead', () => setCharAt(j)))}
                  </div>
                </div>

                <div className="cw-strip-wrap" data-l={stripEdges.l || undefined} data-r={stripEdges.r || undefined} style={{ width: pair }}>
                  <div className="cw-strip" ref={strip} style={{ '--cell': `${strokeSize}px` } as CSSProperties}>
                    {stroked && (
                      <div className="cs-group">
                        <span className="cs-label">
                          <span className="hanzi">{stroked}</span> {strokeCount} stroke{strokeCount === 1 ? '' : 's'}
                        </span>
                        <span className="cs-cells">
                          {Array.from({ length: strokeCount }, (_, i) => (
                            <span key={i} className="cs-cell">
                              <Glyph char={stroked} strokes={lib.strokes} size={strokeSize - 4} upto={i + 1} highlight="var(--accent)" />
                              <span className="cs-n">{i + 1}</span>
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="cw-actions" style={{ width: pair }}>
                  <button className="btn tonal lg" style={{ width: sq.side }} onClick={back} disabled={at === 0}>
                    <Icon name="back" /> Back
                  </button>
                  <button className="btn primary lg cw-next" style={{ width: sq.side }} onClick={next}>
                    {nextUnit ? (
                      <>
                        Next: <span className="hanzi">{nextUnit.text}</span>
                      </>
                    ) : (
                      'Finish'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
