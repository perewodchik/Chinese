import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useNavigationType } from 'react-router';
import { collectionsByItem, nextCollectionName } from '../../domain/collection';
import { charId, charsOf, countLabel } from '../../domain/ids';
import { factsOf, type ItemFacts } from '../../domain/library';
import { readyToLearn } from '../../domain/series';
import { unlockCount } from '../../domain/vocab';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { useRadicalDrawer } from '../../navigation/radicalDrawer';
import { setLearned, setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { SelectToggle } from '../../ui/SelectToggle';
import { useToast } from '../../ui/toast';
import { useSelectMode } from '../../ui/useRangeSelection';
import { useTitle } from '../../ui/useTitle';
import { useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { WordsShelf } from '../words/WordsShelf';
import { RadicalDrawer } from './RadicalDrawer';
import { RadicalGate } from './radicalData';
import { RADICAL_SHOW, RadicalShelf, type RadicalShow } from './RadicalShelf';

type StatusFilter = 'all' | 'learned' | 'todo' | 'free' | 'ready';
type Sort = 'order' | 'strokes' | 'freq' | 'radical' | 'unlocks';

const STATUS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'learned', label: 'Learned' },
  { id: 'todo', label: 'Not learned' },
  { id: 'free', label: 'In no collection' },
  { id: 'ready', label: 'Ready — parts known' },
];
const STATUS_IDS = STATUS.map((s) => s.id);
const SORTS: Sort[] = ['order', 'strokes', 'freq', 'radical', 'unlocks'];
const RADICAL_SHOW_IDS = RADICAL_SHOW.map((s) => s.id);

/**
 * The radicals, as a choice in the same dropdown as the bands.
 *
 * They are not a band and they are not characters — nothing here counts
 * towards what you have learned, and none of them can be queued for practice
 * or turned up in a review. They are in the library because the library is
 * where you look something up, and a radical is a thing you look up.
 */
export const RADICALS_BAND = -1;

/**
 * The syllabus words, as a third choice in the dropdown: a band at a time,
 * each marked known, learning or new. See `WordsShelf`.
 */
export const WORDS_BAND = -2;

/** Cards shown at first, and added by each "show more": 3000 at once is a lot of SVG. */
const STEP = 300;

const TONE_MARKS = /[̀-ͯ]/g;

/**
 * Browsing all three thousand characters at /library, with the search, the
 * filter and the order kept in the query, so coming back finds the library the
 * way it was left.
 */
export function LibraryPage() {
  const lib = useLibrary();
  const navigate = useNavigate();
  const navigation = useNavigationType();
  const openItem = useOpenItem();
  const collect = useCollect();
  const [query, setQuery] = useQuery();
  const radicalDrawer = useRadicalDrawer();

  const collections = useStore((s) => s.collections);
  const learned = useStore((s) => s.learned);
  const hskBand = useStore((s) => s.settings.hskBand);

  const radicals = hskBand === RADICALS_BAND;
  const words = hskBand === WORDS_BAND;
  useTitle(radicals ? 'Radicals' : words ? 'Words' : 'Library');

  const status = oneOf(query.get('show'), STATUS_IDS, 'all');
  const radicalShow = oneOf(query.get('show'), RADICAL_SHOW_IDS, 'all') as RadicalShow;
  const sort = oneOf(query.get('sort'), SORTS, 'order');

  // The search box keeps its own state and writes it into the address behind
  // itself. Bound straight to the address, every keystroke would wait on the
  // router — and a text box that lags its own keystrokes drops some of them.
  const searched = query.get('q') ?? '';
  const [q, setQ] = useState(searched);
  useEffect(() => {
    if (navigation === 'POP') setQ(searched);
  }, [navigation, searched]);

  /**
   * `?band=radicals` in the address, from the old /radicals section and from
   * the radical pill inside a character's drawer. The dropdown is a saved
   * preference rather than part of the address, so the link sets it and then
   * takes itself back out of the query.
   */
  const asked = query.get('band');
  useEffect(() => {
    if (asked !== 'radicals') return;
    setSettings({ hskBand: RADICALS_BAND });
    setQuery('band', '', '');
  }, [asked, setQuery]);

  const [cap, setCap] = useState(STEP);
  const index = useMemo(() => collectionsByItem(collections), [collections]);

  /**
   * The characters whose every component you can already write, and how many
   * words each would complete. Both are searches over the whole syllabus, so
   * they are done once rather than per filter change.
   */
  const knownChars = useMemo(() => charsOf(learned), [learned]);
  const ready = useMemo(
    () => new Set(readyToLearn(lib, knownChars, 400).map((r) => r.entry.c)),
    [lib, knownChars],
  );

  const rows = useMemo(() => {
    if (radicals || words) return [];
    const needle = q.trim().toLowerCase();

    const base: ItemFacts[] = lib.characters
      .filter((c) => (hskBand ? c.hsk === hskBand : true))
      .map((c) => factsOf(lib, charId(c.c))!);

    const matches = base.filter((row) => {
      if (needle) {
        const hay = `${row.glyph} ${row.py} ${row.gloss}`.toLowerCase();
        // strip tone marks so "nu" finds nǚ
        const flat = hay.normalize('NFD').replace(TONE_MARKS, '');
        if (!hay.includes(needle) && !flat.includes(needle)) return false;
      }
      if (status === 'learned') return learned.has(row.id);
      if (status === 'todo') return !learned.has(row.id);
      if (status === 'free') return !index.has(row.id);
      if (status === 'ready') return ready.has(row.glyph);
      return true;
    });

    const cmp: Record<Sort, (a: ItemFacts, b: ItemFacts) => number> = {
      order: (a, b) => a.idx - b.idx,
      strokes: (a, b) => a.strokes - b.strokes || a.idx - b.idx,
      freq: (a, b) => a.freq - b.freq,
      radical: (a, b) => a.radical.localeCompare(b.radical) || a.idx - b.idx,
      // What it would open up: how many words it completes out of characters
      // already known. A different and more useful order than raw frequency.
      unlocks: (a, b) =>
        unlockCount(lib, b.glyph, knownChars) - unlockCount(lib, a.glyph, knownChars) || a.freq - b.freq,
    };
    return [...matches].sort(cmp[sort]);
  }, [lib, q, status, sort, index, learned, hskBand, ready, knownChars, radicals, words]);

  useEffect(() => setCap(STEP), [q, status, sort, hskBand]);

  const ordering = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useSelectMode(ordering);
  const toast = useToast();

  // Nothing about a radical can be selected, so switching to them must not
  // leave a trayful of characters hovering over a page they belong to no more.
  useEffect(() => {
    if (radicals) selection.clear();
  }, [radicals]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const ids = lib.characters
      .filter((c) => (hskBand ? c.hsk === hskBand : true))
      .map((c) => charId(c.c));
    return { all: ids.length, learned: ids.filter((id) => learned.has(id)).length };
  }, [lib, learned, hskBand]);

  function addSelection(target: string) {
    const made = collect(target, [...selection.selected], {
      newName: nextCollectionName(collections),
    });
    selection.clear();
    if (made && target === 'new') navigate(paths.collection(made.id));
  }

  function markSelection(value: boolean) {
    const ids = [...selection.selected];
    setLearned(ids, value);
    toast(value ? `Marked ${countLabel(ids.length)} as learned` : `${countLabel(ids.length)} no longer counted as learned`);
    selection.clear();
  }

  return (
    <>
      <section>
        <div className="row" style={{ marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{radicals ? 'Radicals' : words ? 'Words' : 'Library'}</h1>

          <input
            type="search"
            value={q}
            aria-label="Search"
            onChange={(e) => {
              setQ(e.target.value);
              setQuery('q', e.target.value);
            }}
            placeholder={
              radicals ? 'Search 氵, shui, water, 三点水…' : words ? 'Search 东西, dongxi, thing…' : 'Search 好, hao, good…'
            }
            style={{ maxWidth: 280 }}
          />

          <label className="field" style={{ width: 132 }}>
            <select
              value={hskBand}
              aria-label="HSK band"
              onChange={(e) => setSettings({ hskBand: Number(e.target.value) })}
            >
              <option value={0}>All 3000</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  HSK {n}
                </option>
              ))}
              <option value={7}>HSK 7–9</option>
              <option value={RADICALS_BAND}>Radicals</option>
              <option value={WORDS_BAND}>Words</option>
            </select>
          </label>

          {!radicals && !words && (
            <label className="field" style={{ width: 150 }}>
              <select value={sort} aria-label="Order" onChange={(e) => setQuery('sort', e.target.value, 'order')}>
                <option value="order">Teaching order</option>
                <option value="strokes">Stroke count</option>
                <option value="freq">Frequency</option>
                <option value="radical">Radical</option>
                <option value="unlocks">What it unlocks</option>
              </select>
            </label>
          )}
        </div>

        {!words && <div className="row" style={{ marginBottom: 12 }}>
          <div className="chips">
            {(radicals ? RADICAL_SHOW : STATUS).map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={(radicals ? radicalShow : status) === s.id}
                onClick={() => setQuery('show', s.id, 'all')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          {!radicals && (
            <>
              <span className="small muted">
                Showing <b>{rows.length}</b> of {counts.all} · {counts.learned} learned
              </span>
              <SelectToggle on={selection.on} onToggle={selection.toggleMode} />
            </>
          )}
        </div>}

        {words ? (
          <WordsShelf q={q} />
        ) : radicals ? (
          <RadicalGate>
            <RadicalShelf q={q} show={radicalShow} />
          </RadicalGate>
        ) : rows.length === 0 ? (
          <div className="empty">
            <span className="big">空</span>
            Nothing matches those filters.
          </div>
        ) : (
          <div className="grid">
            {rows.slice(0, cap).map((row) => {
              const inside = index.get(row.id);
              return (
                <ItemCard
                  key={row.id}
                  glyph={row.glyph}
                  py={row.py}
                  gloss={row.gloss}
                  strokes={lib.strokes}
                  index={row.idx}
                  learned={learned.has(row.id)}
                  selected={selection.selected.has(row.id)}
                  claimed={Boolean(inside?.length)}
                  title={
                    inside?.length
                      ? `Already in ${inside.map((c) => c.name).join(', ')}`
                      : learned.has(row.id)
                        ? 'Learned'
                        : 'Not learned yet'
                  }
                  onClick={(shift) => (selection.on ? selection.toggle(row.id, shift) : openItem(row.id))}
                  onOpen={() => openItem(row.id)}
                />
              );
            })}
          </div>
        )}

        {!radicals && !words && rows.length > cap && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn" onClick={() => setCap((c) => c + 2 * STEP)}>
              Show more — {rows.length - cap} left
            </button>
          </div>
        )}
      </section>

      {/* A radical opens over whatever the library is showing, and over a
          character's drawer that linked to it. */}
      {radicalDrawer.radical !== null && (
        <RadicalGate>
          <RadicalDrawer n={radicalDrawer.radical} onClose={radicalDrawer.close} />
        </RadicalGate>
      )}

      {selection.selected.size > 0 && (
        <div className="tray">
          <b>{countLabel(selection.selected.size)} selected</b>
          <button className="btn ghost sm" onClick={selection.clear}>
            Clear
          </button>
          <button className="btn sm" onClick={() => markSelection(true)}>
            Mark learned
          </button>
          <button className="btn sm" onClick={() => markSelection(false)}>
            Unmark
          </button>
          <div className="spacer" />
          <span className="small muted">Add to</span>
          {collections.slice(-5).map((c) => (
            <button key={c.id} className="btn sm" onClick={() => addSelection(c.id)}>
              {c.name}
            </button>
          ))}
          <button className="btn sm primary" onClick={() => addSelection('new')}>
            + New collection
          </button>
        </div>
      )}
    </>
  );
}
