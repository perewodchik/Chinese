import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useNavigationType, useSearchParams } from 'react-router';
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
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { WordsShelf } from '../words/WordsShelf';
import { RadicalDrawer } from './RadicalDrawer';
import { RadicalGate } from './radicalData';
import { RADICAL_SHOW, RadicalShelf, type RadicalShow } from './RadicalShelf';
import { BandSeg } from './BandSeg';
import './library.css';

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
 * What the library is showing: the characters, the syllabus words, or the
 * radicals, as a switch at the top rather than hidden in the band dropdown
 * they used to share.
 *
 * Characters and words both come a band at a time, from the same band strip,
 * so switching between them keeps you in HSK 2. The radicals are not a band
 * and not something to learn — nothing there counts towards what you have
 * learned, and none of them can be queued or reviewed. They are in the
 * library because the library is where you look something up, and a radical
 * is a thing you look up.
 */
type Kind = 'chars' | 'words' | 'radicals';

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'chars', label: '字 Characters' },
  { id: 'words', label: '词 Words' },
  { id: 'radicals', label: '部 Radicals' },
];
const KIND_IDS = KINDS.map((k) => k.id);

/**
 * The band setting once stood for the radicals and the words as well, as -1
 * and -2. A saved setting still holding one of them is read as that kind.
 */
const LEGACY_KIND: Record<number, Kind> = { [-1]: 'radicals', [-2]: 'words' };

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
  const savedBand = useStore((s) => s.settings.hskBand);
  const [, setParams] = useSearchParams();

  const kind = oneOf(query.get('kind'), KIND_IDS, 'chars');
  const radicals = kind === 'radicals';
  const words = kind === 'words';
  const hskBand = savedBand < 0 ? 1 : savedBand;
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
   * Switching what is shown. The status filters differ between the three, so
   * the one that was on goes with the switch rather than lingering unseen.
   */
  function showKind(next: Kind, extra?: Record<string, string>) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('show');
        p.delete('band');
        if (next === 'chars') p.delete('kind');
        else p.set('kind', next);
        for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  /**
   * `?band=radicals` from old links, and a saved band of -1 or -2 from when
   * the dropdown held the radicals and words too: both become `?kind=`.
   */
  const asked = query.get('band');
  useEffect(() => {
    if (asked === 'radicals') showKind('radicals');
  }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (savedBand >= 0) return;
    const legacy = LEGACY_KIND[savedBand];
    setSettings({ hskBand: 1 });
    if (legacy) showKind(legacy);
  }, [savedBand]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="row library-head">
          <h1>Library</h1>
          <Seg label="Show" value={kind} options={KINDS} onChange={(k) => showKind(k)} />

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
          />

          {kind === 'chars' && (
            <label className="field">
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

        {!words && (
          <div className="row shelf-bar">
            {!radicals && <BandSeg value={hskBand} />}
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
            {!radicals && (
              <>
                <div className="spacer" />
                <span className="small muted">
                  <b>{rows.length}</b> of {counts.all} · {counts.learned} learned
                </span>
                <SelectToggle on={selection.on} onToggle={selection.toggleMode} />
              </>
            )}
          </div>
        )}

        {words ? (
          <WordsShelf q={q} band={hskBand} />
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
