import { useEffect, useMemo } from 'react';
import { Link, useMatch } from 'react-router';
import { nextCollectionName } from '../../domain/collection';
import { wordId, type ItemId } from '../../domain/ids';
import { characterOf, partGloss } from '../../domain/library';
import {
  DAY,
  masteryOf,
  skillHold,
  SKILL_META,
  SKILLS,
  type Recall,
  type SkillBook,
} from '../../domain/memory';
import { seriesFor } from '../../domain/series';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { toggleLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { AnimatedGlyph, Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { useSheetDrag } from '../../ui/useSheetDrag';
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
  const openItem = useOpenItem();
  const learned = useStore((s) => s.learned.has(id));
  const book = useStore((s) => s.recall[id]);
  const collections = useStore((s) => s.collections);
  const match = useMatch('/collections/:collectionId/*');
  const sheet = useSheetDrag(onClose);
  const { close } = sheet;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const inCollections = useMemo(() => collections.filter((x) => x.items.includes(id)), [collections, id]);

  // Recomputed when the record changes rather than on a clock: the numbers
  // move by fractions of a percent an hour, and a panel that ticks would be
  // the only moving thing on the screen.
  const mastery = useMemo(() => masteryOf(book, Date.now()), [book]);

  const c = characterOf(lib, id);
  const char = c?.c ?? '';
  const strokes = lib.strokes[char];
  const family = c ? seriesFor(lib, c.c) : null;

  // Opened from inside a collection, that collection is the obvious place for it.
  const current = collections.find((x) => x.id === match?.params.collectionId) ?? null;
  const addTo = (target: string) => collect(target, [id], { newName: nextCollectionName(collections) });

  return (
    <div className="drawer" data-leaving={sheet.leaving || undefined} onClick={close}>
      <div />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={char || 'Not found'}
        onClick={(e) => e.stopPropagation()}
        {...sheet.sheetProps}
      >
        {/* Grip and actions travel together: on a phone they are the one part
            of the sheet that has to stay under the thumb as it scrolls. */}
        <div className="sheet-head">
          <div className="grip" {...sheet.gripProps} aria-hidden="true">
            <span />
          </div>
          <div className="row sheet-top" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost sm close" onClick={close}>
              ✕ Close
            </button>
            {char && (
              <div className="row">
                <button
                  className={`btn sm${learned ? ' primary' : ''}`}
                  onClick={() => toggleLearned(id)}
                >
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
              <dd>
                {mastery.since ? (
                  <>
                    {learned ? 'Learned' : 'Started'}{' '}
                    <span className="muted">· {dateOf(mastery.since)}</span>
                  </>
                ) : (
                  <span className="muted">Not learned yet</span>
                )}
              </dd>
              <dt>Mastery</dt>
              <dd>
                <span className="band" data-band={mastery.band}>
                  {mastery.label}
                </span>{' '}
                <span className="muted">
                  · {Math.round(mastery.score * 100)}% over the four skills
                </span>
              </dd>
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

            <div className="subtle-rule" />
            <h2 style={{ fontSize: 13, margin: '0 0 8px' }}>
              How it is holding{' '}
              <span className="tiny muted" style={{ fontWeight: 400 }}>
                · the four skills are scheduled apart, because they are forgotten apart
              </span>
            </h2>
            <SkillHolds book={book} />

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
                        <button
                          type="button"
                          className="word-link hanzi"
                          title="Everything about this word"
                          onClick={() => openItem(wordId(w.w))}
                        >
                          {w.w}
                        </button>
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
                HSK {c.hsk >= 7 ? '7–9' : c.hsk}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The date something entered the picture, short enough to sit in a table. */
const dateOf = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** When the next question about it falls, in the words a person would use. */
function whenDue(r: Recall, now: number): string {
  if (r.due <= now) return 'due now';
  const days = Math.round((r.due - now) / DAY);
  if (days <= 1) return 'due tomorrow';
  if (days < 31) return `due in ${days} days`;
  const months = Math.round(days / 30);
  return months < 12 ? `due in ${months} months` : 'due in about a year';
}

/**
 * The four skills, each with how firmly it is held and when it comes back.
 *
 * This is the part of the schedule that the rest of the app only ever shows
 * you one drill at a time. Seen together it explains the thing that otherwise
 * looks like a bug: a character you have "learned" turning up again in the
 * writing drill weeks later, because recognition and the hand are two
 * different memories and only one of them was ever tested.
 */
function SkillHolds({ book }: { book: SkillBook | undefined }) {
  const now = Date.now();
  return (
    <ul className="skill-holds">
      {SKILLS.map((skill) => {
        const r = book?.[skill];
        const hold = skillHold(r, now);
        return (
          <li key={skill} data-seen={Boolean(r) || undefined}>
            <b>{SKILL_META[skill].label}</b>
            <span className="hold" aria-hidden="true">
              <i style={{ width: `${Math.max(r ? 3 : 0, Math.round(hold * 100))}%` }} />
            </span>
            <i className="tiny">
              {r ? (
                <>
                  {whenDue(r, now)}
                  <span className="muted">
                    {' '}
                    · {r.reps} answer{r.reps === 1 ? '' : 's'}
                    {r.lapses > 0 ? `, ${r.lapses} missed` : ''}
                  </span>
                </>
              ) : (
                <span className="muted">not asked yet</span>
              )}
            </i>
          </li>
        );
      })}
    </ul>
  );
}
