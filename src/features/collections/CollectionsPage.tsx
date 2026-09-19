import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { nextCollectionName, statsOf, type Collection } from '../../domain/collection';
import { countLabel, type ItemId } from '../../domain/ids';
import { glyphOf } from '../../domain/library';
import { allPresets, GROUP_BLURB, GROUP_LABEL, type Preset, type PresetGroup } from '../../domain/presets';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { PALETTES } from '../../pdf/theme';
import { createCollection, discardListPlan, startListPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { Strip } from '../../ui/Strip';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { NewCollectionDialog } from './NewCollectionDialog';

const GROUPS: PresetGroup[] = ['hsk', 'theme'];

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
      <Strip chars={c.items.map((i) => glyphOf(lib, i))} strokes={lib.strokes} />
      <div className="bar">
        <i className="learned" style={{ width: `${done * 100}%` }} />
      </div>
      <div className="row tiny muted" style={{ gap: 6 }}>
        <span>{countLabel(s.total)}</span>
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

/** Every collection, and the ready-made sets to start one from, at /collections. */
export function CollectionsPage() {
  useTitle('Collections');
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useQuery();
  const group = oneOf(query.get('sets'), GROUPS, 'hsk');

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
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1>Collections</h1>
          <p className="small muted" style={{ margin: 0 }}>
            {collections.length === 0
              ? 'A collection is one subject you are working through. Take a ready-made set below, or start an empty one.'
              : `${collections.length} collection${collections.length === 1 ? '' : 's'}. Each one prints as much or as little of itself as you ask for.`}
          </p>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={startEmpty}>
          + New collection
        </button>
        <button
          className="btn primary"
          onClick={startList}
          title="Describe a topic or a situation; Claude picks the words, explains them and shows them in use"
        >
          ✦ Write one with Claude
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
        <div className="tpl-grid" style={{ marginBottom: 26 }}>
          {collections.map((c) => (
            <CollectionCard key={c.id} c={c} learned={learned} />
          ))}
        </div>
      )}

      <div className="card">
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
                    <span className="tiny muted grow">{countLabel(p.items(lib).length)}</span>
                    <button className="btn sm primary" onClick={() => setAdding(p)}>
                      Add
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {adding && (
        <NewCollectionDialog
          preset={adding}
          onCancel={() => setAdding(null)}
          onConfirm={(name, items) => {
            const c = createCollection({ name, items, presetId: adding.id });
            setAdding(null);
            toast(`“${c.name}” — ${countLabel(items.length)}`);
            navigate(paths.collection(c.id));
          }}
        />
      )}
    </section>
  );
}
