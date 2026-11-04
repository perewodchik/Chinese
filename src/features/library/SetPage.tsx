import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { CharacterEntry, SyllabusWord } from '../../data/types';
import { nextCollectionName } from '../../domain/collection';
import { charId, itemsLabel, wordId, type ItemId } from '../../domain/ids';
import { collectedItems } from '../../domain/sweep';
import { LEVEL_NAME, type Level } from '../../domain/memory';
import { wordKnowledge } from '../../domain/words';
import { LevelBar, LevelMark } from '../../ui/LevelMark';
import { useLevelOf } from '../shared/levels';
import { setBrowseList, useOpenViewer } from '../../navigation/charViewer';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { createCollection, setLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useSelectMode } from '../../ui/useRangeSelection';
import { useTitle } from '../../ui/useTitle';
import { useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import { useSetProgress } from './LibraryHome';
import { findSet } from './sets';
import './home.css';

/** By how well it is known, from review alone: not yet (0), met (1), known (2 or 3). */
type Show = 'all' | 'none' | 'met' | 'known';
type Order = 'order' | 'strokes' | 'freq';
const showOf = (l: Level): Exclude<Show, 'all'> => (l === 0 ? 'none' : l === 1 ? 'met' : 'known');

// No "All" chip: a pressed filter is let go of by tapping it again.
const SHOWS: Array<{ id: Exclude<Show, 'all'>; label: string }> = [
  { id: 'none', label: 'Not known' },
  { id: 'met', label: 'Met' },
  { id: 'known', label: 'Known' },
];
const ORDERS: Array<{ id: Order; label: string }> = [
  { id: 'order', label: 'Teaching order' },
  { id: 'strokes', label: 'Fewest strokes first' },
  { id: 'freq', label: 'Commonest first' },
];

/** Squares at first, and more on asking: HSK 7–9 is eleven hundred of them. */
const STEP = 300;

/**
 * One set, at /library/:setId — a band, a topic or a list of your own: its
 * characters as squares from the exercise book, its words as rows, and what
 * you have learned of it.
 *
 * The page is for looking. What can be done with the set — print it, sort
 * what you know, look through it full screen, pick some out — is under ⋯, so
 * nothing stands between the title and the characters.
 */
export function SetPage() {
  const { setId = '' } = useParams();
  const lib = useLibrary();
  const navigate = useNavigate();
  const openItem = useOpenItem();
  const openViewer = useOpenViewer();
  const collect = useCollect();
  const toast = useToast();
  const collections = useStore((s) => s.collections);
  const learned = useStore((s) => s.learned);
  const levelOf = useLevelOf();
  const recall = useStore((s) => s.recall);
  const [query, setQuery] = useQuery();
  const [cap, setCap] = useState(STEP);
  const progress = useSetProgress();

  const texts = useStore((s) => s.texts);
  const set = useMemo(() => findSet(lib, collections, setId, texts), [lib, collections, setId, texts]);
  useTitle(set?.name ?? 'Library');
  const know = useMemo(() => wordKnowledge(lib, recall, collectedItems(collections)), [lib, recall, collections]);

  const hasBoth = Boolean(set?.chars.length && set.words.length);
  const tab = oneOf(query.get('tab'), ['chars', 'words'] as const, set && !set.chars.length ? 'words' : 'chars');
  const show = oneOf<Show>(query.get('show'), ['none', 'met', 'known'], 'all');
  const order = oneOf(query.get('order'), ORDERS.map((o) => o.id), 'order');

  const chars = useMemo(() => {
    if (!set) return [];
    const rows = set.chars.map((c) => lib.byChar.get(c)).filter((c): c is CharacterEntry => Boolean(c));
    const shown = rows.filter((c) => show === 'all' || showOf(levelOf(charId(c.c))) === show);
    if (order === 'strokes') return [...shown].sort((a, b) => (a.sc ?? 0) - (b.sc ?? 0) || a.i - b.i);
    if (order === 'freq') return [...shown].sort((a, b) => a.freq - b.freq);
    return shown;
  }, [set, lib, show, levelOf, order]);

  const words = useMemo(() => {
    if (!set) return [];
    const extra = new Map([...(set.preset?.words ?? []), ...(set.collection?.words ?? []), ...(set.extra ?? [])].map((w) => [w.w, w]));
    return set.words
      .map((w) => lib.byWord.get(w) ?? (extra.get(w) as SyllabusWord | undefined))
      .filter((w): w is SyllabusWord => Boolean(w))
      .filter((w) => show === 'all' || showOf(know.level(w.w)) === show);
  }, [set, lib, show, know]);

  // The full-screen view walks through what this page shows, in its order.
  const glyphs = useMemo(() => (tab === 'chars' ? chars.map((c) => c.c) : words.map((w) => w.w)), [tab, chars, words]);
  const offList = useMemo(() => new Map((set?.preset?.words ?? set?.collection?.words ?? set?.extra ?? []).map((w) => [w.w, w])), [set]);
  useEffect(() => {
    setBrowseList(glyphs, offList);
    return () => setBrowseList([]);
  }, [glyphs, offList]);

  const ordering = useMemo<ItemId[]>(
    () => (tab === 'chars' ? chars.map((c) => charId(c.c)) : words.map((w) => wordId(w.w))),
    [tab, chars, words],
  );
  const selection = useSelectMode(ordering);
  useEffect(() => setCap(STEP), [tab, show, order]);

  if (!set) return <Navigate to={paths.library()} replace />;
  const done = progress(set);
  const band = /^hsk-(\d)$/.exec(set.id)?.[1];

  /** Printing a ready-made set makes it a list of yours, where its sheet is kept. */
  function print() {
    if (!set) return;
    if (set.collection) return navigate(paths.collection(set.collection.id));
    const items = set.chars.length ? set.chars.map(charId) : set.words.map(wordId);
    const c = createCollection({ name: set.name, items, presetId: set.id, words: set.preset?.words ?? set.extra });
    navigate(paths.collection(c.id));
  }

  function mark(value: boolean) {
    const picked = [...selection.selected];
    setLearned(picked, value);
    toast(value ? `Marked ${itemsLabel(picked)} as learned` : `${itemsLabel(picked)} no longer counted as learned`);
    selection.clear();
  }

  function addTo(target: string) {
    const made = collect(target, [...selection.selected], { newName: nextCollectionName(collections) });
    selection.clear();
    if (made && target === 'new') navigate(paths.collection(made.id, 'items'));
  }

  const shown = tab === 'chars' ? chars : words;
  const isLearned = (id: ItemId) => (id.startsWith('w') ? know.status(id.slice(1)) === 'known' : learned.has(id));
  const others = collections.filter((c) => c.id !== set.collection?.id).slice(-3);

  return (
    <div className="set-page">
      <header className="page-head">
        <Link className="back-link" to={paths.library()}>
          <Icon name="back" />
          Library
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="What to do with it" className="icon-btn">
          {(close) => (
            <>
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), print())}>
                Print
                <span className="tiny muted">{set.collection ? 'its sheets, as you designed them' : 'it becomes one of your lists'}</span>
              </button>
              {glyphs.length > 0 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), openViewer(glyphs[0]!))}>
                  Full screen
                  <span className="tiny muted">one {tab === 'chars' ? 'character' : 'word'} at a time, stroke by stroke</span>
                </button>
              )}
              {band && Number(band) <= 4 && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.sweep(Number(band))))}>
                  Sort what you know
                  <span className="tiny muted">known, not sure or new, word by word</span>
                </button>
              )}
              <button role="menuitem" className="btn ghost sm" onClick={() => (close(), selection.toggleMode())}>
                {selection.on ? 'Stop picking' : 'Pick some out'}
                <span className="tiny muted">to mark them learned or put them in a list</span>
              </button>
              {set.collection && set.group === 'mine' && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.collection(set.collection!.id, 'items')))}>
                  Change what is in it
                </button>
              )}
              {tab === 'chars' && (
                <div className="menu-group" role="group" aria-label="Order">
                  {ORDERS.map((o) => (
                    <button
                      key={o.id}
                      role="menuitemradio"
                      aria-checked={order === o.id}
                      className="btn ghost sm"
                      onClick={() => (close(), setQuery('order', o.id, 'order'))}
                    >
                      {o.label}
                      {order === o.id && <Icon name="check" size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Menu>
      </header>

      <h1 className="set-title">{set.name}</h1>
      {set.blurb && <p className="set-blurb">{set.blurb}</p>}

      <div className="set-done">
        <span className="small set-levels">
          {([3, 2, 1, 0] as const).map((l) => (
            <span key={l} className="set-level">
              <LevelMark level={l} /> <b>{done.levels[l]}</b> {LEVEL_NAME[l].toLowerCase()}
            </span>
          ))}
        </span>
        <LevelBar levels={done.levels} />
      </div>

      <div className="set-filter">
        {hasBoth && (
          <Seg
            label="Show"
            value={tab}
            options={[
              { id: 'chars', label: `字 ${set.chars.length.toLocaleString('en')}` },
              { id: 'words', label: `词 ${set.words.length.toLocaleString('en')}` },
            ]}
            onChange={(t) => setQuery('tab', t, set.chars.length ? 'chars' : 'words')}
          />
        )}
        <div className="chips">
          {SHOWS.map((s) => {
            const on = show === s.id;
            return (
              <button key={s.id} className="chip" aria-pressed={on} onClick={() => setQuery('show', on ? 'all' : s.id, 'all')}>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {selection.on && (
        <div className="set-picking">
          <span className="small">
            {selection.selected.size ? `${selection.selected.size} picked` : 'Tap the ones you want'}
          </span>
          <span className="spacer" />
          {selection.selected.size > 0 && (
            <button className="btn quiet sm" onClick={selection.clear}>
              Clear
            </button>
          )}
          <button className="btn quiet sm" onClick={selection.toggleMode}>
            Done
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="muted set-empty">Nothing here with that filter.</p>
      ) : tab === 'chars' ? (
        <div className="lib-tiles">
          {chars.slice(0, cap).map((c) => {
            const id = charId(c.c);
            return (
              <CharTile
                key={c.c}
                c={c}
                level={levelOf(id)}
                picked={selection.on ? selection.selected.has(id) : undefined}
                onOpen={(shift) => (selection.on ? selection.toggle(id, shift) : openItem(id))}
              />
            );
          })}
        </div>
      ) : (
        <div className="lib-words">
          {words.slice(0, cap).map((w) => {
            const id = wordId(w.w);
            return (
              <WordRow
                key={w.w}
                w={w}
                level={know.level(w.w)}
                picked={selection.on ? selection.selected.has(id) : undefined}
                onOpen={(shift) => (selection.on ? selection.toggle(id, shift) : openItem(id))}
              />
            );
          })}
        </div>
      )}

      {shown.length > cap && (
        <div className="page-foot" style={{ justifyItems: 'center' }}>
          <button className="btn tonal" onClick={() => setCap((c) => c + STEP)}>
            Show {Math.min(STEP, shown.length - cap)} more
          </button>
        </div>
      )}

      {selection.selected.size > 0 && (
        <div className="tray set-tray">
          <span className="spacer" />
          <Menu label="Add to a list" className="btn sm" title="Add to a list" up>
            {(close) => (
              <>
                {others.map((c) => (
                  <button key={c.id} role="menuitem" className="btn ghost sm" onClick={() => (close(), addTo(c.id))}>
                    {c.name}
                  </button>
                ))}
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), addTo('new'))}>
                  A new list
                </button>
              </>
            )}
          </Menu>
          {/* Learned when they all are already; otherwise the way to make them so. */}
          {[...selection.selected].every((id) => isLearned(id)) ? (
            <button className="btn sm" onClick={() => mark(false)}>
              Not learned
            </button>
          ) : (
            <button className="btn sm tonal" onClick={() => mark(true)}>
              Mark learned
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A character as a square of the exercise book: the 田 guide, the character, its reading, its sense. */
export function CharTile({
  c,
  level,
  picked,
  onOpen,
}: {
  c: CharacterEntry;
  /** how well it is known, 0 to 3: its square filled in a deeper green */
  level: Level;
  /** undefined when nothing is being picked */
  picked?: boolean;
  onOpen: (shift: boolean) => void;
}) {
  return (
    <button
      className="lib-tile"
      data-level={level}
      aria-pressed={picked}
      onClick={(e) => onOpen(e.shiftKey)}
      aria-label={`${c.c}, ${c.py[0]}, ${c.def}, ${LEVEL_NAME[level].toLowerCase()}`}
    >
      <span className="lib-sq hanzi" aria-hidden>
        {c.c}
      </span>
      <span className="lib-py">{c.py[0]}</span>
      <span className="lib-gloss">{c.def.split(/[;,]/)[0]}</span>
    </button>
  );
}

export function WordRow({
  w,
  level,
  picked,
  onOpen,
}: {
  w: SyllabusWord;
  /** how well it is known, 0 to 3; left out, no mark */
  level?: Level;
  picked?: boolean;
  onOpen: (shift: boolean) => void;
}) {
  return (
    <button className="lib-word" data-level={level} aria-pressed={picked} onClick={(e) => onOpen(e.shiftKey)}>
      <span className="hanzi lib-word-zh">{w.w}</span>
      <span className="lib-word-text">
        <span className="lib-py">{w.py}</span>
        <span className="lib-gloss">{w.d}</span>
      </span>
      {level !== undefined && <LevelMark level={level} />}
    </button>
  );
}
