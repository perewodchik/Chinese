import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { RadicalEntry } from '../../data/radicals';
import { mainForm, searchScore } from '../../domain/radicals/forms';
import { RADICAL_TEMPLATE } from '../../domain/radicals/sheet';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useOpenRadical, useRadicalDrawer } from '../../navigation/radicalDrawer';
import { renderRadicals } from '../../pdf/radicals/render';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useTitle } from '../../ui/useTitle';
import { usePdfExport } from '../shared/usePdfExport';
import { RadicalDrawer } from './RadicalDrawer';
import { RadicalGate, useRadicalLibrary } from './radicalData';
import './home.css';

type RadicalShow = 'all' | 'forms';

/**
 * The 214 radicals, at /library/radicals, as reference.
 *
 * They used to be a section of their own with sets, sheets to design and a
 * tick against each one, which made them look like a second syllabus to get
 * through. They are not: they are the parts characters are made of, and the
 * use of them is to look one up and recognise it next time. So they cannot
 * be marked, queued or reviewed, and the only thing to do with them besides
 * reading is to print the reference sheet.
 *
 * Ordered by how much of the syllabus each one unlocks rather than by Kangxi
 * number — the number is a place in a dictionary; this order is what to look
 * at first.
 */
export function RadicalsPage() {
  useTitle('Radicals');
  const drawer = useRadicalDrawer();
  return (
    <RadicalGate>
      <RadicalShelf />
      {drawer.radical !== null && <RadicalDrawer n={drawer.radical} onClose={drawer.close} />}
    </RadicalGate>
  );
}

function RadicalShelf() {
  const rlib = useRadicalLibrary();
  const openRadical = useOpenRadical();
  const pdf = usePdfExport();
  const footerNote = useStore((s) => s.settings.footerNote);
  const printPalette = useStore((s) => s.settings.printPalette);
  const [query, setQuery] = useQuery();
  const show = oneOf<RadicalShow>(query.get('show'), ['forms'], 'all');
  // The box keeps its own state and writes it into the address behind
  // itself, so a search from the library's box arrives already typed.
  const [q, setQ] = useState(query.get('q') ?? '');

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
        renderRadicals(rlib, list, { ...RADICAL_TEMPLATE, palette: printPalette }, {
          title: show === 'forms' ? 'Radicals — the ones with more than one shape' : 'Radicals',
          footerNote,
        }),
    });
  }

  return (
    <div className="set-page">
      <header className="page-head">
        <Link className="back-link" to={paths.library()}>
          <Icon name="back" />
          Library
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="What to do with them" className="icon-btn">
          {(close) => (
            <>
              <button
                role="menuitem"
                className="btn ghost sm"
                disabled={pdf.busy !== null || !rows.length}
                onClick={() => (close(), template(rows))}
              >
                Print the reference sheet
                <span className="tiny muted">
                  {rows.length} radical{rows.length === 1 ? '' : 's'}, {pageCount(rows.length)} page{pageCount(rows.length) === 1 ? '' : 's'}
                </span>
              </button>
              <Link role="menuitem" className="btn ghost sm" to={paths.family()} onClick={close}>
                Families
                <span className="tiny muted">what one part grows into, drawn as a tree</span>
              </Link>
            </>
          )}
        </Menu>
      </header>

      <h1 className="set-title">Radicals</h1>
      <p className="set-blurb">
        The parts characters are built from. Learn to see the common ones and a new character stops being a picture
        and becomes two or three parts you already recognise. Commonest first.
      </p>
      {pdf.busy === 'radical-template' && <p className="small muted">Making the sheet…</p>}

      <div className="set-filter">
        <label className="search set-search">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setQuery('q', e.target.value);
            }}
            placeholder="氵, shui or water"
            aria-label="Search the radicals"
          />
        </label>
        <div className="chips">
          <button className="chip" aria-pressed={show === 'forms'} onClick={() => setQuery('show', show === 'forms' ? 'all' : 'forms', 'all')}>
            Several shapes
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="muted set-empty">No radical matches that.</p>
      ) : (
        <div className="lib-tiles">
          {rows.map((r) => {
            const form = mainForm(r);
            return (
              <button
                key={r.n}
                className="lib-tile"
                onClick={() => openRadical(r.n)}
                aria-label={`${form.g}, ${r.py}, ${r.mean}${r.forms.length > 1 ? `, ${r.forms.length} shapes` : ''}`}
              >
                <span className="lib-sq lib-sq-glyph" aria-hidden>
                  <Glyph char={form.k} strokes={rlib.strokes} size={64} fit fallback={form.g} />
                </span>
                <span className="lib-py">{r.py}</span>
                <span className="lib-gloss">{r.mean}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const pageCount = (n: number) => Math.max(1, Math.ceil(n / RADICAL_TEMPLATE.perPage));
