import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { nextCollectionName, statsOf, type Collection } from '../../domain/collection';
import { itemsLabel, type ItemId } from '../../domain/ids';
import { glyphOf } from '../../domain/library';
import { allPresets, GROUP_BLURB, GROUP_LABEL, type Preset, type PresetGroup } from '../../domain/presets';
import { shelve } from '../../domain/text';
import { paths, type CollectionsShow } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { PALETTES } from '../../pdf/theme';
import { createCollection, discardListPlan, startListPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { Menu } from '../../ui/Menu';
import { Seg } from '../../ui/Seg';
import { Strip } from '../../ui/Strip';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { TextShelf, useStartSession } from '../reader/TextsPage';
import { NewCollectionDialog } from './NewCollectionDialog';

const GROUPS: PresetGroup[] = ['hsk', 'words', 'theme'];

function CollectionCard({ c, learned }: { c: Collection; learned: ReadonlySet<ItemId> }) {
  const lib = useLibrary();
  const s = statsOf(c, learned);
  const done = s.total ? s.learned / s.total : 0;
  const swatch = PALETTES.find((p) => p.id === c.sheet.palette)?.swatch;
  return (
    <Link className="tpl-card" to={paths.collection(c.id)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="name">{c.name}</span>
        {s.learned > 0 && (
          <span className={`badge ${s.learned === s.total ? 'done' : ''}`}>
            {s.learned}/{s.total}
          </span>
        )}
      </div>
      <Strip chars={c.items.flatMap((i) => [...glyphOf(lib, i)])} strokes={lib.strokes} />
      <div className="bar">
        <i className="learned" style={{ width: `${done * 100}%` }} />
      </div>
      <div className="row tiny muted" style={{ gap: 6 }}>
        <span>{itemsLabel(c.items)}</span>
        {c.words?.length ? (
          <>
            <span>·</span>
            <span>{c.words.length} words</span>
          </>
        ) : null}
        <span>·</span>
        <span>
          {s.pages} page{s.pages === 1 ? '' : 's'} at {c.sheet.perPage} per page
        </span>
        <div className="spacer" />
        {swatch && (
          <span
            className="theme-dot"
            title={`${c.sheet.palette} · ${c.sheet.style}`}
            style={{ background: swatch[0], borderColor: swatch[1] }}
          />
        )}
      </div>
    </Link>
  );
}

const SHOWS: CollectionsShow[] = ['all', 'characters', 'texts'];

/**
 * Every collection, at /collections — of characters and of texts, on one
 * page, because they are one idea: a subject you are working through. Forty
 * characters to write and five passages to read about the same week are the
 * same week's work, and they used to be two tabs apart.
 *
 * `?show=characters` or `?show=texts` narrows it to one kind, which is where
 * the reader's "back to the shelf" lands.
 */
export function CollectionsPage() {
  useTitle('Collections');
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const group = oneOf(query.get('sets'), GROUPS, 'hsk');
  const show = oneOf(query.get('show'), SHOWS, 'all');
  const startSession = useStartSession();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const textCollections = useMemo(() => shelve(texts, sets).bySet.size, [texts, sets]);

  const collections = useStore((s) => s.collections);
  const learned = useStore((s) => s.learned);
  const listPlan = useStore((s) => s.listPlan);
  const [adding, setAdding] = useState<Preset | null>(null);
  const presets = useMemo(() => allPresets(lib), [lib]);
  const added = useMemo(() => new Set(collections.map((c) => c.presetId ?? c.name)), [collections]);

  /** An empty collection opens on its items, where there is a search box to fill it from. */
  function startEmpty() {
    const c = createCollection({ name: nextCollectionName(collections) });
    navigate(paths.collection(c.id, 'items'));
  }

  /** A list written with Claude: a topic or a situation in, explained words out. */
  function startList() {
    if (listPlan && !confirm(`Start a new word list? “${listPlan.name}” is still in progress, and would be thrown away.`)) {
      return;
    }
    startListPlan();
    navigate(paths.buildList('describe'));
  }

  return (
    <section>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <h1>Collections</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Characters to write and texts to read — one subject each, however big you want it.
          </p>
        </div>
        <div className="spacer" />
        <Menu label="+ New ▾" className="btn primary" title="Start a new collection">
          {(close) => (
            <>
              <button
                role="menuitem"
                className="btn ghost sm"
                onClick={() => {
                  close();
                  startEmpty();
                }}
              >
                Characters, empty
                <span className="tiny muted">fill it from the library</span>
              </button>
              <button
                role="menuitem"
                className="btn ghost sm"
                onClick={() => {
                  close();
                  startList();
                }}
              >
                ✦ Words, written with Claude
                <span className="tiny muted">a topic in, explained words out</span>
              </button>
              <button
                role="menuitem"
                className="btn ghost sm"
                onClick={() => {
                  close();
                  startSession();
                }}
              >
                ✦ Texts, written with Claude
                <span className="tiny muted">passages out of what you know</span>
              </button>
            </>
          )}
        </Menu>
      </div>

      <div className="show-bar">
        <Seg
          label="Show"
          value={show}
          onChange={(v) => setQuery('show', v, 'all')}
          options={[
            { id: 'all', label: 'All' },
            { id: 'characters', label: `Characters · ${collections.length}` },
            { id: 'texts', label: `Texts · ${textCollections}` },
          ]}
        />
      </div>

      {show !== 'texts' && (
        <section className="shelf">
          <div className="shelf-head">
            <div>
              <h2 className="shelf-title">Characters</h2>
              <p className="small muted" style={{ margin: 0 }}>
                {collections.length === 0
                  ? 'Take a ready-made set below, or start an empty one.'
                  : `${collections.length} collection${collections.length === 1 ? '' : 's'}, each printing as much or as little of itself as you ask for.`}
              </p>
            </div>
            <div className="spacer" />
            <button className="btn sm" onClick={startEmpty}>
              + Empty
            </button>
          </div>

          {listPlan && (
            <div className="resume">
              <span className="mark">词</span>
              <div style={{ minWidth: 0 }}>
                <b>{listPlan.name}</b>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {listPlan.size} words ·{' '}
                  {listPlan.step === 'describe'
                    ? 'still being described'
                    : listPlan.step === 'prompt'
                      ? listPlan.copiedAt
                        ? 'prompt copied — waiting for Claude’s answer'
                        : 'prompt ready to copy'
                      : listPlan.response.trim()
                        ? 'an answer is pasted and waiting to be saved'
                        : 'waiting for you to paste the answer'}
                </p>
              </div>
              <div className="spacer" />
              <button
                className="btn ghost sm"
                onClick={() => {
                  if (confirm('Throw this word list away?')) discardListPlan();
                }}
              >
                Discard
              </button>
              <Link className="btn primary sm" to={paths.buildList(listPlan.step)}>
                Continue →
              </Link>
            </div>
          )}

          {collections.length > 0 && (
            <div className="tpl-grid">
              {collections.map((c) => (
                <CollectionCard key={c.id} c={c} learned={learned} />
              ))}
            </div>
          )}
        </section>
      )}

      {show !== 'characters' && <TextShelf />}

      {show !== 'texts' && (
        <div className="card presets-card">
          <header>
            <h2>Start from a ready-made set</h2>
          </header>

          <div className="body">
            <div className="tabs" role="tablist" style={{ display: 'inline-flex', marginBottom: 4 }}>
              {GROUPS.map((g) => (
                <button key={g} role="tab" aria-selected={group === g} onClick={() => setQuery('sets', g, 'hsk')}>
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
                .map((p) => (
                  <div key={p.id} className="tpl-card preset">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="name">{p.name}</span>
                      {added.has(p.id) && <span className="badge">added</span>}
                    </div>
                    <Strip chars={p.sample(lib)} strokes={lib.strokes} />
                    <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                      {p.blurb}
                    </p>
                    <div className="row">
                      <span className="tiny muted grow">{itemsLabel(p.items(lib))}</span>
                      <button className="btn sm primary" onClick={() => setAdding(p)}>
                        Add
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {adding && (
        <NewCollectionDialog
          preset={adding}
          onCancel={() => setAdding(null)}
          onConfirm={(name, items) => {
            const c = createCollection({ name, items, presetId: adding.id });
            setAdding(null);
            toast(`“${c.name}” — ${itemsLabel(items)}`);
            navigate(paths.collection(c.id));
          }}
        />
      )}
    </section>
  );
}
