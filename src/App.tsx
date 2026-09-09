import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Detail } from './components/Detail';
import { LibraryView } from './components/Library';
import { TemplateEditor } from './components/TemplateEditor';
import { TemplateGallery } from './components/Templates';
import { loadExtendedStrokes, loadLibrary } from './data/load';
import type { Library } from './data/types';
import { preloadFonts } from './pdf/fonts';
import {
  chooseFolder,
  folderSupported,
  forgetFolder,
  getFolderName,
} from './store/folder';
import {
  addToTemplate,
  buildIndex,
  createTemplate,
  exportJSON,
  getState,
  importJSON,
  resetAll,
  setSettings,
  toggleLearned,
  updateTemplate,
  useStore,
} from './store/store';
import { charId, radId, type ItemId, type ItemKind } from './store/types';

type Tab = 'library' | 'templates' | 'settings';

export default function App() {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('library');
  const [kind, setKind] = useState<ItemKind>('char');
  const [selection, setSelection] = useState<Set<ItemId>>(new Set());
  const [lastClicked, setLastClicked] = useState<ItemId | null>(null);
  const [detail, setDetail] = useState<ItemId | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);

  const templates = useStore((s) => s.templates);
  const learned = useStore((s) => s.learned);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    loadLibrary()
      .then((l) => {
        setLib(l);
        // Outlines for HSK 4-9 are a separate few megabytes. Start them in the
        // background so browsing to a higher band is instant.
        loadExtendedStrokes(l).then(() => setLib({ ...l }));
      })
      .catch((e) => setError(String(e)));
    preloadFonts().catch(() => undefined);
    getFolderName().then(setFolder);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(id);
  }, [toast]);

  const index = useMemo(() => buildIndex(templates), [templates]);
  const active = templates.find((t) => t.id === activeId) ?? null;

  // Keep the active template pointing at something real.
  useEffect(() => {
    if (activeId && !templates.some((t) => t.id === activeId)) setActiveId(null);
  }, [templates, activeId]);

  const ordered = useMemo(() => {
    if (!lib) return [] as ItemId[];
    return kind === 'char'
      ? lib.characters.map((c) => charId(c.c))
      : [...lib.radicals].sort((a, b) => a.rank - b.rank).map((r) => radId(r.n));
  }, [lib, kind]);

  function toggleSelect(id: ItemId, shift: boolean) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked) {
        // range select across the current ordering
        const a = ordered.indexOf(lastClicked);
        const b = ordered.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ordered[i]);
          return next;
        }
      }
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setLastClicked(id);
  }

  function addSelection(templateId: string) {
    const ids = [...selection];
    if (!ids.length) return;
    // Read through the store rather than the render's snapshot: adding straight
    // after creating a template would otherwise look up an id that this
    // render has not seen yet.
    const target = getState().templates.find((t) => t.id === templateId);
    if (!target) return;
    const already = new Set(target.items);
    const fresh = ids.filter((i) => !already.has(i));
    // Keep template order matching the library's teaching order.
    const rank = new Map(ordered.map((id, i) => [id, i]));
    fresh.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
    addToTemplate(templateId, fresh);
    setSelection(new Set());
    setToast(
      fresh.length === ids.length
        ? `Added ${fresh.length} to ${target.name}`
        : `Added ${fresh.length}; ${ids.length - fresh.length} were already there`,
    );
  }

  function newTemplate(forKind: ItemKind) {
    const n = templates.filter((t) => t.kind === forKind).length + 1;
    const name =
      forKind === 'char' ? `HSK 3.0 — Part ${n}` : `Radicals — Part ${n}`;
    const t = createTemplate(name, forKind);
    setActiveId(t.id);
    setTab('templates');
    return t;
  }

  if (error) {
    return (
      <div className="empty" style={{ paddingTop: 80 }}>
        <span className="big">误</span>
        <p>Could not load the data files.</p>
        <p className="small">{error}</p>
        <p className="small">
          Run <code>npm run data</code> to rebuild <code>public/data</code>.
        </p>
      </div>
    );
  }

  if (!lib) {
    return (
      <div className="empty" style={{ paddingTop: 100 }}>
        <span className="big">写</span>
        Loading characters…
      </div>
    );
  }

  const detailTemplates = detail ? (index.get(detail) ?? []) : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">写</span>
          Hanzi Workshop
        </div>
        <div className="tabs">
          {(
            [
              ['library', 'Library'],
              ['templates', `Templates${templates.length ? ` (${templates.length})` : ''}`],
              ['settings', 'Settings'],
            ] as Array<[Tab, string]>
          ).map(([id, txt]) => (
            <button key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
              {txt}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <Progress lib={lib} learned={learned} band={settings.hskBand} />
      </header>

      <main className="main">
        <div className="page">
          {tab === 'library' && (
            <>
              <LibraryView
                lib={lib}
                kind={kind}
                onKind={(k) => {
                  setKind(k);
                  setSelection(new Set());
                }}
                index={index}
                learned={learned}
                selection={selection}
                onToggle={toggleSelect}
                onOpen={setDetail}
                radicalLimit={settings.radicalLimit}
                onRadicalLimit={(n) => setSettings({ radicalLimit: n })}
                hskBand={settings.hskBand}
                onHskBand={(n) => setSettings({ hskBand: n })}
              />

              {selection.size > 0 && (
                <div className="tray">
                  <b>{selection.size} selected</b>
                  <button className="btn ghost sm" onClick={() => setSelection(new Set())}>
                    Clear
                  </button>
                  <div className="spacer" />
                  <span className="small muted">Add to</span>
                  {templates
                    .filter((t) => t.kind === kind)
                    .slice(-6)
                    .map((t) => (
                      <button key={t.id} className="btn sm" onClick={() => addSelection(t.id)}>
                        {t.name}
                      </button>
                    ))}
                  <button
                    className="btn sm primary"
                    onClick={() => {
                      const t = newTemplate(kind);
                      addSelection(t.id);
                    }}
                  >
                    + New template
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'templates' &&
            (active ? (
              <TemplateEditor
                lib={lib}
                template={active}
                footerNote={settings.footerNote}
                hasFolder={Boolean(folder)}
                onToast={setToast}
                onOpenItem={setDetail}
                onBack={() => setActiveId(null)}
                pool={
                  active.kind === 'char'
                    ? lib.characters.map((c) => charId(c.c))
                    : [...lib.radicals]
                        .sort((a, b) => a.rank - b.rank)
                        .map((r) => radId(r.n))
                }
                taken={
                  new Set(
                    templates
                      .filter((x) => x.id !== active.id)
                      .flatMap((x) => x.items),
                  )
                }
              />
            ) : (
              <TemplateGallery
                lib={lib}
                onToast={setToast}
                onOpen={(id) => {
                  setActiveId(id);
                  setTab('templates');
                }}
              />
            ))}

          {tab === 'settings' && (
            <SettingsTab
              folder={folder}
              setFolder={setFolder}
              onToast={setToast}
              footerNote={settings.footerNote}
              theme={settings.theme}
            />
          )}
        </div>
      </main>

      {detail && (
        <Detail
          lib={lib}
          id={detail}
          learned={learned.has(detail)}
          inTemplates={detailTemplates.map((t) => ({ id: t.id, name: t.name }))}
          onOpenTemplate={(id) => {
            setActiveId(id);
            setTab('templates');
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
          onToggleLearned={() => toggleLearned(detail)}
          canAdd={Boolean(active)}
          onAdd={() => {
            if (!active) return;
            addToTemplate(active.id, [detail]);
            setToast(`Added to ${active.name}`);
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Progress({
  lib,
  learned,
  band,
}: {
  lib: Library;
  learned: Set<ItemId>;
  band: number;
}) {
  // Measured against the band you are actually working on. Counting towards
  // 3000 would make a good week look like nothing happened.
  const scope = band
    ? lib.characters.filter((c) => c.hsk === band)
    : lib.characters;
  const total = scope.length || 1;
  const done = scope.filter((c) => learned.has(charId(c.c))).length;
  const label = band === 7 ? 'HSK 7–9' : band ? `HSK ${band}` : 'all bands';
  return (
    <div
      style={{ width: 210 }}
      title={`${done} of ${total} learned in ${label}`}
    >
      <div className="tiny muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{done} learned</span>
        <span>{label}</span>
      </div>
      <div className="bar" style={{ marginTop: 4 }}>
        <i className="learned" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}

function SettingsTab({
  folder,
  setFolder,
  onToast,
  footerNote,
  theme,
}: {
  folder: string | null;
  setFolder: (n: string | null) => void;
  onToast: (m: string) => void;
  footerNote: string;
  theme: 'system' | 'light' | 'dark';
}) {
  return (
    <section style={{ maxWidth: 620, display: 'grid', gap: 16 }}>
      <h1>Settings</h1>

      <div className="card">
        <header>
          <h2>Where worksheets go</h2>
        </header>
        <div className="body">
          {folderSupported() ? (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                Pick a folder once and every PDF lands there automatically, named
                after its template and dated, so you can find them again.
              </p>
              <div className="row">
                <button
                  className="btn"
                  onClick={async () => {
                    const h = await chooseFolder();
                    if (h) {
                      setFolder(h.name);
                      onToast(`Worksheets will be saved to ${h.name}`);
                    }
                  }}
                >
                  {folder ? 'Choose a different folder' : 'Choose folder'}
                </button>
                {folder && (
                  <>
                    <span className="small">
                      Saving to <b>{folder}</b>
                    </span>
                    <button
                      className="btn ghost sm"
                      onClick={async () => {
                        await forgetFolder();
                        setFolder(null);
                        onToast('Worksheets will download normally again');
                      }}
                    >
                      Forget
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              This browser cannot write to a folder directly, so worksheets will
              download the usual way. Chrome or Edge supports it.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Appearance &amp; footer</h2>
        </header>
        <div className="body" style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            Theme
            <select
              value={theme}
              onChange={(e) =>
                setSettings({ theme: e.target.value as 'system' | 'light' | 'dark' })
              }
            >
              <option value="system">Match my system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="field">
            Footer note on every sheet
            <input
              type="text"
              value={footerNote}
              placeholder="your name, a class, anything"
              onChange={(e) => setSettings({ footerNote: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <header>
          <h2>Backup</h2>
        </header>
        <div className="body">
          <p className="small muted" style={{ marginTop: 0 }}>
            Templates and progress live in this browser. Export a
            copy to keep them safe or move to another machine.
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                const blob = new Blob([exportJSON()], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `hanzi-workshop ${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 8000);
              }}
            >
              Export
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              Import
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const res = importJSON(await f.text());
                  onToast(res.ok ? 'Backup restored' : res.error);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="spacer" />
            <button
              className="btn danger sm"
              onClick={() => {
                if (
                  confirm(
                    'Delete all templates, progress and history? This cannot be undone.',
                  )
                ) {
                  resetAll();
                  onToast('Everything cleared');
                }
              }}
            >
              Reset everything
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export { updateTemplate };
