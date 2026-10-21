import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import type { CharacterEntry, SyllabusWord } from '../../data/types';
import { charId, wordId } from '../../domain/ids';
import { collectedItems } from '../../domain/sweep';
import { wordKnowledge, type WordStatus } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { createCollection } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { useSetProgress } from './LibraryHome';
import { findSet } from './sets';
import './home.css';

type CharShow = 'all' | 'todo' | 'learned';
type WordShow = 'all' | WordStatus;
type Order = 'order' | 'strokes' | 'freq';

// Without "All": a pressed filter is let go of by tapping it again.
const CHAR_SHOW: Array<{ id: CharShow; label: string }> = [
  { id: 'todo', label: 'To learn' },
  { id: 'learned', label: 'Learned' },
];
const WORD_SHOW: Array<{ id: WordShow; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
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
 * characters as squares from the exercise book, its words as rows, what you
 * have learned of it, and the way to print it.
 */
export function SetPage() {
  const { setId = '' } = useParams();
  const lib = useLibrary();
  const navigate = useNavigate();
  const openItem = useOpenItem();
  const collections = useStore((s) => s.collections);
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);
  const [query, setQuery] = useQuery();
  const [cap, setCap] = useState(STEP);
  const progress = useSetProgress();

  const set = useMemo(() => findSet(lib, collections, setId), [lib, collections, setId]);
  useTitle(set?.name ?? 'Library');
  const know = useMemo(() => wordKnowledge(lib, recall, collectedItems(collections)), [lib, recall, collections]);

  const hasBoth = Boolean(set?.chars.length && set.words.length);
  const tab = oneOf(query.get('tab'), ['chars', 'words'] as const, set && !set.chars.length ? 'words' : 'chars');
  const charShow = oneOf<CharShow>(query.get('show'), ['todo', 'learned'], 'all');
  const wordShow = oneOf<WordShow>(query.get('show'), ['new', 'learning', 'known'], 'all');
  const order = oneOf(query.get('order'), ORDERS.map((o) => o.id), 'order');

  const chars = useMemo(() => {
    if (!set) return [];
    const rows = set.chars.map((c) => lib.byChar.get(c)).filter((c): c is CharacterEntry => Boolean(c));
    const shown = rows.filter((c) =>
      charShow === 'all' ? true : (charShow === 'learned') === learned.has(charId(c.c)),
    );
    if (order === 'strokes') return [...shown].sort((a, b) => (a.sc ?? 0) - (b.sc ?? 0) || a.i - b.i);
    if (order === 'freq') return [...shown].sort((a, b) => a.freq - b.freq);
    return shown;
  }, [set, lib, charShow, learned, order]);

  const words = useMemo(() => {
    if (!set) return [];
    const extra = new Map((set.collection?.words ?? []).map((w) => [w.w, w]));
    return set.words
      .map((w) => lib.byWord.get(w) ?? (extra.get(w) as SyllabusWord | undefined))
      .filter((w): w is SyllabusWord => Boolean(w))
      .filter((w) => wordShow === 'all' || know.status(w.w) === wordShow);
  }, [set, lib, wordShow, know]);

  if (!set) return <Navigate to={paths.library()} replace />;
  const done = progress(set);

  /** Printing a ready-made set makes it a list of yours, where its sheet is kept. */
  function print() {
    if (!set) return;
    if (set.collection) return navigate(paths.collection(set.collection.id));
    const items = [...set.chars.map(charId), ...(set.chars.length ? [] : set.words.map(wordId))];
    const c = createCollection({ name: set.name, items, presetId: set.preset?.id ?? set.id, words: set.preset?.words });
    navigate(paths.collection(c.id));
  }

  const band = /^hsk-(\d)$/.exec(set.id)?.[1];

  return (
    <div className="set-page">
      <header className="page-head">
        <Link className="back-link" to={paths.library()}>
          <Icon name="back" />
          Library
        </Link>
        <span className="spacer" />
        <Menu label={<Icon name="more" size={22} />} title="More" className="icon-btn">
          {(close) => (
            <>
              {ORDERS.map((o) => (
                <button
                  key={o.id}
                  role="menuitemradio"
                  aria-checked={order === o.id}
                  className="btn ghost sm"
                  onClick={() => (close(), setQuery('order', o.id, 'order'))}
                >
                  {o.label}
                </button>
              ))}
              {set.collection && (
                <button role="menuitem" className="btn ghost sm" onClick={() => (close(), navigate(paths.collection(set.collection!.id, 'items')))}>
                  Change what is in it
                </button>
              )}
            </>
          )}
        </Menu>
      </header>

      <h1 className="set-title">{set.name}</h1>
      {set.blurb && <p className="set-blurb">{set.blurb}</p>}

      <div className="set-done">
        <span className="small">
          {set.chars.length > 0 && (
            <>
              <b>{done.chars}</b> of {set.chars.length.toLocaleString('en')} characters learned
            </>
          )}
          {set.chars.length > 0 && set.words.length > 0 && ', '}
          {set.words.length > 0 && (
            <>
              <b>{done.words}</b> of {set.words.length.toLocaleString('en')} words known
            </>
          )}
        </span>
        <span className="lib-bar" aria-hidden>
          <i style={{ width: `${Math.round(done.share * 100)}%` }} />
        </span>
      </div>

      <div className="set-actions">
        <button className="btn primary" onClick={print}>
          <Icon name="print" size={18} />
          Print
        </button>
        {band && Number(band) <= 4 && (
          <Link className="btn tonal" to={paths.sweep(Number(band))}>
            Sort what you know
          </Link>
        )}
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
            onChange={(t) => setQuery('tab', t, 'chars')}
          />
        )}
        <div className="chips">
          {(tab === 'chars' ? CHAR_SHOW : WORD_SHOW).map((s) => (
            <button
              key={s.id}
              className="chip"
              aria-pressed={(tab === 'chars' ? charShow : wordShow) === s.id}
              onClick={() => setQuery('show', (tab === 'chars' ? charShow : wordShow) === s.id ? 'all' : s.id, 'all')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chars' ? (
        chars.length ? (
          <div className="lib-tiles">
            {chars.slice(0, cap).map((c) => (
              <CharTile key={c.c} c={c} learned={learned.has(charId(c.c))} onOpen={() => openItem(charId(c.c))} />
            ))}
          </div>
        ) : (
          <p className="muted set-empty">Nothing here with that filter.</p>
        )
      ) : words.length ? (
        <div className="lib-words">
          {words.slice(0, cap).map((w) => (
            <WordRow key={w.w} w={w} status={know.status(w.w)} onOpen={() => openItem(wordId(w.w))} />
          ))}
        </div>
      ) : (
        <p className="muted set-empty">Nothing here with that filter.</p>
      )}

      {(tab === 'chars' ? chars : words).length > cap && (
        <div className="page-foot" style={{ justifyItems: 'center' }}>
          <button className="btn tonal" onClick={() => setCap((c) => c + STEP)}>
            Show {Math.min(STEP, (tab === 'chars' ? chars : words).length - cap)} more
          </button>
        </div>
      )}
    </div>
  );
}

/** A character as a square of the exercise book: the 田 guide, the character, its reading, its sense. */
export function CharTile({ c, learned, onOpen }: { c: CharacterEntry; learned: boolean; onOpen: () => void }) {
  return (
    <button
      className="lib-tile"
      data-learned={learned || undefined}
      onClick={onOpen}
      aria-label={`${c.c}, ${c.py[0]}, ${c.def}${learned ? ', learned' : ''}`}
    >
      <span className="lib-sq hanzi" aria-hidden>
        {c.c}
      </span>
      <span className="lib-py">{c.py[0]}</span>
      <span className="lib-gloss">{c.def.split(/[;,]/)[0]}</span>
    </button>
  );
}

const STATUS_LABEL: Record<WordStatus, string> = { new: 'New', learning: 'Learning', known: 'Known' };

export function WordRow({ w, status, onOpen }: { w: SyllabusWord; status?: WordStatus; onOpen: () => void }) {
  return (
    <button className="lib-word" data-status={status} onClick={onOpen}>
      <span className="hanzi lib-word-zh">{w.w}</span>
      <span className="lib-word-text">
        <span className="lib-py">{w.py}</span>
        <span className="lib-gloss">{w.d}</span>
      </span>
      {status === 'learning' && <span className="lib-word-state">{STATUS_LABEL[status]}</span>}
      {status === 'known' && <span className="lib-word-dot" aria-label="Known" />}
    </button>
  );
}
