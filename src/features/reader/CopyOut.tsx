import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ensureStrokes } from '../../data/load';
import { alignPinyin } from '../../domain/reading';
import { segment, writerHints } from '../../domain/segment';
import { isHanzi, type GeneratedText } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { studyText } from '../../store/commands';
import { Glyph } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';

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

interface Unit {
  /** the characters to write: one, or a word's worth */
  text: string;
  /** their readings, one per character */
  py: string[];
  line: number;
  /** characters of the whole text before this unit, for the progress */
  before: number;
}

interface Piece {
  text: string;
  /** a piece to write, by index into the units; punctuation is not one */
  unit: number | null;
}

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
    const v = localStorage.getItem(key);
    return ok.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function keep(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    // remembered for this visit only
  }
}

function cut(text: GeneratedText, lib: ReturnType<typeof useLibrary>, by: 'word' | 'char'): { units: Unit[]; lines: Piece[][] } {
  const own = new Set(text.vocab.map((v) => v.w));
  const units: Unit[] = [];
  const lines: Piece[][] = [];
  let before = 0;
  text.lines.forEach((l, i) => {
    const py = alignPinyin(l, lib);
    let h = 0;
    const pieces: Piece[] = [];
    for (const t of segment(l.zh, lib, new Set([...own, ...writerHints(l.zh, l.py, lib)]))) {
      const chars = [...t.text];
      if (!t.word || !chars.some(isHanzi)) {
        pieces.push({ text: t.text, unit: null });
        continue;
      }
      const groups = by === 'word' ? [chars] : chars.map((c) => [c]);
      for (const g of groups) {
        const readings = g.map((c) => (isHanzi(c) ? (py[h++] ?? '') : ''));
        units.push({ text: g.join(''), py: readings, line: i, before });
        pieces.push({ text: g.join(''), unit: units.length - 1 });
        before += g.filter(isHanzi).length;
      }
    }
    lines.push(pieces);
  });
  return { units, lines };
}

/** The gap between squares, and the text column beside them on a wide screen. */
const GAP = 22;
const TEXT_W = 430;
/** Wide enough for the text beside the squares. */
const WIDE = 1000;

/**
 * The squares' side and how many fit across. Two always fit side by side;
 * on a wide screen the side is the one they have beside the text, so hiding
 * the text adds squares rather than growing them. Down, the squares leave
 * room for the heading, the strokes and the buttons.
 */
function useSquares(pane: RefObject<HTMLDivElement | null>, wide: boolean, strip: number) {
  const [box, setBox] = useState({ side: 0, across: 2, width: 0 });
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const besideText = window.innerWidth - TEXT_W - 2 * 34;
      const across = wide ? Math.min(w, besideText) : w;
      // heading 56, pinyin 30, the strokes and their label, the buttons 56, and the gaps between
      const down = h - 56 - 30 - (strip + 24) - 56 - 4 * 18;
      const side = Math.floor(Math.max(72, Math.min((across - GAP) / 2, down)));
      setBox({ side, across: Math.max(2, Math.floor((w + GAP) / (side + GAP))), width: w });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pane, wide, strip]);
  return box;
}

/** Fades on the edges of a row that has more beyond them, in the paper's colour. */
function useEdges(el: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  const [edges, setEdges] = useState({ l: false, r: false });
  useEffect(() => {
    const s = el.current;
    if (!s) return;
    const look = () => setEdges({ l: s.scrollLeft > 2, r: s.scrollLeft + s.clientWidth < s.scrollWidth - 2 });
    look();
    s.addEventListener('scroll', look, { passive: true });
    const ro = new ResizeObserver(look);
    ro.observe(s);
    return () => {
      s.removeEventListener('scroll', look);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return edges;
}

function useWide() {
  const q = `(min-width: ${WIDE}px)`;
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return wide;
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
  const track = useMemo(
    () => units.flatMap((u, k) => [...u.text].map((c, j) => ({ c, py: u.py[j] ?? '', unit: k, j }))),
    [units],
  );

  useEffect(() => {
    void ensureStrokes(lib, [...new Set(track.map((t) => t.c))]);
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
  const across = Math.min(sq.across, Math.max(2, n));
  const slots = across * sq.side + (across - 1) * GAP;

  // The row of squares shows the place: its first square at the left edge,
  // as far as the row goes.
  const row = useRef<HTMLDivElement>(null);
  const rowEdges = useEdges(row, [n, sq.side, at, by]);
  useEffect(() => {
    const r = row.current;
    if (!r || !unit) return;
    const first = whole ? track.findIndex((t) => t.unit === at) : Math.min(charAt, Math.max(0, n - across));
    r.scrollTo({ left: Math.max(0, first) * (sq.side + GAP), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, by, sq.side, across]);

  // The strokes of the whole word in one row, the character being written at its left edge.
  const strip = useRef<HTMLDivElement>(null);
  const stripEdges = useEdges(strip, [unit?.text, charAt, sq.side]);
  useLayoutEffect(() => {
    const s = strip.current;
    if (!s) return;
    const tail = s.querySelector<HTMLElement>('.cs-tail');
    if (tail) tail.style.width = `${Math.max(0, s.clientWidth - 40)}px`;
    const g = s.querySelectorAll<HTMLElement>('.cs-group')[charAt];
    if (g) s.scrollTo({ left: s.scrollLeft + g.getBoundingClientRect().left - s.getBoundingClientRect().left, behavior: 'smooth' });
  }, [charAt, unit?.text, slots]);

  const meaning = unit
    ? (text.vocab.find((v) => v.w === unit.text)?.d ??
      text.glosses?.[unit.text]?.d ??
      lib.byWord.get(unit.text)?.d ??
      lib.byChar.get(unit.text)?.def.split(/[;,]/)[0])
    : undefined;
  const reading = unit?.py.join('') ?? '';
  const nextUnit = units[at + 1];

  // The text on the left keeps the line being copied in view.
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    page.current?.querySelector('[data-now]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [at, sideText]);

  const square = (c: string, py: string, key: string | number, state: 'done' | 'now' | 'ahead', inWord: boolean, onTap: () => void) => (
    <div key={key} className="cw-cell" style={{ width: sq.side }}>
      <span className="cw-py" data-now={state === 'now' || undefined}>
        {py}
      </span>
      <button
        className="cw-box"
        data-state={state}
        data-word={inWord || undefined}
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
              {lines.map((pieces, i) => (
                <div key={i} className="cw-para" data-now={unit?.line === i || undefined}>
                  <span className="cw-para-n">{i + 1}</span>
                  <p className="hanzi">
                    {pieces.map((p, k) =>
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
                  </p>
                  {unit?.line === i && text.lines[i]?.en && <p className="cw-en">{text.lines[i]!.en}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="cw-pane" ref={pane} style={{ '--slots': `${slots}px` } as CSSProperties}>
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
                    <button className="hanzi cw-word-zh" onClick={() => openItem(itemForToken(lib, unit.text))}>
                      {unit.text}
                    </button>
                    <span className="cw-word-py">{reading}</span>
                    {meaning && <span className="cw-word-d">{meaning}</span>}
                    <Say text={unit.text} />
                  </div>
                ) : (
                  <div className="cw-line">
                    <p className="hanzi cw-line-zh">
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
                    <span className="cw-line-gloss">
                      {reading}
                      {meaning ? ` · ${meaning}` : ''}
                    </span>
                    <Say text={unit.text} />
                  </div>
                )}

                <div className="cw-row-wrap" data-l={rowEdges.l || undefined} data-r={rowEdges.r || undefined} style={{ width: slots }}>
                  <div className="cw-row" ref={row} data-one={n === 1 || undefined}>
                    {whole
                      ? track.map((t, k) =>
                          square(t.c, t.py, k, t.unit < at || (t.unit === at && t.j < charAt) ? 'done' : t.unit === at && t.j === charAt ? 'now' : 'ahead', t.unit === at, () =>
                            setAt(t.unit, t.j),
                          ),
                        )
                      : chars.map((c, j) => square(c, unit.py[j] ?? '', `${at}-${j}`, j < charAt ? 'done' : j === charAt ? 'now' : 'ahead', false, () => setCharAt(j)))}
                  </div>
                </div>

                <div className="cw-strip-wrap" data-l={stripEdges.l || undefined} data-r={stripEdges.r || undefined} style={{ width: slots }}>
                  <div className="cw-strip" ref={strip} style={{ '--cell': `${strokeSize}px` } as CSSProperties}>
                    {chars.map((c, j) => {
                      const count = lib.strokes[c]?.s.length ?? 0;
                      return (
                        <button key={`${at}-${j}`} className="cs-group" data-now={j === charAt || undefined} data-later={j > charAt || undefined} onClick={() => setCharAt(j)}>
                          <span className="cs-label">
                            <span className="hanzi">{c}</span> {count} stroke{count === 1 ? '' : 's'}
                          </span>
                          <span className="cs-cells">
                            {Array.from({ length: count }, (_, i) => (
                              <span key={i} className="cs-cell">
                                <Glyph char={c} strokes={lib.strokes} size={strokeSize - 4} upto={i + 1} highlight="var(--accent)" />
                                <span className="cs-n">{i + 1}</span>
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                    <span className="cs-tail" />
                  </div>
                </div>

                <div className="cw-actions" style={{ width: slots }}>
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
