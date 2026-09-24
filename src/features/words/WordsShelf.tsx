import { useEffect, useMemo, useState } from 'react';
import { collectionsByItem, nextCollectionName } from '../../domain/collection';
import { itemsLabel, wordId, type ItemId } from '../../domain/ids';
import { collectedItems } from '../../domain/sweep';
import { HSK_BANDS } from '../../domain/text';
import { wordKnowledge, type WordStatus } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { oneOf, useQuery } from '../../navigation/query';
import { useStore } from '../../store/store';
import { ItemCard } from '../../ui/ItemCard';
import { Seg } from '../../ui/Seg';
import { useRangeSelection } from '../../ui/useRangeSelection';
import { useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';

type WordShow = 'all' | WordStatus | 'free';

export const WORD_SHOW: Array<{ id: WordShow; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'new', label: 'New' },
  { id: 'learning', label: 'Learning' },
  { id: 'known', label: 'Known' },
  { id: 'free', label: 'In no collection' },
];
const SHOW_IDS = WORD_SHOW.map((s) => s.id);
const BAND_IDS = HSK_BANDS.map((b) => String(b.id));
const BANDS = HSK_BANDS.map((b) => ({ id: String(b.id), label: b.label.replace('HSK ', '') }));

/** Cards at first, and more each time: a band of 4,800 words is a lot of cards. */
const STEP = 240;

const flatten = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The syllabus words, a band at a time, in the library behind the same
 * dropdown as the characters and the radicals — at /library with Words
 * chosen, the band and the filter in the address.
 *
 * Each card says whether you know the word, are learning it, or have not met
 * it, which is the thing the character grid cannot say about a word: 东 and 西
 * can both be ticked while 东西 is still new. Select a run and put it in a
 * collection to learn; tap a card's i for the word itself.
 */
export function WordsShelf({ q }: { q: string }) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const collect = useCollect();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const [query, setQuery] = useQuery();
  const band = Number(oneOf(query.get('words'), BAND_IDS, '1'));
  const show = oneOf(query.get('show'), SHOW_IDS, 'all');
  const [cap, setCap] = useState(STEP);

  const knowledge = useMemo(
    () => wordKnowledge(lib, recall, collectedItems(collections)),
    [lib, recall, collections],
  );
  const index = useMemo(() => collectionsByItem(collections), [collections]);

  const inBand = useMemo(() => lib.words.filter((w) => w.hsk === band), [lib, band]);
  const counts = useMemo(() => {
    const c: Record<WordStatus, number> = { known: 0, learning: 0, new: 0 };
    for (const w of inBand) c[knowledge.status(w.w)]++;
    return c;
  }, [inBand, knowledge]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const flat = flatten(needle).replace(/ /g, '');
    return inBand.filter((w) => {
      if (show === 'free' ? index.has(wordId(w.w)) : show !== 'all' && knowledge.status(w.w) !== show) {
        return false;
      }
      if (!needle) return true;
      return (
        w.w.includes(needle) ||
        flatten(w.py).replace(/ /g, '').startsWith(flat) ||
        w.d.toLowerCase().includes(needle)
      );
    });
  }, [inBand, q, show, index, knowledge]);

  const ids = useMemo(() => rows.map((w) => wordId(w.w)), [rows]);
  const selection = useRangeSelection(ids);
  useEffect(() => setCap(STEP), [q, show, band]);

  function addSelection(target: string) {
    const picked: ItemId[] = ids.filter((id) => selection.selected.has(id));
    collect(target, picked, { newName: nextCollectionName(collections) });
    selection.clear();
  }

  return (
    <>
      <div className="row words-shelf-bar">
        <Seg
          size="sm"
          label="Band"
          value={String(band)}
          options={BANDS}
          onChange={(v) => setQuery('words', v, '1')}
        />
        <div className="chips">
          {WORD_SHOW.map((s) => (
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
          <b>{rows.length}</b> of {inBand.length} · {counts.known} known · {counts.learning} learning
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <span className="big">空</span>
          Nothing matches those filters.
        </div>
      ) : (
        <div className="grid">
          {rows.slice(0, cap).map((w) => {
            const id = wordId(w.w);
            const status = knowledge.status(w.w);
            const inside = index.get(id);
            return (
              <ItemCard
                key={id}
                glyph={w.w}
                py={w.py}
                gloss={w.d}
                strokes={lib.strokes}
                word
                learned={status === 'known'}
                selected={selection.selected.has(id)}
                claimed={Boolean(inside?.length)}
                title={
                  status === 'known'
                    ? 'Known'
                    : status === 'learning'
                      ? 'Learning'
                      : inside?.length
                        ? `Waiting in ${inside.map((c) => c.name).join(', ')}`
                        : 'Not learned yet'
                }
                onClick={(shift) => selection.toggle(id, shift)}
                onOpen={() => openItem(id)}
              />
            );
          })}
        </div>
      )}

      {rows.length > cap && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" onClick={() => setCap((c) => c + 2 * STEP)}>
            Show more — {rows.length - cap} left
          </button>
        </div>
      )}

      {selection.selected.size > 0 && (
        <div className="tray">
          <b>{itemsLabel([...selection.selected])} selected</b>
          <button className="btn ghost sm" onClick={selection.clear}>
            Clear
          </button>
          <div className="spacer" />
          <span className="small muted">Learn in</span>
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
