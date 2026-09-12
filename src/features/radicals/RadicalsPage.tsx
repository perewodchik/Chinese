import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useNavigationType } from 'react-router';
import { mainForm, searchScore } from '../../domain/radicals/forms';
import { isKnown, radicalCount } from '../../domain/radicals/sets';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useOpenRadical } from '../../navigation/radicalDrawer';
import { addRadicals, createRadicalSet, setRadicalLimit } from '../../store/radicals';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { useToast } from '../../ui/toast';
import { useRangeSelection } from '../../ui/useRangeSelection';
import { useTitle } from '../../ui/useTitle';
import { useRadicalLibrary } from './library';

type Show = 'all' | 'known' | 'todo' | 'free' | 'forms';
type Sort = 'used' | 'number' | 'strokes';

const SHOW: Array<{ id: Show; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'known', label: 'Known' },
  { id: 'todo', label: 'Not known' },
  { id: 'free', label: 'In no set' },
  { id: 'forms', label: 'Written more than one way' },
];
const SHOW_IDS = SHOW.map((s) => s.id);
const SORTS: Sort[] = ['used', 'number', 'strokes'];

/**
 * The 214 radicals at /radicals: the pieces every character is built from.
 *
 * Ordered by how much of the syllabus each one unlocks rather than by Kangxi
 * number — the number is a place in a dictionary, and this order is what to
 * learn first.
 */
export function RadicalsPage() {
  useTitle('Radicals');
  const rlib = useRadicalLibrary();
  const navigate = useNavigate();
  const navigation = useNavigationType();
  const openRadical = useOpenRadical();
  const toast = useToast();
  const [query, setQuery] = useQuery();

  const sets = useStore((s) => s.radicals.sets);
  const known = useStore((s) => s.radicals.known);
  const limit = useStore((s) => s.radicals.limit);

  const show = oneOf(query.get('show'), SHOW_IDS, 'all');
  const sort = oneOf(query.get('sort'), SORTS, 'used');

  // The search box keeps its own state and writes it into the address behind
  // itself; bound straight to the address it would drop keystrokes.
  const searched = query.get('q') ?? '';
  const [q, setQ] = useState(searched);
  useEffect(() => {
    if (navigation === 'POP') setQ(searched);
  }, [navigation, searched]);

  const inSets = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const set of sets) for (const n of set.items) map.set(n, [...(map.get(n) ?? []), set.name]);
    return map;
  }, [sets]);

  const rows = useMemo(() => {
    const needle = q.trim();
    // A search looks through all 214; browsing shows as many as asked for.
    const within = needle ? rlib.radicals : rlib.radicals.filter((_, i) => (limit ? i < limit : true));
    const matched = within
      .map((r) => ({ r, score: needle ? searchScore(r, needle) : 0 }))
      .filter(({ r, score }) => {
        if (score < 0) return false;
        if (show === 'known') return isKnown(known, r.n);
        if (show === 'todo') return !isKnown(known, r.n);
        if (show === 'free') return !inSets.has(r.n);
        if (show === 'forms') return r.forms.length > 1;
        return true;
      });

    const by: Record<Sort, (a: (typeof matched)[number], b: (typeof matched)[number]) => number> = {
      used: (a, b) => a.r.rank - b.r.rank,
      number: (a, b) => a.r.n - b.r.n,
      strokes: (a, b) => a.r.sc - b.r.sc || a.r.rank - b.r.rank,
    };
    return matched.sort((a, b) => a.score - b.score || by[sort](a, b)).map(({ r }) => r);
  }, [rlib, q, show, sort, limit, known, inSets]);

  const ordering = useMemo(() => rows.map((r) => r.n), [rows]);
  const selection = useRangeSelection(ordering);

  function addSelection(target: string) {
    const picked = ordering.filter((n) => selection.selected.has(n));
    if (target === 'new') {
      const set = createRadicalSet({ name: `Radicals ${sets.length + 1}`, items: picked });
      selection.clear();
      navigate(paths.radicalSet(set.id));
      return;
    }
    const set = sets.find((s) => s.id === target);
    if (!set) return;
    const fresh = picked.filter((n) => !set.items.includes(n));
    addRadicals(set.id, picked);
    selection.clear();
    toast(
      fresh.length === picked.length
        ? `Added ${radicalCount(fresh.length)} to ${set.name}`
        : `Added ${fresh.length}; ${picked.length - fresh.length} were already there`,
    );
  }

  const knownCount = rlib.radicals.filter((r) => isKnown(known, r.n)).length;

  return (
    <>
      <section>
        <div className="row" style={{ marginBottom: 4 }}>
          <nav className="tabs" aria-label="Radicals">
            <NavLink to={paths.radicals()} end>
              All radicals
            </NavLink>
            <NavLink to={paths.radicalSets()}>Sets{sets.length ? ` (${sets.length})` : ''}</NavLink>
          </nav>

          <input
            type="search"
            value={q}
            aria-label="Search radicals"
            onChange={(e) => {
              setQ(e.target.value);
              setQuery('q', e.target.value);
            }}
            placeholder="Search 氵, shui, water, 三点水…"
            style={{ maxWidth: 280 }}
          />

          <label className="field" style={{ width: 140 }}>
            <select
              value={limit}
              aria-label="How many"
              onChange={(e) => setRadicalLimit(Number(e.target.value))}
            >
              <option value={30}>Top 30</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={0}>All {rlib.radicals.length}</option>
            </select>
          </label>

          <label className="field" style={{ width: 150 }}>
            <select value={sort} aria-label="Order" onChange={(e) => setQuery('sort', e.target.value, 'used')}>
              <option value="used">Most used first</option>
              <option value="number">Kangxi number</option>
              <option value="strokes">Stroke count</option>
            </select>
          </label>
        </div>

        <p className="small muted" style={{ margin: '0 0 12px' }}>
          The pieces characters are built from. Learn the common ones and a new character stops
          being a picture and becomes two or three parts you already know.
        </p>

        <div className="row" style={{ marginBottom: 12 }}>
          <div className="chips">
            {SHOW.map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={show === s.id}
                onClick={() => setQuery('show', s.id, 'all')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="small muted">
            Showing <b>{rows.length}</b> of {rlib.radicals.length} · {knownCount} known
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <span className="big">空</span>
            Nothing matches those filters.
          </div>
        ) : (
          <div className="grid">
            {rows.map((r) => {
              const form = mainForm(r);
              const held = inSets.get(r.n);
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
                  learned={isKnown(known, r.n)}
                  selected={selection.selected.has(r.n)}
                  claimed={Boolean(held?.length)}
                  title={
                    held?.length
                      ? `Already in ${held.join(', ')}`
                      : isKnown(known, r.n)
                        ? 'Known'
                        : 'Not known yet'
                  }
                  onClick={(shift) => selection.toggle(r.n, shift)}
                  onOpen={() => openRadical(r.n)}
                />
              );
            })}
          </div>
        )}
      </section>

      {selection.selected.size > 0 && (
        <div className="tray">
          <b>{radicalCount(selection.selected.size)} selected</b>
          <button className="btn ghost sm" onClick={selection.clear}>
            Clear
          </button>
          <div className="spacer" />
          <span className="small muted">Add to</span>
          {sets.slice(-5).map((s) => (
            <button key={s.id} className="btn sm" onClick={() => addSelection(s.id)}>
              {s.name}
            </button>
          ))}
          <button className="btn sm primary" onClick={() => addSelection('new')}>
            + New set
          </button>
        </div>
      )}
    </>
  );
}
