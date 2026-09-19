import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import {
  claimedItems,
  itemsInScope,
  pagesFor,
  printName,
  scopeLabel,
  statsOf,
  type Collection,
  type ScopeMode,
} from '../../domain/collection';
import { countLabel } from '../../domain/ids';
import { paths, type CollectionTab } from '../../navigation/paths';
import { fitFor, renderCollection, renderRecall } from '../../pdf/render';
import {
  deleteCollection,
  duplicateCollection,
  recordSheet,
  renameCollection,
  setScope,
} from '../../store/commands';
import { useStore } from '../../store/store';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { ItemBoard } from './ItemBoard';
import { SheetDesigner } from './SheetDesigner';
import { WordList } from './WordList';

interface Props {
  c: Collection;
  tab: CollectionTab;
}

/** How many pages of a long collection the live preview bothers to build. */
const PREVIEW_PAGES = 3;

const SCOPES: Array<[ScopeMode, string]> = [
  ['all', 'Everything'],
  ['unlearned', 'Not yet learned'],
  ['due', 'Due for review'],
  ['weak', 'The ones I miss'],
  ['range', 'A range'],
];

export function CollectionEditor({ c, tab }: Props) {
  useTitle(c.name || 'Collection');
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const collections = useStore((s) => s.collections);
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);
  const footerNote = useStore((s) => s.settings.footerNote);
  const [url, setUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const urlRef = useRef<string | null>(null);

  const taken = useMemo(() => claimedItems(collections, c.id), [collections, c.id]);
  const items = useMemo(() => itemsInScope(c, learned, recall), [c, learned, recall]);
  const stats = statsOf(c, learned, recall);
  const fit = useMemo(() => fitFor(lib, c, items), [lib, c, items]);
  const preview = useMemo(() => items.slice(0, c.sheet.perPage * PREVIEW_PAGES), [items, c.sheet.perPage]);

  // The preview is the document itself, not a mock-up of it — a worksheet is
  // something you flick through before committing it to paper. Only the first
  // few pages, though, and only while the preview is on screen: rebuilding
  // forty pages on every click of a checkbox makes the checkbox feel broken,
  // and rebuilding it for each character added on the Items tab is waste.
  const key = JSON.stringify([preview, c.sheet, c.name, footerNote]);

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
        const { bytes } = await renderCollection(lib, c, preview, {
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
  }, [key, lib, tab]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function download() {
    const title = printName(c);
    void pdf.run('worksheet', {
      title,
      render: () => renderCollection(lib, c, items, { footerNote, title }),
    });
  }

  /**
   * The same characters with the answers taken away.
   *
   * Printed, it is a test; recorded, it is the only evidence the schedule ever
   * gets about handwriting, which happens where the app cannot watch. So the
   * run is logged the moment it leaves for the printer and waits in Review to
   * be marked.
   */
  function testSheet() {
    const title = `${c.name} — from memory`;
    void pdf.run('test', {
      title,
      render: () => renderRecall(lib, items, c.sheet, { title, footerNote }),
      after: () => {
        recordSheet(title, items);
        return 'Mark it in Review once you have written it.';
      },
    });
  }

  function duplicate() {
    const copy = duplicateCollection(c.id);
    if (!copy) return;
    navigate(paths.collection(copy.id));
    toast(`This is the copy, “${copy.name}”. The original is still in Collections.`);
  }

  function remove() {
    if (!confirm(`Delete “${c.name}”? The characters stay in the library.`)) return;
    // Off the page first: once the collection is gone there is nothing here to show.
    navigate(paths.collections(), { replace: true, flushSync: true });
    deleteCollection(c.id);
  }

  const busy = pdf.busy !== null;

  return (
    <section>
      {/* --------------------------------------------------------- toolbar */}
      <div className="editor-bar">
        <Link className="btn ghost sm" to={paths.collections()} title="Back to all collections">
          ←
        </Link>
        <input
          className="title-input"
          value={c.name}
          onChange={(e) => renameCollection(c.id, e.target.value)}
          aria-label="Collection name"
        />
        <span className="badge">{countLabel(stats.total)}</span>
        {stats.learned > 0 && (
          <span className={`badge ${stats.learned === stats.total ? 'done' : ''}`}>{stats.learned} learned</span>
        )}
        <div className="spacer" />
        <button
          className="btn"
          onClick={testSheet}
          disabled={busy || !items.length}
          title="The same characters with no model to copy — the reading and the meaning, empty squares, and the answers under a fold"
        >
          {pdf.busy === 'test' ? 'Building…' : 'Test sheet'}
        </button>
        <button className="btn primary" onClick={download} disabled={busy || !items.length}>
          {pdf.busy === 'worksheet' ? 'Building…' : `Download ${stats.pages} page${stats.pages === 1 ? '' : 's'}`}
        </button>
      </div>

      {/* ----------------------------------------------------- print scope */}
      <div className="scope-bar">
        <span className="tiny muted">Put on paper</span>
        <div className="chips">
          {SCOPES.map(([id, label]) => (
            <button
              key={id}
              className="chip"
              aria-pressed={c.scope.mode === id}
              onClick={() => setScope(c.id, { mode: id })}
            >
              {label}
            </button>
          ))}
        </div>
        {c.scope.mode === 'range' && (
          <>
            <label className="inline-field">
              from #
              <input
                type="number"
                min={1}
                max={Math.max(1, c.items.length)}
                value={c.scope.from}
                onChange={(e) => setScope(c.id, { from: Number(e.target.value) })}
              />
            </label>
            <label className="inline-field">
              take
              <input
                type="number"
                min={1}
                max={Math.max(1, c.items.length)}
                value={c.scope.count}
                onChange={(e) => setScope(c.id, { count: Number(e.target.value) })}
              />
            </label>
          </>
        )}
        <div className="spacer" />
        <span className="tiny muted">
          {scopeLabel(c, learned, recall)} · {stats.pages} page{stats.pages === 1 ? '' : 's'}
        </span>
      </div>

      {/* Tabs of one page rather than pages of their own: switching replaces the
          history entry, so the back button leaves the collection. */}
      <nav className="tabs" aria-label="This collection" style={{ margin: '14px 0 12px', display: 'inline-flex' }}>
        <NavLink to={paths.collection(c.id)} end replace>
          Design
        </NavLink>
        <NavLink to={paths.collection(c.id, 'items')} replace>
          Items ({c.items.length})
        </NavLink>
        {c.words?.length ? (
          <NavLink to={paths.collection(c.id, 'words')} replace>
            Words ({c.words.length})
          </NavLink>
        ) : null}
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
                    ? `first ${pagesFor(preview.length, c.sheet.perPage)} of ${stats.pages} pages`
                    : `all ${stats.pages} page${stats.pages === 1 ? '' : 's'}`}
              </span>
            </header>
            <div className="body">
              {url && preview.length ? (
                <iframe className="preview" src={`${url}#toolbar=0&navpanes=0`} title="Worksheet preview" />
              ) : (
                <div className="empty">
                  <span className="big">纸</span>
                  {c.items.length ? 'Nothing in the range you picked.' : 'Nothing in this collection yet.'}
                  <div style={{ marginTop: 14 }}>
                    <Link className="btn sm" to={paths.collection(c.id, 'items')} replace>
                      Add some
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card side">
            <div className="body">
              <SheetDesigner c={c} fit={fit} />
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
      ) : tab === 'words' ? (
        <WordList c={c} />
      ) : (
        <ItemBoard c={c} taken={taken} />
      )}
    </section>
  );
}
