import { useMemo, useState } from 'react';
import type { Collection } from '../../domain/collection';
import { itemsLabel, type ItemId } from '../../domain/ids';
import { factsOf, poolFor, wordPoolFor, type ItemFacts } from '../../domain/library';
import { addItems, removeItems } from '../../store/commands';
import { ItemCard } from '../../ui/ItemCard';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';

interface Props {
  c: Collection;
  /** ids already sitting in some other collection */
  taken: ReadonlySet<ItemId>;
}

const LIMIT = 24;

const flatten = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Adding by name.
 *
 * What was here before was a button that took the next N characters in
 * teaching order — fine for working through a band, useless for "I keep
 * getting 慢 wrong, put it in". Searching is the same thing done deliberately:
 * type a character, a reading or a meaning, click what you meant.
 *
 * Words are searched too — 东西, dongxi, "thing" — and marked 词 among the
 * characters, so the word 好 and the character 好 can both be found and told
 * apart.
 */
export function AddSearch({ c, taken }: Props) {
  const lib = useLibrary();
  const toast = useToast();
  const [q, setQ] = useState('');
  const pool = useMemo(() => [...poolFor(lib), ...wordPoolFor(lib)], [lib]);
  const inside = useMemo(() => new Set(c.items), [c.items]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as ItemFacts[];
    const flat = flatten(query);
    const scored: Array<{ f: ItemFacts; score: number }> = [];
    for (const id of pool) {
      const f = factsOf(lib, id);
      if (!f) continue;
      // Ranked, not just filtered: typing "hao" should put 好 first rather
      // than the first character in the syllabus whose gloss says "how".
      const py = flatten(f.py.toLowerCase());
      // A word's reading is written a syllable at a time — dōng xi — and
      // typed as one: dongxi.
      const joined = f.kind === 'word' ? py.replace(/ /g, '') : py;
      const bare = flat.replace(/ /g, '');
      let score = -1;
      if (f.glyph === query) score = 0;
      else if (py === flat || joined === bare || py.split(' / ').includes(flat)) score = 1;
      else if (py.startsWith(flat) || joined.startsWith(bare)) score = 2;
      else if (f.gloss.toLowerCase().startsWith(query)) score = 3;
      else if (py.includes(flat)) score = 4;
      else if (f.gloss.toLowerCase().includes(query)) score = 5;
      if (score >= 0) scored.push({ f, score });
    }
    // Ties break on frequency, not teaching order: someone typing "hao" wants
    // 好 before 号, whichever the syllabus introduces first. Words carry no
    // frequency; they follow the characters, lowest band first.
    const rank = (f: ItemFacts) => (f.kind === 'word' ? 10_000 + f.idx : f.freq);
    scored.sort((a, b) => a.score - b.score || rank(a.f) - rank(b.f));
    return scored.slice(0, LIMIT).map((s) => s.f);
  }, [q, pool, lib]);

  function toggle(id: ItemId, glyph: string) {
    if (inside.has(id)) {
      removeItems(c.id, [id]);
      return;
    }
    addItems(c.id, [id]);
    toast(`Added ${glyph}`);
  }

  return (
    <div className="add-search">
      <div className="row" style={{ gap: 8 }}>
        <input
          type="search"
          className="grow"
          value={q}
          aria-label="Add a character or a word"
          placeholder="Add — search 好, 东西, hao, good…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) toggle(results[0].id, results[0].glyph);
            if (e.key === 'Escape') setQ('');
          }}
        />
        {q && (
          <button className="btn ghost sm" onClick={() => setQ('')}>
            Clear
          </button>
        )}
      </div>

      {q.trim() !== '' && (
        <div className="results">
          {results.length === 0 ? (
            <p className="small muted" style={{ margin: '10px 2px' }}>
              Nothing among the characters or the syllabus words matches “{q.trim()}”.
            </p>
          ) : (
            <>
              <p className="tiny muted" style={{ margin: '10px 2px 8px' }}>
                {itemsLabel(results.map((f) => f.id))} — click to put one in, click again to take it out.
                Enter adds the first.
              </p>
              <div className="grid results-grid">
                {results.map((f) => (
                  <ItemCard
                    key={f.id}
                    glyph={f.glyph}
                    py={f.py}
                    gloss={f.gloss}
                    strokes={lib.strokes}
                    size={38}
                    word={f.kind === 'word'}
                    index={inside.has(f.id) ? '✓' : undefined}
                    selected={inside.has(f.id)}
                    claimed={taken.has(f.id)}
                    title={
                      inside.has(f.id)
                        ? 'Already in this collection — click to take it out'
                        : taken.has(f.id)
                          ? 'In another collection'
                          : 'Click to add'
                    }
                    onClick={() => toggle(f.id, f.glyph)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
