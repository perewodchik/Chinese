import { useMemo, useState } from 'react';
import type { Library } from '../data/types';
import {
  allPresets,
  GROUP_BLURB,
  GROUP_LABEL,
  type Preset,
  type PresetGroup,
} from '../presets';
import {
  createSeries,
  createTemplate,
  deleteCollection,
  useStore,
} from '../store/store';
import { radId, type ItemId, type ItemKind, type Template } from '../store/types';
import { AddSetDialog } from './AddSetDialog';
import { Glyph } from './Glyph';

interface Props {
  lib: Library;
  onOpen: (id: string) => void;
  onToast: (m: string) => void;
}

const GROUPS: PresetGroup[] = ['hsk', 'radicals', 'theme'];

export function glyphOf(lib: Library, id: ItemId): string {
  if (id.startsWith('r')) {
    return lib.radicals.find((r) => radId(r.n) === id)?.r ?? '';
  }
  return id.slice(1);
}

/** A row of characters, as a compact visual fingerprint for a card. */
export function Strip({
  lib,
  chars,
  size = 21,
  max = 9,
}: {
  lib: Library;
  chars: string[];
  size?: number;
  max?: number;
}) {
  return (
    <div className="strip" aria-hidden>
      {chars.slice(0, max).map((c, i) => (
        <Glyph key={`${c}${i}`} char={c} strokes={lib.strokes} size={size} />
      ))}
      {chars.length > max && <span className="tiny muted">+{chars.length - max}</span>}
    </div>
  );
}

function TemplateCard({
  lib,
  t,
  learnedCount,
  onOpen,
}: {
  lib: Library;
  t: Template;
  learnedCount: number;
  onOpen: (id: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(t.items.length / Math.max(1, t.options.perPage)));
  const complete = learnedCount === t.items.length && t.items.length > 0;
  return (
    <button className="tpl-card" onClick={() => onOpen(t.id)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="name">{t.name}</span>
        {learnedCount > 0 && (
          <span className={`badge ${complete ? 'done' : ''}`}>
            {learnedCount}/{t.items.length} learned
          </span>
        )}
      </div>
      <Strip lib={lib} chars={t.items.map((i) => glyphOf(lib, i))} />
      <div className="tiny muted">
        {t.items.length} {t.kind === 'char' ? 'characters' : 'radicals'} · {pages} page
        {pages === 1 ? '' : 's'} · {t.options.perPage} per page
      </div>
    </button>
  );
}

export function TemplateGallery({ lib, onOpen, onToast }: Props) {
  const templates = useStore((s) => s.templates);
  const learned = useStore((s) => s.learned);
  const [group, setGroup] = useState<PresetGroup>('hsk');
  const [adding, setAdding] = useState<Preset | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const presets = useMemo(() => allPresets(lib), [lib]);

  const existing = useMemo(
    () => new Set(templates.map((t) => t.collection ?? t.name)),
    [templates],
  );

  const learnedIn = (t: Template) => t.items.filter((i) => learned.has(i)).length;

  /**
   * Templates grouped by the set they came from, so adding HSK 1 does not drop
   * fifteen loose cards into the list. Anything made by hand sits on its own at
   * the end.
   */
  const groups = useMemo(() => {
    const byCollection = new Map<string, Template[]>();
    const loose: Template[] = [];
    for (const t of templates) {
      if (t.collection) {
        const list = byCollection.get(t.collection);
        if (list) list.push(t);
        else byCollection.set(t.collection, [t]);
      } else {
        loose.push(t);
      }
    }
    return { byCollection: [...byCollection.entries()], loose };
  }, [templates]);

  function make(p: Preset, perPart: number) {
    const items = p.items(lib);
    const made = createSeries(p.name, p.kind, items, perPart, undefined, p.name);
    setAdding(null);
    onToast(
      made.length === 1
        ? `Added “${made[0].name}” — ${items.length} items`
        : `Added ${made.length} templates to the “${p.name}” collection`,
    );
    if (made.length === 1 && made[0]) onOpen(made[0].id);
  }

  function blank(kind: ItemKind) {
    const n = templates.filter((t) => t.kind === kind).length + 1;
    const t = createTemplate(kind === 'char' ? `Characters ${n}` : `Radicals ${n}`, kind);
    onOpen(t.id);
  }

  return (
    <section>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1>Templates</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {templates.length === 0
              ? 'A template is one named, downloadable set. Pick a starting point below.'
              : `${templates.length} template${templates.length === 1 ? '' : 's'} in ${
                  groups.byCollection.length + (groups.loose.length ? 1 : 0)
                } group${groups.byCollection.length + (groups.loose.length ? 1 : 0) === 1 ? '' : 's'}.`}
          </p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => blank('char')}>
          + Blank characters
        </button>
        <button className="btn" onClick={() => blank('radical')}>
          + Blank radicals
        </button>
      </div>

      {/* ------------------------------------------------ your collections */}
      {groups.byCollection.map(([name, list]) => {
        const items = list.reduce((n, t) => n + t.items.length, 0);
        const done = list.reduce((n, t) => n + learnedIn(t), 0);
        const shut = collapsed.has(name);
        return (
          <div key={name} className="collection">
            <div className="collection-head">
              <button
                className="btn ghost sm"
                aria-expanded={!shut}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    next.has(name) ? next.delete(name) : next.add(name);
                    return next;
                  })
                }
              >
                {shut ? '▸' : '▾'}
              </button>
              <h2>{name}</h2>
              <span className="badge">{list.length} parts</span>
              <span className="badge">
                {done}/{items} learned
              </span>
              <div className="spacer" />
              <button
                className="btn danger sm"
                onClick={() => {
                  if (confirm(`Remove all ${list.length} templates in “${name}”?`)) {
                    deleteCollection(name);
                    onToast(`Removed the “${name}” collection`);
                  }
                }}
              >
                Remove set
              </button>
            </div>
            {!shut && (
              <div className="tpl-grid">
                {list.map((t) => (
                  <TemplateCard
                    key={t.id}
                    lib={lib}
                    t={t}
                    learnedCount={learnedIn(t)}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groups.loose.length > 0 && (
        <div className="collection">
          {groups.byCollection.length > 0 && (
            <div className="collection-head">
              <h2 style={{ marginLeft: 4 }}>On their own</h2>
            </div>
          )}
          <div className="tpl-grid">
            {groups.loose.map((t) => (
              <TemplateCard
                key={t.id}
                lib={lib}
                t={t}
                learnedCount={learnedIn(t)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- presets */}
      <div className="card" style={{ marginTop: templates.length ? 26 : 0 }}>
        <header>
          <h2>Start from a ready-made set</h2>
        </header>

        <div className="body">
          <div className="tabs" style={{ display: 'inline-flex', marginBottom: 4 }}>
            {GROUPS.map((g) => (
              <button key={g} aria-selected={group === g} onClick={() => setGroup(g)}>
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: '8px 0 14px' }}>
            {GROUP_BLURB[group]}
          </p>

          <div className="tpl-grid">
            {presets
              .filter((p) => p.group === group)
              .map((p) => {
                const count = p.items(lib).length;
                const already = existing.has(p.name);
                return (
                  <div key={p.id} className="tpl-card preset">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="name">{p.name}</span>
                      {already && <span className="badge">added</span>}
                    </div>
                    <Strip lib={lib} chars={p.sample(lib)} />
                    <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                      {p.blurb}
                    </p>
                    <div className="row">
                      <span className="tiny muted grow">
                        {count} {p.kind === 'char' ? 'characters' : 'radicals'}
                      </span>
                      <button className="btn sm primary" onClick={() => setAdding(p)}>
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {adding && (
        <AddSetDialog
          lib={lib}
          preset={adding}
          onCancel={() => setAdding(null)}
          onConfirm={(perPart) => make(adding, perPart)}
        />
      )}
    </section>
  );
}
