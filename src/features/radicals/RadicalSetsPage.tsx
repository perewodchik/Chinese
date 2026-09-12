import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { mainForm } from '../../domain/radicals/forms';
import { RADICAL_PRESETS, type RadicalPreset } from '../../domain/radicals/presets';
import { radicalCount, radicalSetStats, type RadicalSet } from '../../domain/radicals/sets';
import { paths } from '../../navigation/paths';
import { PALETTES } from '../../pdf/theme';
import { createRadicalSet } from '../../store/radicals';
import { useStore } from '../../store/store';
import { Strip } from '../../ui/Strip';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useRadicalLibrary } from './library';
import { NewRadicalSetDialog } from './NewRadicalSetDialog';

/** Radical sets at /radicals/sets: what goes on paper, and the ready-made ones to start from. */
export function RadicalSetsPage() {
  useTitle('Radical sets');
  const rlib = useRadicalLibrary();
  const navigate = useNavigate();
  const toast = useToast();
  const sets = useStore((s) => s.radicals.sets);
  const [adding, setAdding] = useState<RadicalPreset | null>(null);
  const added = useMemo(() => new Set(sets.map((s) => s.presetId ?? s.name)), [sets]);

  function startEmpty() {
    const set = createRadicalSet({ name: `Radicals ${sets.length + 1}` });
    navigate(paths.radicalSet(set.id, 'items'));
  }

  return (
    <section>
      <div className="row" style={{ marginBottom: 4 }}>
        <nav className="tabs" aria-label="Radicals">
          <NavLink to={paths.radicals()} end>
            All radicals
          </NavLink>
          <NavLink to={paths.radicalSets()}>Sets{sets.length ? ` (${sets.length})` : ''}</NavLink>
        </nav>
        <div className="spacer" />
        <button className="btn" onClick={startEmpty}>
          + New set
        </button>
      </div>

      <p className="small muted" style={{ margin: '0 0 16px' }}>
        {sets.length === 0
          ? 'A set is a run of radicals to work through on paper. Take a ready-made one below, or start an empty one and search for what you want in it.'
          : `${sets.length} set${sets.length === 1 ? '' : 's'}. Each one prints as much or as little of itself as you ask for.`}
      </p>

      {sets.length > 0 && (
        <div className="tpl-grid" style={{ marginBottom: 26 }}>
          {sets.map((set) => (
            <SetCard key={set.id} set={set} />
          ))}
        </div>
      )}

      <div className="card">
        <header>
          <h2>Start from a ready-made set</h2>
        </header>
        <div className="body">
          <p className="small muted" style={{ margin: '0 0 14px' }}>
            Learn the building blocks first and every character afterwards is easier.
          </p>
          <div className="tpl-grid">
            {RADICAL_PRESETS.map((p) => {
              const items = p.items(rlib);
              return (
                <div key={p.id} className="tpl-card preset">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="name">{p.name}</span>
                    {added.has(p.id) && <span className="badge">added</span>}
                  </div>
                  <Strip
                    chars={items.slice(0, 9).map((n) => mainForm(rlib.byNumber.get(n)!).k)}
                    strokes={rlib.strokes}
                    fit
                  />
                  <p className="tiny muted" style={{ margin: '2px 0 6px' }}>
                    {p.blurb}
                  </p>
                  <div className="row">
                    <span className="tiny muted grow">{radicalCount(items.length)}</span>
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
        <NewRadicalSetDialog
          preset={adding}
          onCancel={() => setAdding(null)}
          onConfirm={(name, items) => {
            const set = createRadicalSet({ name, items, presetId: adding.id });
            setAdding(null);
            toast(`“${set.name}” — ${radicalCount(items.length)}`);
            navigate(paths.radicalSet(set.id));
          }}
        />
      )}
    </section>
  );
}

function SetCard({ set }: { set: RadicalSet }) {
  const rlib = useRadicalLibrary();
  const known = useStore((s) => s.radicals.known);
  const stats = radicalSetStats(set, known);
  const done = stats.total ? stats.known / stats.total : 0;
  const swatch = PALETTES.find((p) => p.id === set.sheet.palette)?.swatch;

  return (
    <Link className="tpl-card" to={paths.radicalSet(set.id)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="name">{set.name}</span>
        {stats.known > 0 && (
          <span className={`badge ${stats.known === stats.total ? 'done' : ''}`}>
            {stats.known}/{stats.total}
          </span>
        )}
      </div>
      <Strip
        chars={set.items.map((n) => rlib.byNumber.get(n)).filter(Boolean).map((r) => mainForm(r!).k)}
        strokes={rlib.strokes}
        fit
      />
      <div className="bar">
        <i className="learned" style={{ width: `${done * 100}%` }} />
      </div>
      <div className="row tiny muted" style={{ gap: 6 }}>
        <span>{radicalCount(stats.total)}</span>
        <span>·</span>
        <span>
          {stats.pages} page{stats.pages === 1 ? '' : 's'} at {set.sheet.perPage} per page
        </span>
        <div className="spacer" />
        {swatch && (
          <span
            className="theme-dot"
            title={`${set.sheet.palette} · ${set.sheet.style}`}
            style={{ background: swatch[0], borderColor: swatch[1] }}
          />
        )}
      </div>
    </Link>
  );
}
