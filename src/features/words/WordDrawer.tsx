import { useEffect, useMemo } from 'react';
import { Link, useMatch } from 'react-router';
import { nextCollectionName } from '../../domain/collection';
import { charId, idValue, type ItemId } from '../../domain/ids';
import { firstSense } from '../../domain/library';
import { DAY } from '../../domain/memory';
import { collectedItems } from '../../domain/sweep';
import { hskLabel } from '../../domain/text';
import { wordInfo, wordKnowledge } from '../../domain/words';
import { useOpenItem } from '../../navigation/itemDrawer';
import { paths } from '../../navigation/paths';
import { toggleLearned } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { useSheetDrag } from '../../ui/useSheetDrag';
import { CollectionPicker, useCollect } from '../shared/collect';
import { useLibrary } from '../shared/library';
import './words.css';

interface Props {
  id: ItemId;
  onClose: () => void;
}

/**
 * One word, in a drawer over the page it was tapped on — at `?item=w东西`,
 * the way a character is at `?item=c东`.
 *
 * It is the answer to the question a passage raises: not what 东 means and
 * what 西 means, but what 东西 means, how it is read, what it is counted
 * with, and where you have met it. Its characters are one tap away, for when
 * the question is the other one.
 */
export function WordDrawer({ id, onClose }: Props) {
  const lib = useLibrary();
  const collect = useCollect();
  const openItem = useOpenItem();
  const recall = useStore((s) => s.recall);
  const collections = useStore((s) => s.collections);
  const texts = useStore((s) => s.texts);
  const learned = useStore((s) => s.learned.has(id));
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

  const w = idValue(id);
  const info = wordInfo(lib, w);
  const chars = [...w];
  const collected = useMemo(() => collectedItems(collections), [collections]);
  const status = wordKnowledge(lib, recall, collected).status(w);
  const r = recall[id]?.recognise;
  const inCollections = collections.filter((c) => c.items.includes(id));
  const seenIn = useMemo(
    () => texts.filter((t) => t.lines.some((l) => l.zh.includes(w))).slice(0, 5),
    [texts, w],
  );

  // A list Claude wrote to order explains its words for the situation it was
  // written for — worth more than a gloss where there is one.
  const explained = useMemo(
    () => collections.flatMap((c) => (c.words ?? []).filter((x) => x.w === w).map((cw) => ({ c, cw }))).slice(0, 2),
    [collections, w],
  );
  const fromList = explained[0]?.cw;

  const current = collections.find((x) => x.id === match?.params.collectionId) ?? null;
  const addTo = (target: string) => collect(target, [id], { newName: nextCollectionName(collections) });

  return (
    <div className="drawer" data-leaving={sheet.leaving || undefined} onClick={close}>
      <div />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={w}
        onClick={(e) => e.stopPropagation()}
        {...sheet.sheetProps}
      >
        <div className="sheet-head">
          <div className="grip" {...sheet.gripProps} aria-hidden="true">
            <span />
          </div>
          <div className="row sheet-top" style={{ justifyContent: 'space-between' }}>
            <button className="btn ghost sm close" onClick={close}>
              ✕ Close
            </button>
            <div className="row">
              <button
                className={`btn sm word-known${learned ? ' primary' : ''}`}
                onClick={() => toggleLearned(id)}
                title={learned ? 'Counted as known — tap to take that back' : 'Count this word as known'}
              >
                {learned ? '✓ Known' : 'I know it'}
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
                  placeholder="Learn it in…"
                  onPick={addTo}
                  style={{ width: 'auto', maxWidth: 190 }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="word-hero">
          <span className="word-han hanzi" lang="zh-CN" data-len={Math.min(5, chars.length)}>
            {w}
          </span>
          <div className="word-said">
            <div className="row" style={{ gap: 8 }}>
              {(info ?? fromList) && <span className="word-py">{info?.py ?? fromList?.py}</span>}
              <Say text={w} size="lg" />
            </div>
            <h1 className="word-meaning">{info?.d ?? fromList?.d ?? 'Not in the dictionary'}</h1>
            <p className="tiny muted" style={{ margin: 0 }}>
              {info?.listed ? hskLabel(info.hsk) : 'Off the HSK lists'}
              {info?.cl?.length ? ` · counted with ${info.cl.join('、')}` : ''}
            </p>
          </div>
        </div>

        {info?.alt?.length ? (
          <p className="small muted word-alt">
            {info.alt.map((a, i) => (
              <span key={a.py}>
                {i ? '; ' : 'Also read '}
                <span style={{ color: 'var(--accent)' }}>{a.py}</span> — {a.d}
              </span>
            ))}
          </p>
        ) : null}

        <div className="subtle-rule" />

        <dl className="kv">
          <dt>You</dt>
          <dd>
            {status === 'known' ? 'Know it' : status === 'learning' ? 'Are learning it' : 'Have not learned it yet'}
            {r && <span className="muted"> · {nextCheck(r.due, Date.now())}</span>}
          </dd>
          <dt>Collections</dt>
          <dd>
            {inCollections.length ? (
              <span className="pill-list">
                {inCollections.map((t) => (
                  <Link key={t.id} className="pill as-button" to={paths.collection(t.id, 'items')}>
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
        <h2 className="word-h2">
          {chars.length > 1 ? 'Its characters' : 'The character'}{' '}
          <span className="tiny muted" style={{ fontWeight: 400 }}>
            · tap one for everything about it
          </span>
        </h2>
        <div className="word-chars">
          {chars.map((ch, i) => {
            const e = lib.byChar.get(ch);
            return (
              <button
                key={i}
                type="button"
                className="word-char"
                disabled={!e}
                onClick={() => openItem(charId(ch))}
              >
                <Glyph char={ch} strokes={lib.strokes} size={34} />
                <span className="meta">
                  <span className="py">{e?.py[0] ?? ''}</span>
                  <span className="d">{e ? firstSense(e.def) : 'not in the library'}</span>
                </span>
              </button>
            );
          })}
        </div>

        {explained.map(({ c, cw }) => (
          <div key={c.id}>
            <div className="subtle-rule" />
            <h2 className="word-h2">
              From “{c.name}”
            </h2>
            {cw.explain && (
              <p className="small" style={{ margin: '0 0 8px' }}>
                {cw.explain}
              </p>
            )}
            {cw.examples.map((x) => (
              <p key={x.zh} className="word-ex">
                <span className="hanzi zh" lang="zh-CN">
                  {x.zh}
                </span>
                <Say text={x.zh} />
                <span className="py">{x.py}</span>
                <span className="small muted">{x.en}</span>
              </p>
            ))}
          </div>
        ))}

        {info?.ex?.length ? (
          <>
            <div className="subtle-rule" />
            <h2 className="word-h2">In a sentence</h2>
            {info.ex.map((x) => (
              <p key={x.zh} className="word-ex">
                <span className="hanzi zh" lang="zh-CN">
                  {x.zh}
                </span>
                <Say text={x.zh} />
                <span className="py">{x.py}</span>
                <span className="small muted">{x.en}</span>
              </p>
            ))}
          </>
        ) : null}

        {seenIn.length > 0 && (
          <>
            <div className="subtle-rule" />
            <h2 className="word-h2">In your texts</h2>
            <span className="pill-list">
              {seenIn.map((t) => (
                <Link key={t.id} className="pill as-button" to={paths.text(t.id)}>
                  {t.titleZh || t.title}
                </Link>
              ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** When the word comes up in review next, said the way a person would. */
function nextCheck(due: number, now: number): string {
  if (due <= now) return 'asked about next time you review';
  const days = Math.round((due - now) / DAY);
  if (days <= 1) return 'asked about again tomorrow';
  return days < 31 ? `asked about again in ${days} days` : 'asked about again in a month or more';
}
