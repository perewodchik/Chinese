import { useEffect, useRef, useState } from 'react';
import type { SyllableEval } from '../../../shared/speechEval';
import { charScore, heardNote, noteOf, partsOf, type CharNote } from '../../domain/phrases';
import { playSamples } from '../../platform/audio/voiceOut';
import { Icon } from '../../ui/Icon';
import { useSheetDrag } from '../../ui/useSheetDrag';
import { stopLine } from '../reader/narratedClips';
import './phrases.css';

/** One character of a scored line: where it is in the line, how it reads, what the service heard. */
export interface CharRow {
  /** its place among the line's characters, to point at it in the line */
  ti: number;
  char: string;
  /** its pinyin as written */
  py: string;
  syl: SyllableEval;
}

/** The reading said here: with the tone sandhi gives it, when it gives one. */
const shownPy = (s: SyllableEval, py: string) => (s.sandhi ? partsOf(s.symbol.replace(/\d$/, '') + s.sandhi).marked : py);

// Worst first: not heard, then by its lowest part; one with no numbers by its colour.
const rank = (r: CharRow) => (r.syl.said === 'missed' ? -1 : (charScore(r.syl) ?? ({ good: 100, mid: 70, low: 40 } as const)[noteOf(r.syl).band]));
export const worstFirst = (rows: CharRow[]) => [...rows].sort((a, b) => rank(a) - rank(b) || a.ti - b.ti);

/** The characters' order: the ones to fix first, or the line's own. */
type Order = 'fix' | 'line';
const ORDER_KEY = 'hanzi.speak.charOrder';
const ORDER_EVENT = 'hanzi-char-order';
const storedOrder = (): Order => {
  try {
    return localStorage.getItem(ORDER_KEY) === 'line' ? 'line' : 'fix';
  } catch {
    return 'fix';
  }
};

/**
 * The order chosen, kept on the device and the same in the table and on its
 * sheet: changing it in one changes it in the other.
 */
function useOrder(): [Order, (o: Order) => void] {
  const [order, setOrderState] = useState<Order>(storedOrder);
  useEffect(() => {
    const on = () => setOrderState(storedOrder());
    window.addEventListener(ORDER_EVENT, on);
    return () => window.removeEventListener(ORDER_EVENT, on);
  }, []);
  const setOrder = (o: Order) => {
    setOrderState(o);
    try {
      localStorage.setItem(ORDER_KEY, o);
    } catch {
      // private browsing: it holds for this visit
    }
    window.dispatchEvent(new Event(ORDER_EVENT));
  };
  return [order, setOrder];
}

const ordered = (rows: CharRow[], order: Order) => (order === 'fix' ? worstFirst(rows) : rows);

function hear(samples: Float32Array, s: SyllableEval) {
  // The narrator's line stops first: two voices at once is neither.
  stopLine();
  void playSamples(samples.subarray(Math.floor((s.from / 1000) * 16000), Math.ceil((s.to / 1000) * 16000)));
}

/** A part's cell: its number when the service gives one, else right or wrong; coloured only when it fell short. */
function Part({ n, wrong, extra }: { n?: number; wrong: boolean; extra?: string }) {
  const b = n !== undefined ? (n >= 75 ? 'good' : n >= 60 ? 'mid' : 'low') : wrong ? 'low' : 'good';
  return (
    <span className="ph-tab-part" data-band={b}>
      {n !== undefined ? Math.round(n) : <Icon name={wrong ? 'close' : 'check'} size={14} />}
      {extra && <span className="ph-tab-extra"> {extra}</span>}
    </span>
  );
}

function Row({ r, samples, active, note }: { r: CharRow; samples: Float32Array | null; active?: boolean; note?: boolean }) {
  const s = r.syl;
  const n: CharNote = noteOf(s);
  const score = charScore(s);
  const p = partsOf(s.symbol);
  const want = s.sandhi ?? p.tone;
  const heardAs = s.tone && s.heardTone && s.heardTone !== want ? `as ${s.heardTone}` : undefined;
  const tag = heardNote(s);
  return (
    <div className="ph-tab-row" data-band={n.band} data-active={active || undefined} id={`ph-row-${r.ti}`}>
      <span className="hanzi ph-tab-zh">{r.char}</span>
      <span className="ph-tab-py">{shownPy(s, r.py)}</span>
      {s.said === 'missed' ? (
        <span className="ph-tab-missed">not heard</span>
      ) : (
        <>
          {p.initial ? <Part n={s.initialScore} wrong={s.initial} /> : <span className="ph-tab-part muted">–</span>}
          <Part n={s.finalScore} wrong={s.final} />
          <Part n={s.toneScore} wrong={s.tone} extra={heardAs} />
        </>
      )}
      <b className="ph-tab-score" data-band={n.band}>
        {s.said === 'missed' ? '–' : score !== undefined ? Math.round(score) : n.band === 'good' ? '' : '!'}
      </b>
      {samples && s.said !== 'missed' && s.to > s.from ? (
        <button className="icon-btn ph-tab-hear" aria-label={`Hear your ${r.char}`} onClick={() => hear(samples, s)}>
          <Icon name="play" size={14} />
        </button>
      ) : (
        <span />
      )}
      {note && n.band !== 'good' && tag && <span className="ph-tab-note">{tag}</span>}
    </div>
  );
}

/**
 * Every character of a scored line in a table: its pinyin, initial, final and
 * tone as the service heard them, its score, and your own sound of it. The
 * least well said first, so what to fix is in view; on a phone the table
 * scrolls inside the screen. All opens every character on a sheet of its own.
 */
export function CharTable({ rows, samples, active, dim, scrollInside = true }: { rows: CharRow[]; samples: Float32Array | null; active: number | null; dim?: boolean; /** false on a sheet, which scrolls itself */ scrollInside?: boolean }) {
  const [all, setAll] = useState(false);
  const [order, setOrder] = useOrder();
  const body = useRef<HTMLDivElement>(null);
  const sorted = ordered(rows, order);
  // On a phone the table ends above the dock, however tall the line above it is: its rows
  // scroll inside it, so the score and the line stay in view. Measured, since a line takes
  // one or two rows; on a wider screen every row shows and the page scrolls.
  const [maxH, setMaxH] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      const el = body.current;
      if (!el || !scrollInside || window.innerWidth >= 760) return setMaxH(null);
      const dock = document.querySelector('.ph-dock')?.getBoundingClientRect().top ?? window.innerHeight;
      setMaxH(Math.max(176, Math.floor(dock - el.getBoundingClientRect().top - 12)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [rows.length, scrollInside]);
  // A character tapped in the line brings its row into view, inside the table only.
  useEffect(() => {
    if (active === null || !body.current) return;
    const el = body.current.querySelector<HTMLElement>(`#ph-row-${active}`);
    if (el) body.current.scrollTo({ top: el.offsetTop - body.current.offsetTop - 4, behavior: 'smooth' });
  }, [active]);
  return (
    <section className="ph-tab" data-dim={dim || undefined} aria-label="Each character">
      <div className="ph-tab-row ph-tab-headrow">
        {/* Where the character and its pinyin have their columns: which order they come in, one tap to turn it. */}
        <button
          className="ph-tab-sort"
          onClick={() => setOrder(order === 'fix' ? 'line' : 'fix')}
          aria-label={order === 'fix' ? 'The ones to fix first. Tap for the line’s order' : 'In the line’s order. Tap for the ones to fix first'}
        >
          <Icon name="sort" size={15} />
          {order === 'fix' ? 'To fix' : 'In order'}
        </button>
        <span>Initial</span>
        <span>Final</span>
        <span>Tone</span>
        <button className="btn quiet sm ph-tab-all" onClick={() => setAll(true)} aria-label="Every character, on a sheet of its own">
          <Icon name="expand" size={15} /> All
        </button>
      </div>
      <div className="ph-tab-body" ref={body} style={maxH ? { maxHeight: maxH } : scrollInside ? undefined : { maxHeight: 'none' }}>
        {sorted.map((r) => (
          <Row key={r.ti} r={r} samples={samples} active={active === r.ti} />
        ))}
      </div>
      {all && <CharSheet rows={rows} samples={samples} onClose={() => setAll(false)} />}
    </section>
  );
}

/**
 * Every character of the line at once, large, on a sheet: for looking, so its
 * one action is Close, at its foot. In the line's order or the ones to fix first;
 * a character not right says in a few words what the service heard.
 */
export function CharSheet({ rows, samples, onClose, title = 'Each character' }: { rows: CharRow[]; samples: Float32Array | null; onClose: () => void; title?: string }) {
  const sheet = useSheetDrag(onClose);
  const { close } = sheet;
  const [order, setOrder] = useOrder();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  const toFix = rows.filter((r) => noteOf(r.syl).band !== 'good').length;
  const shown = ordered(rows, order);
  return (
    <div className="drawer ph-sheet-drawer" data-leaving={sheet.leaving || undefined} onClick={close}>
      <div />
      <div className="sheet ph-char-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} {...sheet.sheetProps}>
        <div className="sheet-head">
          <div className="grip" {...sheet.gripProps} aria-hidden="true">
            <span />
          </div>
          <div className="ph-char-sheet-top">
            <span className="ph-char-sheet-title">
              <b>{title}</b>
              <span className="small muted">{toFix ? `${toFix} to fix` : 'All said right'}</span>
            </span>
            <span className="seg sm" role="group" aria-label="Order">
              <button aria-pressed={order === 'line'} onClick={() => setOrder('line')}>
                In order
              </button>
              <button aria-pressed={order === 'fix'} onClick={() => setOrder('fix')}>
                To fix first
              </button>
            </span>
          </div>
        </div>
        <section className="ph-tab ph-tab-big">
          <div className="ph-tab-row ph-tab-headrow">
            <span />
            <span />
            <span>Initial</span>
            <span>Final</span>
            <span>Tone</span>
            <span />
            <span />
          </div>
          {shown.map((r) => (
            <Row key={r.ti} r={r} samples={samples} note />
          ))}
        </section>
        <footer className="ph-sheet-foot-close">
          <button className="btn tonal lg" onClick={close}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
