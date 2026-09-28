import { useEffect, useState } from 'react';
import { BLANKS, renderBlank, type BlankId, type BlankTemplate } from '../../pdf/blank';
import { useStore } from '../../store/store';
import { Modal } from '../../ui/Modal';
import { Seg } from '../../ui/Seg';
import { usePdfExport } from '../shared/usePdfExport';

type Pages = '1' | '2' | '5' | '10';
const PAGES: Pages[] = ['1', '2', '5', '10'];

/**
 * Blank paper, on the Collections page because that is where everything that
 * prints lives. For characters that are in no collection — yet, or ever — and
 * for writing out a text by hand.
 *
 * Nothing to set up and nothing saved: pick a kind of paper, see it, take as
 * many pages as you want. The colour is the one in Settings.
 */
export function BlankPaper() {
  const [open, setOpen] = useState<BlankTemplate | null>(null);
  return (
    <section className="shelf">
      <div className="shelf-head">
        <div>
          <h2 className="shelf-title">Blank paper</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Empty squares for characters you have not picked yet, or for writing out a text.
          </p>
        </div>
      </div>
      <div className="tpl-grid">
        {BLANKS.map((t) => (
          <button key={t.id} className="tpl-card blank-card" onClick={() => setOpen(t)}>
            <BlankThumb id={t.id} />
            <span className="blank-text">
              <span className="row" style={{ gap: 8 }}>
                <span className="name">{t.name}</span>
                <span className="blank-zh">{t.zh}</span>
              </span>
              <span className="tiny muted">{t.blurb}</span>
              <span className="tiny muted">{t.holds}</span>
            </span>
          </button>
        ))}
      </div>
      {open && <BlankDialog t={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function BlankDialog({ t, onClose }: { t: BlankTemplate; onClose: () => void }) {
  const palette = useStore((s) => s.settings.printPalette);
  const footerNote = useStore((s) => s.settings.footerNote);
  const pdf = usePdfExport();
  const [pages, setPages] = useState<Pages>('1');
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

  const n = Number(pages);
  return (
    <Modal
      wide
      title={`${t.name} · ${t.zh}`}
      subtitle={t.blurb}
      onClose={onClose}
      footer={
        <>
          <span className="small muted">Pages</span>
          <Seg
            label="Pages"
            size="sm"
            value={pages}
            onChange={setPages}
            options={PAGES.map((p) => ({ id: p, label: p }))}
          />
          <div className="spacer" />
          <button
            className="btn primary sm"
            disabled={pdf.busy !== null}
            onClick={() =>
              void pdf.run('blank', {
                title: `${t.name} ${t.zh}`,
                render: () => renderBlank(t.id, { pages: n, palette, footerNote }),
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
  const top = 26;

  const rowOf = (y: number, from = 0, to = 12, size = c) => {
    for (let i = from; i < to; i++) cells.push([x0 + i * c, y, size]);
  };
  if (id === 'mizi' || id === 'tian') {
    for (let r = 0; r < 16; r++) rowOf(top + r * c);
  } else if (id === 'pinyin') {
    for (let r = 0; r < 10; r++) {
      const y = top + r * 26;
      lines.push([x0, y, W], [x0, y + 3, W], [x0, y + 6, W]);
      rowOf(y + 7);
    }
  } else if (id === 'newchar') {
    for (let b = 0; b < 5; b++) {
      const y = top + b * 50;
      cells.push([x0, y, c * 2]);
      lines.push([x0 + 34, y + 6, 70], [x0 + 110, y + 6, 70]);
      rowOf(y + c, 2);
      rowOf(y + c * 2);
    }
  } else if (id === 'compose') {
    lines.push([x0, top, 110], [x0 + 120, top, 60]);
    for (let r = 0; r < 13; r++) rowOf(top + 6 + r * 18);
  } else {
    for (let r = 0; r < 10; r++) {
      const y = top + r * 26;
      for (const h of [0, 6 * c]) {
        lines.push([x0 + h + c, y, 4 * c], [x0 + h + c, y + 6, 4 * c]);
        for (let i = 1; i <= 4; i++) cells.push([x0 + h + i * c, y + 7, c]);
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
