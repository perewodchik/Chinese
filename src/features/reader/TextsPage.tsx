import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { charId } from '../../domain/ids';
import { planSession } from '../../domain/session';
import type { BasisSource } from '../../domain/teach';
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
import { newId } from '../../platform/ids';
import { deleteSet, discardPlan, renameSet, startPlan } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { usePdfExport } from '../shared/usePdfExport';
import { readerSheet } from './readerSheet';

const dateName = () =>
  `Reading, ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;

/**
 * Everything Claude has written for you, in the sessions you asked for it.
 *
 * This is the other half of the app: the squares are where a character goes
 * in, and a passage is where it comes back out. A session is the unit that
 * matters — five passages planned together, printed together, and read over a
 * week — which is why the shelf is organised by session rather than by date.
 */
export function TextsPage() {
  useTitle('Texts');
  const lib = useLibrary();
  const navigate = useNavigate();
  const pdf = usePdfExport();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const plan = useStore((s) => s.plan);
  const learned = useStore((s) => s.learned);
  const settings = useStore((s) => s.settings);

  const learnedCount = useMemo(
    () => lib.characters.filter((c) => learned.has(charId(c.c))).length,
    [lib, learned],
  );
  const { bySet, loose } = useMemo(() => shelve(texts, sets), [texts, sets]);

  function startSession(setId: string | null, name?: string) {
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
        basisSource: settings.basisSource as BasisSource,
        basisCount: settings.basisCount,
      }),
    );
    navigate(paths.session('plan'));
  }

  function printSet(set: TextSet, list: GeneratedText[]) {
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

  return (
    <section>
      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <h1>Texts</h1>
          <p className="small muted" style={{ margin: 0 }}>
            Reading written around what you know — {learnedCount} characters marked learned, {texts.length}{' '}
            passage{texts.length === 1 ? '' : 's'} on the shelf.
          </p>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => startSession(null)}>
          + New writing session
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

      {texts.length === 0 ? (
        <div className="empty">
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
            const unread = list.filter((t) => !t.read).length;
            const taught = new Set(list.flatMap((t) => t.teach));
            const firstUnread = list.find((t) => !t.read) ?? list[0];
            return (
              <section key={set.id}>
                <div className="set-bar">
                  <div style={{ minWidth: 0 }}>
                    <h2 className="set-name">{set.name}</h2>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      {new Date(set.createdAt).toLocaleDateString()} · {list.length} texts · {taught.size} new
                      characters · {unread ? `${unread} still to read` : 'all read'}
                    </p>
                  </div>
                  <div className="spacer" />
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      const name = prompt('Name this set', set.name);
                      if (name?.trim()) renameSet(set.id, name.trim());
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className="btn ghost sm"
                    onClick={() => {
                      if (confirm(`Delete “${set.name}” and its ${list.length} texts?`)) deleteSet(set.id);
                    }}
                  >
                    Delete
                  </button>
                  <button className="btn sm" onClick={() => startSession(set.id, set.name)}>
                    + Add texts
                  </button>
                  <button className="btn sm" disabled={pdf.busy === set.id} onClick={() => printSet(set, list)}>
                    {pdf.busy === set.id ? 'Building…' : 'Print the session'}
                  </button>
                  <Link className="btn sm primary" to={paths.text(firstUnread.id)}>
                    {list.some((t) => t.read) && unread ? 'Carry on reading →' : 'Read →'}
                  </Link>
                </div>
                <div className="tpl-grid">
                  {list.map((t) => (
                    <TextCard key={t.id} text={t} />
                  ))}
                </div>
              </section>
            );
          })}

          {loose.length > 0 && (
            <section>
              <div className="set-bar">
                <div>
                  <h2 className="set-name">Loose texts</h2>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Written before sessions existed, or left over from a deleted one.
                  </p>
                </div>
              </div>
              <div className="tpl-grid">
                {loose.map((t) => (
                  <TextCard key={t.id} text={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function TextCard({ text }: { text: GeneratedText }) {
  const lib = useLibrary();
  const cover = coverageOf(text, new Set(text.basis));
  return (
    <Link className="tpl-card text-card" to={paths.text(text.id)}>
      <div className="row" style={{ gap: 8 }}>
        <span className="name hanzi">{text.titleZh || text.title}</span>
        <div className="spacer" />
        {text.read && <span className="badge done">read</span>}
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
    </Link>
  );
}
