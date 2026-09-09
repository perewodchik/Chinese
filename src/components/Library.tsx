import { useEffect, useMemo, useState } from 'react';
import type { CharacterEntry, Library as Lib, RadicalEntry } from '../data/types';
import { charId, radId, type ItemId, type ItemKind, type Template } from '../store/types';
import { Glyph } from './Glyph';

type StatusFilter = 'all' | 'learned' | 'todo';
type Sort = 'order' | 'strokes' | 'freq' | 'radical';

interface Props {
  lib: Lib;
  kind: ItemKind;
  onKind: (k: ItemKind) => void;
  index: Map<ItemId, Template[]>;
  learned: Set<ItemId>;
  selection: Set<ItemId>;
  onToggle: (id: ItemId, shiftKey: boolean) => void;
  onOpen: (id: ItemId) => void;
  radicalLimit: number;
  onRadicalLimit: (n: number) => void;
  hskBand: number;
  onHskBand: (n: number) => void;
}

const STATUS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'learned', label: 'Learned' },
  { id: 'todo', label: 'Not learned' },
];

export function LibraryView({
  lib,
  kind,
  onKind,
  index,
  learned,
  selection,
  onToggle,
  onOpen,
  radicalLimit,
  onRadicalLimit,
  hskBand,
  onHskBand,
}: Props) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('order');
  // 3000 cards at once is a lot of SVG; reveal them in chunks instead.
  const [cap, setCap] = useState(300);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base: Array<{
      id: ItemId;
      char: string;
      py: string;
      gloss: string;
      idx: number;
      strokes: number;
      freq: number;
      radical: string;
    }> =
      kind === 'char'
        ? lib.characters
            .filter((c) => (hskBand ? c.hsk === hskBand : true))
            .map((c: CharacterEntry) => ({
            id: charId(c.c),
            char: c.c,
            py: c.py.join(' / '),
            gloss: c.def,
            idx: c.i,
            strokes: c.sc ?? 0,
            freq: c.freq,
            radical: c.rad ?? '',
          }))
        : [...lib.radicals]
            .sort((a, b) => a.rank - b.rank)
            .filter((_, i) => (radicalLimit ? i < radicalLimit : true))
            .map((r: RadicalEntry) => ({
              id: radId(r.n),
              char: r.r,
              py: r.py,
              gloss: [r.mean, r.cn].filter(Boolean).join(' · '),
              idx: r.rank,
              strokes: r.sc ?? 0,
              freq: -r.useful,
              radical: r.kangxi,
            }));

    const matches = base.filter((row) => {
      if (query) {
        const hay = `${row.char} ${row.py} ${row.gloss}`.toLowerCase();
        // strip tone marks so "nu" finds nǚ
        const flat = hay.normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (!hay.includes(query) && !flat.includes(query)) return false;
      }
      const isLearned = learned.has(row.id);
      if (status === 'learned') return isLearned;
      if (status === 'todo') return !isLearned;
      return true;
    });

    const cmp: Record<Sort, (a: typeof matches[0], b: typeof matches[0]) => number> = {
      order: (a, b) => a.idx - b.idx,
      strokes: (a, b) => a.strokes - b.strokes || a.idx - b.idx,
      freq: (a, b) => a.freq - b.freq,
      radical: (a, b) => a.radical.localeCompare(b.radical) || a.idx - b.idx,
    };
    return [...matches].sort(cmp[sort]);
  }, [lib, kind, q, status, sort, index, learned, radicalLimit, hskBand]);

  useEffect(() => setCap(300), [kind, q, status, sort, hskBand, radicalLimit]);

  const counts = useMemo(() => {
    const all =
      kind === 'char'
        ? lib.characters.filter((c) => (hskBand ? c.hsk === hskBand : true)).length
        : lib.radicals.length;
    let done = 0;
    const ids =
      kind === 'char'
        ? lib.characters
            .filter((c) => (hskBand ? c.hsk === hskBand : true))
            .map((c) => charId(c.c))
        : lib.radicals.map((r) => radId(r.n));
    for (const id of ids) {
      if (learned.has(id)) done++;
    }
    return { all, learned: done };
  }, [lib, kind, learned, hskBand]);

  return (
    <section>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="tabs">
          <button
            aria-selected={kind === 'char'}
            onClick={() => onKind('char')}
          >
            Characters
          </button>
          <button
            aria-selected={kind === 'radical'}
            onClick={() => onKind('radical')}
          >
            Radicals
          </button>
        </div>

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === 'char' ? 'Search 好, hao, good…' : 'Search 氵, shui, water…'}
          style={{ maxWidth: 280 }}
        />

        {kind === 'char' && (
          <label className="field" style={{ width: 132 }}>
            <select value={hskBand} onChange={(e) => onHskBand(Number(e.target.value))}>
              <option value={0}>All 3000</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  HSK {n}
                </option>
              ))}
              <option value={7}>HSK 7–9</option>
            </select>
          </label>
        )}

        <label className="field" style={{ width: 150 }}>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="order">
              {kind === 'char' ? 'Teaching order' : 'Most used first'}
            </option>
            <option value="strokes">Stroke count</option>
            <option value="freq">Frequency</option>
            <option value="radical">Radical</option>
          </select>
        </label>

        {kind === 'radical' && (
          <label className="field" style={{ width: 150 }}>
            <select
              value={radicalLimit}
              onChange={(e) => onRadicalLimit(Number(e.target.value))}
            >
              <option value={30}>Top 30</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={0}>All {lib.radicals.length}</option>
            </select>
          </label>
        )}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="chips">
          {STATUS.map((s) => (
            <button
              key={s.id}
              className="chip"
              aria-pressed={status === s.id}
              onClick={() => setStatus(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="legend">
          <span>
            <i className="swatch learned" /> learned
          </span>
        </div>
      </div>

      <div className="row small muted" style={{ marginBottom: 10 }}>
        <span>
          Showing <b>{rows.length}</b> of {counts.all}
        </span>
        <span>·</span>
        <span>{counts.learned} learned</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <span className="big">空</span>
          Nothing matches those filters.
        </div>
      ) : (
        <div className="grid">
          {rows.slice(0, cap).map((row) => {
            const isLearned = learned.has(row.id);
            return (
              <div
                key={row.id}
                className="item"
                role="button"
                tabIndex={0}
                data-selected={selection.has(row.id)}
                data-learned={isLearned}
                title={isLearned ? 'Learned' : 'Not learned yet'}
                onClick={(e) => onToggle(row.id, e.shiftKey)}
                onDoubleClick={() => onOpen(row.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle(row.id, e.shiftKey);
                  }
                  if (e.key === 'i') onOpen(row.id);
                }}
              >
                <span className="idx">{row.idx}</span>
                <span className="marks">
                  {isLearned && <span className="tick">✓</span>}
                </span>
                <Glyph char={row.char} strokes={lib.strokes} size={46} className="glyph" />
                <div className="py">{row.py}</div>
                <div className="gloss">{row.gloss}</div>
                <button
                  className="info"
                  title="Everything about this character"
                  aria-label={`Details for ${row.char}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(row.id);
                  }}
                >
                  i
                </button>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > cap && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn" onClick={() => setCap((c) => c + 600)}>
            Show more — {rows.length - cap} left
          </button>
        </div>
      )}
    </section>
  );
}
