import { useMemo } from 'react';
import type { RadicalEntry } from '../../data/radicals';
import { mainForm, searchScore } from '../../domain/radicals/forms';
import { RADICAL_TEMPLATE } from '../../domain/radicals/sheet';
import { useOpenRadical } from '../../navigation/radicalDrawer';
import { renderRadicals } from '../../pdf/radicals/render';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { usePdfExport } from '../shared/usePdfExport';
import { useRadicalLibrary } from './radicalData';

export type RadicalShow = 'all' | 'forms';

export const RADICAL_SHOW: Array<{ id: RadicalShow; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'forms', label: 'Written more than one way' },
];

interface Props {
  /** what is in the library's search box */
  q: string;
  show: RadicalShow;
}

/**
 * The 214 radicals, inside the library, as reference.
 *
 * They used to be a section of their own with sets, sheets to design and a
 * tick against each one, which made them look like a second syllabus to get
 * through. They are not: they are the parts characters are made of, and the
 * use of them is to look one up and recognise it next time. So they live in
 * the library behind the same dropdown as the bands, they cannot be marked,
 * queued or reviewed, and the only thing to do with them besides reading is
 * to print the reference sheet.
 *
 * Ordered by how much of the syllabus each one unlocks rather than by Kangxi
 * number — the number is a place in a dictionary; this order is what to look
 * at first.
 */
export function RadicalShelf({ q, show }: Props) {
  const rlib = useRadicalLibrary();
  const openRadical = useOpenRadical();
  const pdf = usePdfExport();
  const footerNote = useStore((s) => s.settings.footerNote);

  const rows = useMemo(() => {
    const needle = q.trim();
    return rlib.radicals
      .map((r) => ({ r, score: needle ? searchScore(r, needle) : 0 }))
      .filter(({ r, score }) => score >= 0 && (show === 'forms' ? r.forms.length > 1 : true))
      .sort((a, b) => a.score - b.score || a.r.rank - b.r.rank)
      .map(({ r }) => r);
  }, [rlib, q, show]);

  function template(list: RadicalEntry[]) {
    void pdf.run('radical-template', {
      title: show === 'forms' ? 'Radicals written more than one way' : 'Radicals',
      render: () =>
        renderRadicals(rlib, list, RADICAL_TEMPLATE, {
          title: show === 'forms' ? 'Radicals — the ones with more than one shape' : 'Radicals',
          footerNote,
        }),
    });
  }

  return (
    <>
      <p className="small muted" style={{ margin: '0 0 12px' }}>
        The pieces characters are built from. Learn to see the common ones and a new character stops
        being a picture and becomes two or three parts you already recognise. Nothing here is marked
        learned or comes round in review — open one to read it, or print the sheet.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <span className="big">空</span>
          No radical matches that.
        </div>
      ) : (
        <div className="grid">
          {rows.map((r) => {
            const form = mainForm(r);
            return (
              <ItemCard
                key={r.n}
                glyph={form.k}
                fit
                fallback={form.g}
                py={r.py}
                gloss={r.forms.length > 1 ? `${r.mean} · ${r.forms.length} forms` : r.mean}
                strokes={rlib.strokes}
                index={r.rank}
                title={`${r.mean} — ${r.forms.length === 1 ? 'one shape' : `${r.forms.length} shapes`}`}
                onClick={() => openRadical(r.n)}
                onOpen={() => openRadical(r.n)}
              />
            );
          })}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
        <button className="btn" disabled={pdf.busy !== null || !rows.length} onClick={() => template(rows)}>
          {pdf.busy === 'radical-template'
            ? 'Building…'
            : `Download the template — ${rows.length} radical${rows.length === 1 ? '' : 's'}, ${pageCount(rows.length)} pages`}
        </button>
      </div>
    </>
  );
}

const pageCount = (n: number) => Math.max(1, Math.ceil(n / RADICAL_TEMPLATE.perPage));
