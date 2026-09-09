import { useEffect, useMemo, useRef, useState } from 'react';
import type { Library } from '../data/types';
import { practiceRowsFor, renderTemplate } from '../pdf/render';
import { download, safeFileName, saveToFolder } from '../store/folder';
import {
  deleteTemplate,
  duplicateTemplate,
  removeFromTemplate,
  reorderTemplate,
  setLearned,
  setTemplateOptions,
  toggleLearned,
  updateTemplate,
  useStore,
} from '../store/store';
import type {
  Density,
  GridStyle,
  ItemId,
  SheetOptions,
  SquareSize,
  Template,
} from '../store/types';
import { ItemList } from './ItemList';

interface Props {
  lib: Library;
  template: Template;
  footerNote: string;
  hasFolder: boolean;
  onToast: (msg: string) => void;
  onOpenItem: (id: ItemId) => void;
  onBack: () => void;
  /** everything of this kind, in library order, for "fill with the next N" */
  pool: ItemId[];
  /** ids already sitting in some other template */
  taken: Set<ItemId>;
}

type Panel = 'layout' | 'content' | 'items';

const TOGGLES: Array<{ key: keyof SheetOptions; label: string; hint: string }> = [
  { key: 'strokeOrder', label: 'Stroke order strip', hint: 'Each stroke added one at a time' },
  { key: 'memoryAids', label: 'Memory aids', hint: 'The parts it is built from, and where it comes from' },
  { key: 'componentColours', label: 'Colour strokes by part', hint: 'Makes the structure visible at a glance' },
  { key: 'words', label: 'Common words', hint: 'Two or three words with pinyin and meaning' },
  { key: 'sentence', label: 'Example sentence', hint: 'One short sentence with a translation' },
  { key: 'confusables', label: "Don't confuse with", hint: 'Lookalikes, and warnings on similar radicals' },
  { key: 'traditional', label: 'Traditional form', hint: 'Only shown when it differs' },
  { key: 'pinyinPrompt', label: 'Pinyin under the grid', hint: 'Write from the sound, without the character' },
];

export function TemplateEditor({
  lib,
  template: t,
  footerNote,
  hasFolder,
  onToast,
  onOpenItem,
  onBack,
  pool,
  taken,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>('layout');
  const urlRef = useRef<string | null>(null);

  const o = t.options;
  const pages = Math.max(1, Math.ceil(t.items.length / Math.max(1, o.perPage)));
  const fit = useMemo(() => practiceRowsFor(lib, t), [lib, t]);

  const learned = useStore((st) => st.learned);
  const [picked, setPicked] = useState<Set<ItemId>>(new Set());
  const [lastPick, setLastPick] = useState<ItemId | null>(null);

  // The preview is the whole document, not a sample: a worksheet is something
  // you flick through before committing it to paper.
  const previewKey = JSON.stringify([t.items, o, t.name, footerNote]);

  useEffect(() => {
    let cancelled = false;
    if (t.items.length === 0) {
      setUrl(null);
      return;
    }
    setBuilding(true);
    const id = setTimeout(async () => {
      try {
        const { bytes } = await renderTemplate(lib, t, { footerNote });
        if (cancelled) return;
        const next = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        );
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
      } catch (err) {
        if (!cancelled) onToast(`Preview failed: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, lib]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  async function generate() {
    if (!t.items.length) return;
    setBusy(true);
    try {
      const { bytes, pages: n } = await renderTemplate(lib, t, { footerNote });
      const fileName = safeFileName(t.name);
      const saved = hasFolder ? await saveToFolder(fileName, bytes) : false;
      if (!saved) download(fileName, bytes);
      onToast(
        saved
          ? `Saved ${fileName} to your folder — ${n} pages`
          : `Downloaded ${fileName} — ${n} pages`,
      );
    } catch (err) {
      onToast(`Could not build the PDF: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  /** Tops the template up with the next untouched items from the library. */
  function fill(n: number) {
    const have = new Set(t.items);
    const next = pool.filter((id) => !have.has(id) && !taken.has(id)).slice(0, n);
    if (!next.length) {
      onToast('Nothing left that is not already in a template');
      return;
    }
    reorderTemplate(t.id, [...t.items, ...next]);
    onToast(`Added the next ${next.length}`);
  }

  return (
    <section>
      {/* --------------------------------------------------------- toolbar */}
      <div className="editor-bar">
        <button className="btn ghost sm" onClick={onBack} title="Back to all templates">
          ←
        </button>
        <input
          className="title-input"
          value={t.name}
          onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
          aria-label="Template name"
        />
        <span className="badge">
          {t.items.length} {t.kind === 'char' ? 'characters' : 'radicals'}
        </span>
        <span className="badge">{pages} pages</span>
        <div className="spacer" />
        <button className="btn primary" onClick={generate} disabled={busy || !t.items.length}>
          {busy ? 'Building…' : 'Download PDF'}
        </button>
      </div>

      <div className="split">
        <div className="card">
          <header>
            <h2>Preview</h2>
            <span className="small muted">
              {building ? 'building…' : t.items.length ? `all ${pages} pages` : ''}
            </span>
            <div className="spacer" />
            <span className="small muted">
              {fit.rows > 0
                ? `at least ${fit.rows} × ${fit.cols} squares each`
                : 'no room to write — turn something off'}
            </span>
          </header>
          <div className="body">
            {url ? (
              <iframe
                className="preview"
                src={`${url}#toolbar=0&navpanes=0`}
                title="Worksheet preview"
              />
            ) : (
              <div className="empty">
                <span className="big">纸</span>
                Nothing in this template yet.
                <div style={{ marginTop: 14 }}>
                  <button className="btn sm" onClick={() => fill(o.perPage * 10)}>
                    Fill with the next {o.perPage * 10}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- panels */}
        <div className="card side">
          <header style={{ padding: 8, gap: 4 }}>
            <div className="tabs" style={{ width: '100%' }}>
              {(
                [
                  ['layout', 'Layout'],
                  ['content', 'Content'],
                  ['items', `Items (${t.items.length})`],
                ] as Array<[Panel, string]>
              ).map(([id, txt]) => (
                <button
                  key={id}
                  aria-selected={panel === id}
                  onClick={() => setPanel(id)}
                  style={{ flex: 1 }}
                >
                  {txt}
                </button>
              ))}
            </div>
          </header>

          <div className="body">
            {panel === 'layout' && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="row" style={{ gap: 12 }}>
                  <label className="field" style={{ flex: 1 }}>
                    Per page
                    <select
                      value={o.perPage}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { perPage: Number(e.target.value) })
                      }
                    >
                      {(t.kind === 'char'
                        ? [1, 2, 3, 4, 5, 6]
                        : [3, 4, 5, 6, 7, 8]
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ flex: 1.4 }}>
                    Squares
                    <select
                      value={o.gridStyle}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { gridStyle: e.target.value as GridStyle })
                      }
                    >
                      <option value="mizi">米字格 rice grid</option>
                      <option value="tian">田字格 cross</option>
                      <option value="blank">Plain box</option>
                    </select>
                  </label>
                </div>

                <div className="row" style={{ gap: 12 }}>
                  <label className="field" style={{ flex: 1 }}>
                    Density
                    <select
                      value={o.density ?? 'comfortable'}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { density: e.target.value as Density })
                      }
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    Square size
                    <select
                      value={o.squareSize ?? 'medium'}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { squareSize: e.target.value as SquareSize })
                      }
                    >
                      <option value="large">Large, about 15 mm</option>
                      <option value="medium">Medium, about 13 mm</option>
                      <option value="small">Small, about 11 mm</option>
                    </select>
                  </label>
                </div>
                <p className="tiny muted" style={{ margin: '-6px 0 0' }}>
                  Both densities lay the block out in two columns — how it is
                  written on the left, how it is used on the right. Compact just
                  sets it smaller, which fits three or four characters a page.
                </p>

                <label className="field">
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span>Practice rows</span>
                    <b>
                      {fit.rows} of {Math.max(1, fit.maxRows)}
                    </b>
                  </span>
                  {/* Capped at what the page can actually hold: dragging past
                      that used to move the handle without changing anything. */}
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, fit.maxRows)}
                    value={Math.min(o.practiceRows, Math.max(1, fit.maxRows))}
                    disabled={fit.maxRows <= 1}
                    onChange={(e) =>
                      setTemplateOptions(t.id, { practiceRows: Number(e.target.value) })
                    }
                  />
                  <span className="tiny muted">
                    {fit.maxRows <= 1
                      ? 'Only one row fits. Try Compact, smaller squares, or fewer per page.'
                      : `The page holds up to ${fit.maxRows} rows at these settings.`}
                  </span>
                </label>

                {fit.dropped.length > 0 && (
                  <p className="notice">
                    No room for <b>{fit.dropped.join(', ')}</b> at {o.perPage} per page,
                    so they are being left off. Switch Density to Compact, or drop to{' '}
                    {Math.max(1, o.perPage - 1)} per page, and they come back.
                  </p>
                )}

                <div className="row" style={{ gap: 12 }}>
                  <label className="field" style={{ flex: 1 }}>
                    Trace
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={o.traceCount}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { traceCount: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="field" style={{ flex: 1 }}>
                    Faint
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={o.fadeCount}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { fadeCount: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <p className="tiny muted" style={{ margin: 0 }}>
                  The first {o.traceCount} squares are solid enough to trace and the next{' '}
                  {o.fadeCount} are faint; the rest are yours.
                </p>
              </div>
            )}

            {panel === 'content' && (
              <div>
                {TOGGLES.map((tg) => (
                  <label key={tg.key} className="toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(o[tg.key])}
                      onChange={(e) =>
                        setTemplateOptions(t.id, { [tg.key]: e.target.checked })
                      }
                    />
                    <span>
                      {tg.label}
                      <span className="d">{tg.hint}</span>
                    </span>
                  </label>
                ))}
                <div className="subtle-rule" />
                <div className="row">
                  <button
                    className="btn sm"
                    onClick={() =>
                      setTemplateOptions(t.id, {
                        memoryAids: true,
                        words: true,
                        sentence: true,
                        confusables: true,
                        strokeOrder: true,
                        componentColours: true,
                      })
                    }
                  >
                    Everything on
                  </button>
                  <button
                    className="btn sm"
                    onClick={() =>
                      setTemplateOptions(t.id, {
                        memoryAids: false,
                        words: false,
                        sentence: false,
                        confusables: false,
                        practiceRows: 10,
                      })
                    }
                  >
                    Just writing room
                  </button>
                </div>
              </div>
            )}

            {panel === 'items' && (
              <div>
                <div className="row" style={{ marginBottom: 10 }}>
                  <button className="btn sm" onClick={() => fill(o.perPage * 2)}>
                    + Next {o.perPage * 2}
                  </button>
                  <button
                    className="btn sm"
                    disabled={t.kind !== 'char'}
                    onClick={() => {
                      const sorted = [...t.items].sort(
                        (a, b) =>
                          (lib.byChar.get(a.slice(1))?.i ?? 0) -
                          (lib.byChar.get(b.slice(1))?.i ?? 0),
                      );
                      reorderTemplate(t.id, sorted);
                    }}
                  >
                    Sort
                  </button>
                  <div className="spacer" />
                  {t.items.length > 0 && (
                    <button
                      className="btn ghost sm"
                      onClick={() => removeFromTemplate(t.id, t.items)}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {t.items.length === 0 ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    Pick items in the Library and add them here, or use the button
                    above to take the next ones nothing else has claimed.
                  </p>
                ) : (
                  <>
                    <div className="row bulk">
                      <button
                        className="btn sm"
                        onClick={() =>
                          setPicked(
                            picked.size === t.items.length ? new Set() : new Set(t.items),
                          )
                        }
                      >
                        {picked.size === t.items.length ? 'Select none' : 'Select all'}
                      </button>
                      <span className="tiny muted grow">
                        {picked.size ? `${picked.size} selected` : 'drag a row to reorder'}
                      </span>
                      <button
                        className="btn sm"
                        disabled={!picked.size}
                        onClick={() => {
                          setLearned([...picked], true);
                          onToast(`Marked ${picked.size} as learned`);
                          setPicked(new Set());
                        }}
                      >
                        Mark learned
                      </button>
                      <button
                        className="btn sm"
                        disabled={!picked.size}
                        onClick={() => {
                          setLearned([...picked], false);
                          setPicked(new Set());
                        }}
                      >
                        Unmark
                      </button>
                    </div>

                    <ItemList
                      lib={lib}
                      items={t.items}
                      learned={learned}
                      selected={picked}
                      onReorder={(next) => reorderTemplate(t.id, next)}
                      onRemove={(id) => removeFromTemplate(t.id, [id])}
                      onOpen={onOpenItem}
                      onToggleLearned={toggleLearned}
                      onToggleSelect={(id, shift) => {
                        const next = new Set(picked);
                        if (shift && lastPick) {
                          const a = t.items.indexOf(lastPick);
                          const b = t.items.indexOf(id);
                          if (a >= 0 && b >= 0) {
                            const [lo, hi] = a < b ? [a, b] : [b, a];
                            for (let i = lo; i <= hi; i++) next.add(t.items[i]);
                            setPicked(next);
                            setLastPick(id);
                            return;
                          }
                        }
                        next.has(id) ? next.delete(id) : next.add(id);
                        setPicked(next);
                        setLastPick(id);
                      }}
                    />
                  </>
                )}

                <div className="subtle-rule" />
                <div className="row">
                  <button
                    className="btn sm"
                    disabled={!t.items.length}
                    onClick={() => {
                      setLearned(t.items, true);
                      onToast(`Marked all ${t.items.length} as learned`);
                    }}
                  >
                    Mark everything learned
                  </button>
                  <button className="btn sm" onClick={() => duplicateTemplate(t.id)}>
                    Duplicate
                  </button>
                </div>
              </div>
            )}
          </div>

          <footer className="card-foot">
            <span className="tiny muted">
              {t.items.filter((i) => learned.has(i)).length} of {t.items.length} learned
            </span>
            <div className="spacer" />
            <button
              className="btn danger sm"
              onClick={() => {
                if (confirm(`Delete “${t.name}”? The characters stay in the library.`)) {
                  deleteTemplate(t.id);
                  onBack();
                }
              }}
            >
              Delete
            </button>
          </footer>
        </div>
      </div>
    </section>
  );
}
