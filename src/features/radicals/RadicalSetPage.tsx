import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router';
import {
  radicalPages,
  radicalPrintName,
  radicalScopeLabel,
  radicalSetStats,
  radicalsInScope,
  type RadicalScopeMode,
  type RadicalSet,
} from '../../domain/radicals/sets';
import { paths, type EditorTab } from '../../navigation/paths';
import { radicalFit, renderRadicals } from '../../pdf/radicals/render';
import { deleteRadicalSet, duplicateRadicalSet, renameRadicalSet, setRadicalScope } from '../../store/radicals';
import { useStore } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { usePdfExport } from '../shared/usePdfExport';
import { RadicalBoard } from './RadicalBoard';
import { RadicalDesigner } from './RadicalDesigner';
import { useRadicalLibrary } from './library';

/** One set: /radicals/sets/:id for how it prints, /radicals/sets/:id/items for what is in it. */
export function RadicalSetPage() {
  const { setId = '', tab } = useParams();
  const set = useStore((s) => s.radicals.sets.find((x) => x.id === setId) ?? null);

  if (tab !== undefined && tab !== 'items') return <Navigate to={paths.radicalSet(setId)} replace />;
  if (!set) return <Missing />;
  return <RadicalSetEditor key={set.id} set={set} tab={tab === 'items' ? 'items' : 'design'} />;
}

function Missing() {
  useTitle('Set not found');
  return (
    <div className="empty">
      <span className="big">空</span>
      <p>This set is not here. It may have been deleted — on this device, or on another one.</p>
      <Link className="btn" to={paths.radicalSets()}>
        All radical sets
      </Link>
    </div>
  );
}

/** How many pages of a long set the live preview bothers to build. */
const PREVIEW_PAGES = 3;

const SCOPES: Array<[RadicalScopeMode, string]> = [
  ['all', 'Everything'],
  ['unknown', 'Not known yet'],
  ['range', 'A range'],
];

function RadicalSetEditor({ set, tab }: { set: RadicalSet; tab: EditorTab }) {
  useTitle(set.name || 'Radicals');
  const rlib = useRadicalLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const known = useStore((s) => s.radicals.known);
  const footerNote = useStore((s) => s.settings.footerNote);
  const [url, setUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const urlRef = useRef<string | null>(null);

  const numbers = useMemo(() => radicalsInScope(set, known), [set, known]);
  const items = useMemo(
    () => numbers.map((n) => rlib.byNumber.get(n)).filter((r) => r !== undefined),
    [numbers, rlib],
  );
  const stats = radicalSetStats(set, known);
  const fit = useMemo(() => radicalFit(items, set.sheet), [items, set.sheet]);
  const preview = useMemo(
    () => items.slice(0, set.sheet.perPage * PREVIEW_PAGES),
    [items, set.sheet.perPage],
  );

  // The preview is the document itself, not a mock-up of it, and only its first
  // pages: rebuilding forty on every click of a checkbox makes the checkbox
  // feel broken.
  const key = JSON.stringify([numbers.slice(0, preview.length), set.sheet, set.name, footerNote]);

  useEffect(() => {
    if (tab !== 'design') return;
    let cancelled = false;
    if (!preview.length) {
      setUrl(null);
      return;
    }
    setBuilding(true);
    const id = setTimeout(async () => {
      try {
        const { bytes } = await renderRadicals(rlib, preview, set.sheet, {
          title: set.name,
          footerNote,
          total: items.length,
          pages: stats.pages,
        });
        if (cancelled) return;
        const next = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
      } catch (err) {
        if (!cancelled) toast(`Preview failed: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rlib, tab]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function download() {
    const title = radicalPrintName(set);
    void pdf.run('sheet', {
      title,
      render: () => renderRadicals(rlib, items, set.sheet, { title, footerNote }),
    });
  }

  function duplicate() {
    const copy = duplicateRadicalSet(set.id);
    if (!copy) return;
    navigate(paths.radicalSet(copy.id));
    toast(`This is the copy, “${copy.name}”. The original is still in Sets.`);
  }

  function remove() {
    if (!confirm(`Delete “${set.name}”? The radicals stay where they are.`)) return;
    // Off the page first: once the set is gone there is nothing here to show.
    navigate(paths.radicalSets(), { replace: true, flushSync: true });
    deleteRadicalSet(set.id);
  }

  return (
    <section>
      <div className="editor-bar">
        <Link className="btn ghost sm" to={paths.radicalSets()} title="Back to all radical sets">
          ←
        </Link>
        <input
          className="title-input"
          value={set.name}
          onChange={(e) => renameRadicalSet(set.id, e.target.value)}
          aria-label="Set name"
        />
        <span className="badge">{stats.total} radicals</span>
        {stats.known > 0 && (
          <span className={`badge ${stats.known === stats.total ? 'done' : ''}`}>
            {stats.known} known
          </span>
        )}
        <div className="spacer" />
        <button className="btn primary" onClick={download} disabled={pdf.busy !== null || !items.length}>
          {pdf.busy === 'sheet' ? 'Building…' : `Download ${stats.pages} page${stats.pages === 1 ? '' : 's'}`}
        </button>
      </div>

      <div className="scope-bar">
        <span className="tiny muted">Put on paper</span>
        <div className="chips">
          {SCOPES.map(([id, label]) => (
            <button
              key={id}
              className="chip"
              aria-pressed={set.scope.mode === id}
              onClick={() => setRadicalScope(set.id, { mode: id })}
            >
              {label}
            </button>
          ))}
        </div>
        {set.scope.mode === 'range' && (
          <>
            <label className="inline-field">
              from #
              <input
                type="number"
                min={1}
                max={Math.max(1, set.items.length)}
                value={set.scope.from}
                onChange={(e) => setRadicalScope(set.id, { from: Number(e.target.value) })}
              />
            </label>
            <label className="inline-field">
              take
              <input
                type="number"
                min={1}
                max={Math.max(1, set.items.length)}
                value={set.scope.count}
                onChange={(e) => setRadicalScope(set.id, { count: Number(e.target.value) })}
              />
            </label>
          </>
        )}
        <div className="spacer" />
        <span className="tiny muted">
          {radicalScopeLabel(set, known)} · {stats.pages} page{stats.pages === 1 ? '' : 's'}
        </span>
      </div>

      <nav className="tabs" aria-label="This set" style={{ margin: '14px 0 12px', display: 'inline-flex' }}>
        <NavLink to={paths.radicalSet(set.id)} end replace>
          Design
        </NavLink>
        <NavLink to={paths.radicalSet(set.id, 'items')} replace>
          Radicals ({set.items.length})
        </NavLink>
      </nav>

      {tab === 'design' ? (
        <div className="split">
          <div className="card">
            <header>
              <h2>Preview</h2>
              <span className="small muted">
                {building
                  ? 'building…'
                  : items.length > preview.length
                    ? `first ${radicalPages(preview.length, set.sheet.perPage)} of ${stats.pages} pages`
                    : `all ${stats.pages} page${stats.pages === 1 ? '' : 's'}`}
              </span>
            </header>
            <div className="body">
              {url && preview.length ? (
                <iframe className="preview" src={`${url}#toolbar=0&navpanes=0`} title="Radical sheet preview" />
              ) : (
                <div className="empty">
                  <span className="big">纸</span>
                  {set.items.length ? 'Nothing in the range you picked.' : 'Nothing in this set yet.'}
                  <div style={{ marginTop: 14 }}>
                    <Link className="btn sm" to={paths.radicalSet(set.id, 'items')} replace>
                      Add some
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card side">
            <div className="body">
              <RadicalDesigner set={set} fit={fit} />
            </div>
            <footer className="card-foot">
              <button className="btn sm" onClick={duplicate}>
                Duplicate
              </button>
              <div className="spacer" />
              <button className="btn danger sm" onClick={remove}>
                Delete
              </button>
            </footer>
          </div>
        </div>
      ) : (
        <RadicalBoard set={set} />
      )}
    </section>
  );
}
