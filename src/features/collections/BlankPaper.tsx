import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import '../library/home.css';
import { BLANKS, renderBlank, type BlankId, type BlankTemplate } from '../../pdf/blank';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { usePdfExport } from '../shared/usePdfExport';

/** As many pages as a term's exercise book, and then some. */
const MAX_PAGES = 200;
const clampPages = (n: number) => Math.max(1, Math.min(MAX_PAGES, Math.round(n) || 1));

/**
 * Blank paper, at /library/paper: for characters that are in no list — yet,
 * or ever — and for writing out a text by hand.
 *
 * Nothing to set up and nothing saved: pick a kind of paper, see it, take as
 * many pages as you want. The colour is the one in Settings.
 */
export function PaperPage() {
  useTitle('Blank paper');
  const [open, setOpen] = useState<BlankTemplate | null>(null);
  return (
    <div className="set-page">
      <header className="page-head">
        <Link className="back-link" to={paths.library()}>
          <Icon name="back" />
          Library
        </Link>
      </header>
      <h1 className="set-title">Blank paper</h1>
      <p className="set-blurb">Empty squares for characters you have not picked yet, or for writing out a text.</p>
      <div className="list paper-list">
        {BLANKS.map((t) => (
          <button key={t.id} className="paper-row" onClick={() => setOpen(t)}>
            <BlankThumb id={t.id} />
            <span className="grow">
              <span className="paper-name">
                <b>{t.name}</b>
                <span className="hanzi muted">{t.zh}</span>
              </span>
              <span className="small muted">{t.blurb}</span>
              <span className="tiny muted">{t.holds}</span>
            </span>
            <Icon name="chevron" className="muted" />
          </button>
        ))}
      </div>
      {open && <BlankDialog t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function BlankDialog({ t, onClose }: { t: BlankTemplate; onClose: () => void }) {
  const palette = useStore((s) => s.settings.printPalette);
  const footerNote = useStore((s) => s.settings.footerNote);
  const pdf = usePdfExport();
  const [pages, setPages] = useState(1);
  // What is typed, kept apart from the number so the field can be empty while it is being retyped.
  const [typed, setTyped] = useState('1');
  const step = (by: number) => {
    const n = clampPages(pages + by);
    setPages(n);
    setTyped(String(n));
  };
  const [url, setUrl] = useState<string | null>(null);

  // One page is the whole preview: every page of blank paper is the same.
  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    void renderBlank(t.id, { palette, footerNote }).then(({ bytes }) => {
      if (cancelled) return;
      made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      setUrl(made);
    });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [t.id, palette, footerNote]);

  return (
    <Modal
      wide
      title={`${t.name} · ${t.zh}`}
      subtitle={t.blurb}
      onClose={onClose}
      footer={
        <>
          <span className="small muted">Pages</span>
          <div className="pages-step" role="group" aria-label="Pages">
            <button className="icon-btn" onClick={() => step(-1)} disabled={pages <= 1} aria-label="One page fewer">
              <Icon name="minus" size={18} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PAGES}
              value={typed}
              aria-label="Number of pages"
              onChange={(e) => {
                setTyped(e.target.value);
                if (e.target.value !== '') setPages(clampPages(Number(e.target.value)));
              }}
              onBlur={() => setTyped(String(pages))}
            />
            <button className="icon-btn" onClick={() => step(1)} disabled={pages >= MAX_PAGES} aria-label="One page more">
              <Icon name="plus" size={18} />
            </button>
          </div>
          <div className="spacer" />
          <button
            className="btn primary sm"
            disabled={pdf.busy !== null}
            onClick={() =>
              void pdf.run('blank', {
                title: `${t.name} ${t.zh}`,
                render: () => renderBlank(t.id, { pages, palette, footerNote }),
              })
            }
          >
            Download PDF
          </button>
        </>
      }
    >
      <div className="blank-preview">
        {url ? (
          <iframe className="preview" src={`${url}#toolbar=0&navpanes=0`} title={`${t.name} preview`} />
        ) : (
          <div className="preview" />
        )}
      </div>
    </Modal>
  );
}

/**
 * A miniature of the page, in the theme's own greys: A4 at 1 unit a
 * millimetre, 15 mm margins and the same twelve 15 mm columns, so the
 * proportions are the real ones.
 */
function BlankThumb({ id }: { id: BlankId }) {
  const x0 = 15;
  const c = 15;
  const W = 180;
  const cells: Array<[number, number, number]> = [];
  const lines: Array<[number, number, number]> = [];
  /** upright lines: x, top, length */
  const ticks: Array<[number, number, number]> = [];

  const rowOf = (y: number, from = 0, to = 12, size = c, x = x0) => {
    for (let i = from; i < to; i++) cells.push([x + i * size, y, size]);
  };
  // The page's body, in millimetres, as blank.ts lays it out in points.
  const bodyTop = 23.3;
  const bodyH = 252.6;
  const spread = (n: number, h: number, t = bodyTop, height = bodyTop + bodyH - t) =>
    Array.from({ length: n }, (_, r) => t + r * (h + (n > 1 ? (height - n * h) / (n - 1) : 0)));
  const boxes = (y: number, n: number, size: number, h: number, x = x0) => {
    lines.push([x, y, n * size], [x, y + h / 3, n * size], [x, y + (2 * h) / 3, n * size]);
    for (let i = 0; i <= n; i++) ticks.push([x + i * size, y, h]);
  };
  const small = W / 16;
  if (id === 'mizi' || id === 'tian') {
    for (let r = 0; r < 16; r++) rowOf(29.6 + r * c);
  } else if (id === 'pinyin') {
    for (const y of spread(10, 8.5 + c)) {
      boxes(y, 12, c, 8.5);
      rowOf(y + 8.5);
    }
  } else if (id === 'newchar') {
    for (const y of spread(5, c * 3)) {
      cells.push([x0, y, c * 2]);
      lines.push([x0 + 34, y + 5, 38], [x0 + 80, y + 5, 40], [x0 + 128, y + 5, 52]);
      rowOf(y + c / 2, 0, 20, c / 2, x0 + 2 * c);
      rowOf(y + c, 2);
      rowOf(y + c * 2);
    }
  } else if (id === 'text') {
    for (const y of spread(10, 5.3 + small + 5.3)) {
      boxes(y, 16, small, 5.3);
      rowOf(y + 5.3, 0, 16, small);
      lines.push([x0, y + 5.3 + small + 4.6, W]);
    }
  } else if (id === 'compose') {
    lines.push([x0 + 10, bodyTop + 3.6, W - 10]);
    for (const y of spread(17, small, bodyTop + 7.8)) rowOf(y, 0, 16, small);
  } else {
    for (const y of spread(10, 6.35 + c)) {
      for (const h of [0, 6 * c]) {
        boxes(y, 4, c, 6.35, x0 + h + c);
        for (let i = 1; i <= 4; i++) cells.push([x0 + h + i * c, y + 6.35, c]);
      }
    }
  }

  const guide = id === 'mizi' || id === 'newchar' ? 'mizi' : id === 'compose' ? 'blank' : 'tian';
  return (
    <svg className="blank-thumb" viewBox="0 0 210 297" aria-hidden>
      <rect className="page" x="0.5" y="0.5" width="209" height="296" rx="3" />
      <rect className="head" x={x0} y="12" width="50" height="5" rx="1" />
      {lines.map(([x, y, w], i) => (
        <line key={`l${i}`} className="rule" x1={x} y1={y} x2={x + w} y2={y} />
      ))}
      {ticks.map(([x, y, h], i) => (
        <line key={`t${i}`} className="rule" x1={x} y1={y} x2={x} y2={y + h} />
      ))}
      {cells.map(([x, y, s], i) => (
        <g key={i}>
          <rect className="cell" x={x} y={y} width={s} height={s} />
          {guide !== 'blank' && (
            <path className="guide" d={`M${x + s / 2} ${y}v${s}M${x} ${y + s / 2}h${s}`} />
          )}
          {guide === 'mizi' && s > c && <path className="guide" d={`M${x} ${y}l${s} ${s}M${x + s} ${y}l${-s} ${s}`} />}
        </g>
      ))}
    </svg>
  );
}
