import type { Library } from '../data/types';
import { charId, radId, type ItemId } from '../store/types';
import { AnimatedGlyph, Glyph } from './Glyph';

interface Props {
  lib: Library;
  id: ItemId;
  learned: boolean;
  inTemplates: Array<{ id: string; name: string }>;
  onOpenTemplate: (id: string) => void;
  onClose: () => void;
  onToggleLearned: () => void;
  onAdd: () => void;
  canAdd: boolean;
}

const IDC_NAME: Record<string, string> = {
  '⿰': 'left + right',
  '⿱': 'top + bottom',
  '⿲': 'three across',
  '⿳': 'three down',
  '⿴': 'enclosed',
  '⿵': 'open at the bottom',
  '⿶': 'open at the top',
  '⿷': 'open at the right',
  '⿸': 'wrapped from upper left',
  '⿹': 'wrapped from upper right',
  '⿺': 'wrapped from lower left',
  '⿻': 'overlapping',
};

export function Detail({
  lib,
  id,
  learned,
  inTemplates,
  onOpenTemplate,
  onClose,
  onToggleLearned,
  onAdd,
  canAdd,
}: Props) {
  const isChar = !id.startsWith('r');
  const c = isChar ? lib.byChar.get(id.slice(1)) : undefined;
  const r = !isChar
    ? lib.radicals.find((x) => radId(x.n) === id)
    : undefined;
  const char = c?.c ?? r?.r ?? '';
  const strokes = lib.strokes[char];

  return (
    <div className="drawer" onClick={onClose}>
      <div />
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost sm close" onClick={onClose}>
            ✕ Close
          </button>
          <div className="row">
            <button
              className={`btn sm${learned ? ' primary' : ''}`}
              onClick={onToggleLearned}
            >
              {learned ? '✓ Learned' : 'Mark as learned'}
            </button>
            <button className="btn sm primary" onClick={onAdd} disabled={!canAdd}>
              Add to template
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 22, alignItems: 'flex-start', margin: '16px 0 6px' }}>
          <AnimatedGlyph char={char} strokes={lib.strokes} size={104} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, color: 'var(--accent)' }}>
              {c ? c.py.join(' / ') : r?.py}
            </div>
            <h1 style={{ fontSize: 17, marginTop: 4 }}>{c ? c.def : r?.mean}</h1>
            {r?.cn && (
              <div className="small muted">
                <span className="hanzi" style={{ fontSize: 15 }}>
                  {r.cn}
                </span>{' '}
                {r.cnPy}
              </div>
            )}
          </div>
        </div>

        <div className="subtle-rule" />

        <dl className="kv">
          {c && (
            <>
              <dt>Position</dt>
              <dd>#{c.i} in teaching order</dd>
              <dt>Strokes</dt>
              <dd>{c.sc}</dd>
              <dt>Radical</dt>
              <dd>
                <span className="hanzi" style={{ fontSize: 17 }}>
                  {c.rad}
                </span>{' '}
                <span className="muted small">{lib.components[c.rad ?? '']?.def}</span>
              </dd>
              {c.trad && (
                <>
                  <dt>Traditional</dt>
                  <dd className="hanzi" style={{ fontSize: 17 }}>
                    {c.trad}
                  </dd>
                </>
              )}
              <dt>Frequency</dt>
              <dd>#{c.freq} most common</dd>
            </>
          )}
          {r && (
            <>
              <dt>Kangxi no.</dt>
              <dd>
                #{r.n} · {r.rank}
                {r.rank === 1 ? 'st' : r.rank === 2 ? 'nd' : r.rank === 3 ? 'rd' : 'th'} most used
              </dd>
              <dt>Strokes</dt>
              <dd>{r.sc}</dd>
              {r.variants.length > 0 && (
                <>
                  <dt>Also written</dt>
                  <dd className="hanzi" style={{ fontSize: 19 }}>
                    {r.variants.join('  ')}
                  </dd>
                </>
              )}
              <dt>Used in</dt>
              <dd>{r.count} characters</dd>
            </>
          )}
          <dt>Progress</dt>
          <dd>{learned ? 'Learned' : <span className="muted">Not learned yet</span>}</dd>
          <dt>In templates</dt>
          <dd>
            {inTemplates.length ? (
              <span className="pill-list">
                {inTemplates.map((t) => (
                  <button
                    key={t.id}
                    className="pill as-button"
                    onClick={() => onOpenTemplate(t.id)}
                    title="Open this template"
                  >
                    {t.name}
                  </button>
                ))}
              </span>
            ) : (
              <span className="muted">Not in any template yet</span>
            )}
          </dd>
        </dl>

        {/* ------------------------------------------------ memory */}
        {c?.ids && c.parts.length > 1 && (
          <>
            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Built from</h2>
            <div className="row">
              <span className="tiny muted">{IDC_NAME[c.ids[0]] ?? ''}</span>
              {c.parts.map((p, i) => (
                <span key={i} className="row" style={{ gap: 6 }}>
                  {i > 0 && <span className="muted">+</span>}
                  <Glyph char={p} strokes={lib.strokes} size={28} />
                  <span className="small muted">{lib.components[p]?.def ?? ''}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {c?.ety && (
          <div className="hint" style={{ marginTop: 10 }}>
            {c.ety.type === 'pictophonetic' && c.ety.semantic && c.ety.phonetic ? (
              <>
                <span className="hanzi">{c.ety.semantic}</span> gives the meaning
                {c.ety.hint ? ` (${c.ety.hint})` : ''} ·{' '}
                <span className="hanzi">{c.ety.phonetic}</span> gives the sound
              </>
            ) : (
              c.ety.hint
            )}
          </div>
        )}

        {r?.note && (
          <div className="hint" style={{ marginTop: 10 }}>
            {r.note}
          </div>
        )}

        {/* ------------------------------------------------ strokes */}
        {strokes && (
          <>
            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>
              Stroke order · {strokes.s.length} strokes
            </h2>
            <div className="strokerow">
              {strokes.s.map((_, i) => (
                <div key={i} className="box">
                  <Glyph
                    char={char}
                    strokes={lib.strokes}
                    size={40}
                    upto={i + 1}
                    color="var(--line-2)"
                    highlight="var(--accent)"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ------------------------------------------------ words */}
        {c && c.words.length > 0 && (
          <>
            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Common words</h2>
            <div className="wordrow">
              {c.words.map((w) => (
                <div key={w.w} className="word">
                  <div className="w">{w.w}</div>
                  <div className="small" style={{ color: 'var(--accent)' }}>
                    {w.p}
                  </div>
                  <div className="tiny muted">{w.d}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {c?.sent && (
          <p style={{ marginTop: 14 }}>
            <span className="hanzi" style={{ fontSize: 17 }}>
              {c.sent.zh}
            </span>
            <br />
            <span className="small muted">{c.sent.en}</span>
          </p>
        )}

        {/* ------------------------------------------------ confusables */}
        {c && c.conf.length > 0 && (
          <>
            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Don't confuse with</h2>
            <div className="row">
              {c.conf.map((d) => (
                <span key={d} className="row" style={{ gap: 6 }}>
                  <Glyph char={d} strokes={lib.strokes} size={30} />
                  <span className="small muted">
                    {lib.components[d]?.py} {lib.components[d]?.def}
                  </span>
                </span>
              ))}
            </div>
          </>
        )}

        {r && r.ex.length > 0 && (
          <>
            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Appears in</h2>
            <div className="row">
              {r.ex.map((e) => {
                const entry = lib.byChar.get(e);
                return (
                  <span key={e} className="row" style={{ gap: 5 }}>
                    <Glyph char={e} strokes={lib.strokes} size={30} />
                    <span className="tiny muted">
                      {entry ? entry.py[0] : lib.components[e]?.py}
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        )}

        {c && (
          <p className="tiny muted" style={{ marginTop: 22 }}>
            {charId(c.c) === id ? '' : ''}
            HSK 3.0 level {c.hsk}
          </p>
        )}
      </div>
    </div>
  );
}
