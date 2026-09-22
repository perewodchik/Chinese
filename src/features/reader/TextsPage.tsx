import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { planSession } from '../../domain/session';
import {
  coverageOf,
  levelLabel,
  shelve,
  textCharCount,
  type GeneratedText,
  type TextSet,
} from '../../domain/text';
import { paths } from '../../navigation/paths';
import { renderTextSet } from '../../pdf/render';
import { downloadText, safeFileName } from '../../platform/files';
import { newId } from '../../platform/ids';
import {
  collectTexts,
  deleteSet,
  discardPlan,
  renameSet,
  reorderSet,
  setTextRead,
  startPlan,
} from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { Menu } from '../../ui/Menu';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/toast';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { readerSheet } from './readerSheet';

const dateName = () =>
  `Reading, ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

/**
 * Everything Claude has written for you, in the collections you keep it in.
 * It is a section of the Collections page, under the character collections:
 * a collection is a subject you are working through, and that is as true of
 * five passages as of forty characters.
 *
 * This is the other half of the app: the squares are where a character goes
 * in, and a passage is where it comes back out. A collection of texts is the
 * unit that matters — five passages planned together, printed together, and
 * read over a week — which is why the shelf is organised by collection rather
 * than by date. And since what belongs together is not always what was
 * written together, texts can be gathered from several into one.
 */
/** Starting a writing session — from the shelf, or from the New menu above it. */
export function useStartSession() {
  const lib = useLibrary();
  const navigate = useNavigate();
  const texts = useStore((s) => s.texts);
  const plan = useStore((s) => s.plan);
  const learned = useStore((s) => s.learned);
  const settings = useStore((s) => s.settings);

  return (setId: string | null = null, name?: string) => {
    if (plan && !confirm(`Start a new session? “${plan.name}” is still in progress, and would be thrown away.`)) {
      return;
    }
    startPlan(
      planSession({
        id: newId(),
        name: name ?? dateName(),
        setId,
        now: Date.now(),
        lib,
        learned,
        texts,
        basisCount: settings.basisCount,
        hsk: settings.targetHsk,
      }),
    );
    navigate(paths.session('plan'));
  };
}

/**
 * The text half of the Collections page: every collection of passages, the
 * writing session in progress, and picking texts to merge.
 */
export function TextShelf() {
  const toast = useToast();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const plan = useStore((s) => s.plan);
  const startSession = useStartSession();

  /** texts picked for a bulk action, or null when the shelf is not being picked from */
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [merging, setMerging] = useState(false);
  /** the collection whose texts are being put in order */
  const [ordering, setOrdering] = useState<string | null>(null);

  const { bySet, loose } = useMemo(() => shelve(texts, sets), [texts, sets]);
  const shelved = sets.filter((s) => bySet.has(s.id)).length;

  function toggle(ids: string[]) {
    setPicked((prev) => {
      const next = new Set(prev ?? []);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const selecting = picked !== null;
  const chosen = picked ?? new Set<string>();

  return (
    <section className="shelf" id="texts">
      <div className="shelf-head">
        <div>
          <h2 className="shelf-title">Texts</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {texts.length
              ? `${texts.length} passage${texts.length === 1 ? '' : 's'} in ${shelved} collection${shelved === 1 ? '' : 's'}, written around what you know.`
              : 'Passages written out of the characters you have marked learned.'}
          </p>
        </div>
        <div className="spacer" />
        {texts.length > 1 && (
          <button
            className="btn sm"
            aria-pressed={selecting}
            onClick={() => {
              setPicked(selecting ? null : new Set());
              setOrdering(null);
            }}
          >
            {selecting ? 'Done' : 'Select'}
          </button>
        )}
        <button className="btn sm" onClick={() => startSession(null)}>
          + Write texts
        </button>
      </div>

      {plan && (
        <div className="resume">
          <span className="mark">✎</span>
          <div style={{ minWidth: 0 }}>
            <b>{plan.name}</b>
            <p className="tiny muted" style={{ margin: 0 }}>
              {plan.specs.length} passages ·{' '}
              {plan.step === 'plan'
                ? 'still being planned'
                : plan.step === 'prompt'
                  ? plan.copiedAt
                    ? 'prompt copied — waiting for Claude’s answer'
                    : 'prompt ready to copy'
                  : plan.response.trim()
                    ? 'an answer is pasted and waiting to be saved'
                    : 'waiting for you to paste the answer'}
            </p>
          </div>
          <div className="spacer" />
          <button
            className="btn ghost sm"
            onClick={() => {
              if (confirm('Throw this session away?')) discardPlan();
            }}
          >
            Discard
          </button>
          <Link className="btn primary sm" to={paths.session(plan.step)}>
            Continue →
          </Link>
        </div>
      )}

      {selecting && (
        <p className="notice select-hint">
          Tap texts to pick them, or a collection’s box to pick all of it. Then merge them into one collection.
        </p>
      )}

      {texts.length === 0 ? (
        <div className="empty compact">
          <span className="big">读</span>
          <p style={{ maxWidth: 480 }}>
            Nothing written yet. Plan a few passages — how long, how hard, and how many new characters
            each one should teach you — and this app writes the brief. Claude writes the Chinese; you paste
            it back and print it.
          </p>
          <button className="btn primary" onClick={() => startSession(null)}>
            Plan the first session
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 26 }}>
          {sets.map((set) => {
            const list = bySet.get(set.id) ?? [];
            if (!list.length) return null;
            return (
              <SetShelf
                key={set.id}
                set={set}
                list={list}
                picked={selecting ? chosen : null}
                onPick={toggle}
                ordering={ordering === set.id}
                onOrder={(on) => setOrdering(on ? set.id : null)}
                onAddTexts={() => startSession(set.id, set.name)}
              />
            );
          })}

          {loose.length > 0 && (
            <section>
              <div className="set-bar">
                {selecting && (
                  <PickBox ids={loose.map((t) => t.id)} picked={chosen} onPick={toggle} label="Pick every loose text" />
                )}
                <div>
                  <h2 className="set-name">Loose texts</h2>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Written before collections existed, or left over from a deleted one. Select them to give
                    them a home.
                  </p>
                </div>
              </div>
              <div className="tpl-grid">
                {loose.map((t) => (
                  <TextCard
                    key={t.id}
                    text={t}
                    to={paths.text(t.id)}
                    picked={selecting ? chosen.has(t.id) : null}
                    onPick={() => toggle([t.id])}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selecting && chosen.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected texts">
          <b>
            {chosen.size} text{chosen.size === 1 ? '' : 's'}
          </b>
          <span className="tiny muted">
            from {new Set(texts.filter((t) => chosen.has(t.id)).map((t) => t.setId ?? '·')).size} place
            {new Set(texts.filter((t) => chosen.has(t.id)).map((t) => t.setId ?? '·')).size === 1 ? '' : 's'}
          </span>
          <div className="spacer" />
          <button
            className="btn sm"
            onClick={() => {
              for (const id of chosen) setTextRead(id, true);
              toast(`Marked ${chosen.size} read`);
            }}
          >
            Mark read
          </button>
          <button className="btn ghost sm" onClick={() => setPicked(new Set())}>
            Clear
          </button>
          <button className="btn primary sm" onClick={() => setMerging(true)}>
            Merge into a collection…
          </button>
        </div>
      )}

      {merging && (
        <MergeDialog
          ids={[...chosen]}
          onClose={() => setMerging(false)}
          onDone={(set) => {
            setMerging(false);
            setPicked(null);
            toast(`${chosen.size} text${chosen.size === 1 ? '' : 's'} now in “${set.name}”`);
          }}
        />
      )}
    </section>
  );
}

/** One collection on the shelf: its bar, its actions, and its texts. */
function SetShelf({
  set,
  list,
  picked,
  onPick,
  ordering,
  onOrder,
  onAddTexts,
}: {
  set: TextSet;
  list: GeneratedText[];
  picked: Set<string> | null;
  onPick: (ids: string[]) => void;
  ordering: boolean;
  onOrder: (on: boolean) => void;
  onAddTexts: () => void;
}) {
  const lib = useLibrary();
  const settings = useStore((s) => s.settings);
  const pdf = usePdfExport();
  const unread = list.filter((t) => !t.read).length;
  const taught = new Set(list.flatMap((t) => t.teach));
  const firstUnread = Math.max(0, list.findIndex((t) => !t.read));
  const ids = list.map((t) => t.id);

  function print() {
    void pdf.run(set.id, {
      title: set.name,
      render: () =>
        renderTextSet(lib, set.name, list, readerSheet(settings), {
          footerNote: settings.footerNote,
          practice: settings.readerPractice,
          perPage: settings.practicePerPage,
        }),
    });
  }

  /**
   * The collection as JSON — the same shape Claude sends back, so an export
   * pasted into a writing session's Paste step comes back in as texts.
   */
  function exportJson() {
    const texts = list.map((t) => ({
      title: t.title,
      titleZh: t.titleZh,
      lines: t.lines,
      vocab: t.vocab.map((w) => ({ w: w.w, py: w.py, d: w.d, new: w.isNew ?? false })),
      questions: t.questions,
      grammar: t.grammar,
      note: t.note,
      teach: t.teach.map((c) => ({ c, ...(t.glosses[c] ?? {}) })),
    }));
    downloadText(safeFileName(set.name, 'json'), JSON.stringify({ name: set.name, texts }, null, 2), 'application/json');
  }

  function move(i: number, by: number) {
    const next = [...ids];
    const [t] = next.splice(i, 1);
    next.splice(i + by, 0, t);
    reorderSet(set.id, next);
  }

  return (
    <section>
      <div className="set-bar">
        {picked && <PickBox ids={ids} picked={picked} onPick={onPick} label={`Pick all of “${set.name}”`} />}
        <div style={{ minWidth: 0 }}>
          <h2 className="set-name">{set.name}</h2>
          <p className="tiny muted" style={{ margin: 0 }}>
            {new Date(set.createdAt).toLocaleDateString()} · {list.length} texts · {taught.size} new characters ·{' '}
            {unread ? `${unread} still to read` : 'all read'}
          </p>
        </div>
        <div className="spacer" />
        {ordering ? (
          <button className="btn primary sm" onClick={() => onOrder(false)}>
            Done ordering
          </button>
        ) : (
          <>
            <Menu label="⋯" title={`More for “${set.name}”`} className="btn sm">
              {(close) => {
                const run = (fn: () => void) => () => {
                  close();
                  fn();
                };
                return (
                  <>
                    <button role="menuitem" className="btn ghost sm" onClick={run(onAddTexts)}>
                      Write more texts into it
                    </button>
                    <button role="menuitem" className="btn ghost sm" onClick={run(() => onOrder(true))} disabled={list.length < 2}>
                      Reorder
                    </button>
                    <button
                      role="menuitem"
                      className="btn ghost sm"
                      onClick={run(() => {
                        const name = prompt('Name this collection', set.name);
                        if (name?.trim()) renameSet(set.id, name.trim());
                      })}
                    >
                      Rename
                    </button>
                    <button
                      role="menuitem"
                      className="btn ghost sm"
                      onClick={run(() => list.forEach((t) => setTextRead(t.id, unread > 0)))}
                    >
                      {unread ? 'Mark all read' : 'Mark all unread'}
                    </button>
                    <Link role="menuitem" className="btn ghost sm" to={paths.reading(set.id, { mode: 'all' })}>
                      Read all on one page
                    </Link>
                    <button role="menuitem" className="btn ghost sm" disabled={pdf.busy !== null} onClick={run(print)}>
                      Print as PDF
                    </button>
                    <button role="menuitem" className="btn ghost sm" onClick={run(exportJson)}>
                      Export as JSON
                    </button>
                    <button
                      role="menuitem"
                      className="btn ghost sm danger"
                      onClick={run(() => {
                        if (confirm(`Delete “${set.name}” and its ${list.length} texts?`)) deleteSet(set.id);
                      })}
                    >
                      Delete
                    </button>
                  </>
                );
              }}
            </Menu>
            <Link className="btn sm primary" to={paths.reading(set.id, { page: firstUnread + 1 })}>
              {list.some((t) => t.read) && unread ? 'Carry on reading →' : 'Read →'}
            </Link>
          </>
        )}
      </div>
      <div className="tpl-grid">
        {list.map((t, i) => (
          <div key={t.id} className="order-slot">
            <TextCard
              text={t}
              to={paths.reading(set.id, { page: i + 1 })}
              picked={picked ? picked.has(t.id) : null}
              onPick={() => onPick([t.id])}
              number={ordering ? i + 1 : undefined}
            />
            {ordering && (
              <div className="order-moves">
                <button className="btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Earlier">
                  ‹ Earlier
                </button>
                <button className="btn sm" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Later">
                  Later ›
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PickBox({
  ids,
  picked,
  onPick,
  label,
}: {
  ids: string[];
  picked: Set<string>;
  onPick: (ids: string[]) => void;
  label: string;
}) {
  const n = ids.filter((id) => picked.has(id)).length;
  return (
    <input
      type="checkbox"
      className="pick-box"
      aria-label={label}
      checked={n === ids.length}
      ref={(el) => {
        if (el) el.indeterminate = n > 0 && n < ids.length;
      }}
      onChange={() => onPick(ids)}
    />
  );
}

/**
 * Gathering the picked texts into one collection — a new one by name, or one
 * that already exists. Collections the move empties go with it: that is what
 * merging two collections means.
 */
function MergeDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (set: TextSet) => void }) {
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const from = useMemo(() => {
    const mine = new Set(ids);
    return sets.filter((s) => texts.some((t) => t.setId === s.id && mine.has(t.id)));
  }, [ids, sets, texts]);
  const [into, setInto] = useState<string>('new');
  const [name, setName] = useState(() => (from.length > 1 ? from.map((s) => s.name).join(' + ') : 'New collection'));

  const emptied = from.filter(
    (s) => s.id !== into && texts.filter((t) => t.setId === s.id).every((t) => ids.includes(t.id)),
  );

  function confirmMerge() {
    const set = collectTexts(ids, into === 'new' ? { name } : { setId: into });
    if (set) onDone(set);
  }

  return (
    <Modal
      title={`Merge ${ids.length} text${ids.length === 1 ? '' : 's'}`}
      subtitle="Into one collection, in the order they are on the shelf."
      onClose={onClose}
      onConfirm={confirmMerge}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={confirmMerge} disabled={into === 'new' && !name.trim()}>
            Merge
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          Into
          <select value={into} onChange={(e) => setInto(e.target.value)}>
            <option value="new">A new collection</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                “{s.name}”
              </option>
            ))}
          </select>
        </label>
        {into === 'new' && (
          <label className="field">
            Name
            <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        {emptied.length > 0 && (
          <p className="tiny muted" style={{ margin: 0 }}>
            {emptied.map((s) => `“${s.name}”`).join(', ')} will be empty afterwards, and {emptied.length === 1 ? 'goes' : 'go'}.
          </p>
        )}
      </div>
    </Modal>
  );
}

function TextCard({
  text,
  to,
  picked,
  onPick,
  number,
}: {
  text: GeneratedText;
  to: string;
  /** null when the shelf is not being picked from */
  picked: boolean | null;
  onPick: () => void;
  number?: number;
}) {
  const lib = useLibrary();
  const cover = coverageOf(text, new Set(text.basis));
  const body = (
    <>
      <div className="row" style={{ gap: 8 }}>
        {number !== undefined && <span className="order-n">{number}</span>}
        <span className="name hanzi">{text.titleZh || text.title}</span>
        <div className="spacer" />
        {text.read && <span className="badge done">read</span>}
        {picked !== null && (
          <span className="pick-mark" aria-hidden>
            {picked ? '✓' : ''}
          </span>
        )}
      </div>
      <p className="small" style={{ margin: '2px 0 6px' }}>
        {text.title}
      </p>
      <p className="passage-peek hanzi">{text.lines[0]?.zh}</p>

      {text.teach.length > 0 && (
        <div className="teach-chips">
          {text.teach.slice(0, 8).map((c) => (
            <span key={c} className="teach-chip mini">
              <Glyph char={c} strokes={lib.strokes} size={20} />
            </span>
          ))}
          {text.teach.length > 8 && <span className="tiny muted">+{text.teach.length - 8}</span>}
        </div>
      )}

      <div className="row tiny muted" style={{ gap: 6 }}>
        <span>{levelLabel(text.level)}</span>
        <span>·</span>
        <span>{textCharCount(text)} characters</span>
        <div className="spacer" />
        <span>{Math.round(cover.ratio * 100)}% known</span>
      </div>
    </>
  );

  if (picked !== null) {
    return (
      <button className="tpl-card text-card pickable" aria-pressed={picked} onClick={onPick}>
        {body}
      </button>
    );
  }
  return (
    <Link className="tpl-card text-card" to={to}>
      {body}
    </Link>
  );
}
