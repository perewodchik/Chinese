import { useEffect, useMemo } from 'react';
import { Link, useMatch } from 'react-router';
import { nextCollectionName } from '../../domain/collection';
import type { ItemId } from '../../domain/ids';
import { characterOf, partGloss } from '../../domain/library';
import { seriesFor } from '../../domain/series';
import { paths } from '../../navigation/paths';
import { toggleLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { AnimatedGlyph, Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';

interface Props {
  id: ItemId;
  onClose: () => void;
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

/** Everything known about one character, in a drawer over the page it was opened from. */
export function ItemDrawer({ id, onClose }: Props) {
  const lib = useLibrary();
  const collect = useCollect();
  const learned = useStore((s) => s.learned.has(id));
  const collections = useStore((s) => s.collections);
  const match = useMatch('/collections/:collectionId/*');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inCollections = useMemo(() => collections.filter((x) => x.items.includes(id)), [collections, id]);

  const c = characterOf(lib, id);
  const char = c?.c ?? '';
  const strokes = lib.strokes[char];
  const family = c ? seriesFor(lib, c.c) : null;

  // Opened from inside a collection, that collection is the obvious place for it.
  const current = collections.find((x) => x.id === match?.params.collectionId) ?? null;
  const addTo = (target: string) => collect(target, [id], { newName: nextCollectionName(collections) });

  return (
    <div className="drawer" onClick={onClose}>
      <div />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={char || 'Not found'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost sm close" onClick={onClose}>
            ✕ Close
          </button>
          {char && (
            <div className="row">
              <button className={`btn sm${learned ? ' primary' : ''}`} onClick={() => toggleLearned(id)}>
                {learned ? '✓ Learned' : 'Mark as learned'}
              </button>
              {current ? (
                <button
                  className="btn sm primary"
                  disabled={current.items.includes(id)}
                  onClick={() => addTo(current.id)}
                >
                  {current.items.includes(id) ? `In ${current.name}` : `Add to ${current.name}`}
                </button>
              ) : (
                <CollectionPicker
                  placeholder="Add to a collection…"
                  onPick={addTo}
                  style={{ width: 'auto', maxWidth: 210 }}
                />
              )}
            </div>
          )}
        </div>

        {!char ? (
          <div className="empty">
            <span className="big">空</span>
            Nothing in the library goes by “{id}”.
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: 22, alignItems: 'flex-start', margin: '16px 0 6px' }}>
              <AnimatedGlyph char={char} strokes={lib.strokes} size={104} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 22, color: 'var(--accent)' }}>{c?.py.join(' / ')}</span>
                  <Say text={char} size="lg" />
                </div>
                <h1 style={{ fontSize: 17, marginTop: 4 }}>{c?.def}</h1>
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
                    {c.radNum ? (
                      <Link className="pill as-button" to={paths.radical(c.radNum)} title="Everything about this radical">
                        <span className="hanzi" style={{ fontSize: 16 }}>
                          {c.rad}
                        </span>{' '}
                        <span className="muted small">{partGloss(lib.components, c, c.rad ?? '')}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="hanzi" style={{ fontSize: 17 }}>
                          {c.rad}
                        </span>{' '}
                        <span className="muted small">{partGloss(lib.components, c, c.rad ?? '')}</span>
                      </>
                    )}
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
              <dt>Progress</dt>
              <dd>{learned ? 'Learned' : <span className="muted">Not learned yet</span>}</dd>
              <dt>Collections</dt>
              <dd>
                {inCollections.length ? (
                  <span className="pill-list">
                    {inCollections.map((t) => (
                      <Link key={t.id} className="pill as-button" to={paths.collection(t.id)} title="Open this collection">
                        {t.name}
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="muted">Not in any collection yet</span>
                )}
              </dd>
            </dl>

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
                      <span className="small muted">{partGloss(lib.components, c, p)}</span>
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
                    {c.ety.hint ? ` (${c.ety.hint})` : ''} · <span className="hanzi">{c.ety.phonetic}</span> gives
                    the sound
                  </>
                ) : (
                  c.ety.hint
                )}
              </div>
            )}

            {strokes && (
              <>
                <div className="subtle-rule" />
                <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Stroke order · {strokes.s.length} strokes</h2>
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

            {c && c.words.length > 0 && (
              <>
                <div className="subtle-rule" />
                <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>Common words</h2>
                <div className="wordrow">
                  {c.words.map((w) => (
                    <div key={w.w} className="word">
                      <div className="w">
                        {w.w}
                        <Say text={w.w} />
                      </div>
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
                <Say text={c.sent.zh} />
                <br />
                <span className="small muted">{c.sent.en}</span>
              </p>
            )}

            {family && (
              <>
                <div className="subtle-rule" />
                <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>
                  Same sound part{' '}
                  <span className="tiny muted" style={{ fontWeight: 400 }}>
                    {family.phonetic}
                    {family.py ? ` ${family.py}` : ''} ·{' '}
                    {family.kept === family.members.length
                      ? 'all of them keep the reading'
                      : family.kept > 0
                        ? `${family.kept} of ${family.members.length} keep the reading`
                        : 'the sound has drifted in all of them'}
                  </span>
                </h2>
                <div className="family">
                  {family.members.map((m) => (
                    <span
                      key={m.c}
                      className="family-member"
                      data-self={m.c === char || undefined}
                      data-keeps={m.keeps || undefined}
                      title={m.def}
                    >
                      <Glyph char={m.c} strokes={lib.strokes} size={30} />
                      <span className="tiny">{m.py}</span>
                    </span>
                  ))}
                </div>
                <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                  A sound part is a promise the writing system mostly keeps. Learning these together is
                  one fact, not {family.members.length}.
                </p>
              </>
            )}

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

            {c && (
              <p className="tiny muted" style={{ marginTop: 22 }}>
                HSK 3.0 level {c.hsk}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
