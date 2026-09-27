import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { idValue, type ItemId } from '../../domain/ids';
import type { PrintedSheet, Rating } from '../../domain/memory';
import { paths } from '../../navigation/paths';
import { discardSheet, gradeSheet } from '../../store/commands';
import { useStore } from '../../store/store';
import { Glyph } from '../../ui/Glyph';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';

/** Three answers, because a fourth would slow down a page of twenty. */
const MARKS: Array<{ rating: Rating; glyph: string; label: string }> = [
  { rating: 'good', glyph: '✓', label: 'Wrote it' },
  { rating: 'hard', glyph: '~', label: 'Nearly — a stroke wrong, or it took a while' },
  { rating: 'again', glyph: '✗', label: 'Could not' },
];

/** A printed test sheet waiting to be marked, at /review/sheets/:sheetId. */
export function GradeSheetPage() {
  const { sheetId } = useParams();
  const sheet = useStore((s) => s.sheets.find((x) => x.id === sheetId && x.gradedAt === null) ?? null);
  if (!sheet) return <NoSheet />;
  return <GradeSheet key={sheet.id} sheet={sheet} />;
}

function NoSheet() {
  useTitle('Sheet not found');
  return (
    <div className="empty">
      <span className="big">纸</span>
      <p>That sheet has been marked already, or thrown away — here or on another device.</p>
      <Link className="btn" to={paths.review()}>
        Back to Review
      </Link>
    </div>
  );
}

/**
 * Marking a sheet you have written by hand.
 *
 * This is where the loop finally closes. Every other part of the app can watch
 * you work; the one thing it cares most about — whether you can produce a
 * character on blank paper — happens at a table with a pen, and the only way
 * back in is for you to tell it. So the marking is made as cheap as it can be:
 * one tap a card, against the same numbers that are on the paper in front of
 * you.
 *
 * Only characters you have learned are here. A sheet printed before tests
 * were limited to them can hold a whole band, and asking whether you wrote a
 * character you never studied is not a question; those lines are left out,
 * and the rest keep their printed numbers so they still match the paper.
 *
 * The meaning is hidden until asked for — the character is the answer, and a
 * glance at the meaning is for the one you half recognise.
 *
 * Lines left unmarked are left alone rather than counted as failures. A sheet
 * you got halfway through is not evidence about the half you never reached.
 */
function GradeSheet({ sheet }: { sheet: PrintedSheet }) {
  useTitle(`Marking ${sheet.name}`);
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const learned = useStore((s) => s.learned);
  const [marks, setMarks] = useState<Record<ItemId, Rating>>({});
  const [shown, setShown] = useState<ReadonlySet<ItemId>>(new Set());
  const [allShown, setAllShown] = useState(false);
  const done = Object.keys(marks).length;

  // Fixed when the page opens: a card must not vanish because marking it
  // "could not" took it below the line for learned.
  const [lines] = useState(() =>
    sheet.items.map((id, i) => ({ id, n: i + 1 })).filter((l) => learned.has(l.id)),
  );
  const left = sheet.items.length - lines.length;

  function save() {
    const results = lines.filter((l) => marks[l.id]).map((l) => ({ id: l.id, rating: marks[l.id]! }));
    const missed = results.filter((r) => r.rating === 'again').length;
    // Off this page first: once the sheet is marked there is nothing here to show.
    navigate(paths.review(), { replace: true, flushSync: true });
    gradeSheet(sheet.id, results);
    toast(`Marked ${results.length} — ${missed} to come back sooner.`);
  }

  function throwAway() {
    if (!confirm('Throw this sheet away unmarked?')) return;
    navigate(paths.review(), { replace: true, flushSync: true });
    discardSheet(sheet.id);
  }

  const toggleShown = (id: ItemId) =>
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="drill">
      <div className="drill-head">
        <Link className="btn ghost sm" to={paths.review()}>
          ← Later
        </Link>
        <div style={{ minWidth: 0 }}>
          <b>{sheet.name}</b>
          <div className="tiny muted">
            Printed {new Date(sheet.printedAt).toLocaleDateString()} · {lines.length} you have learned
            {left > 0 && <> · {left} not learned yet left out</>} · the numbers match the sheet
          </div>
        </div>
        <div className="spacer" />
        <button className="chip" aria-pressed={allShown} onClick={() => setAllShown((v) => !v)}>
          Meanings
        </button>
        <button
          className="btn ghost sm"
          disabled={!lines.length}
          onClick={() => {
            const all: Record<ItemId, Rating> = {};
            for (const l of lines) all[l.id] = marks[l.id] ?? 'good';
            setMarks(all);
          }}
        >
          Mark the rest right
        </button>
        <button className="btn primary" onClick={save} disabled={!done}>
          Save {done ? `${done} mark${done === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      {lines.length ? (
        <div className="mark-cards">
          {lines.map(({ id, n }) => {
            // A word is marked whole, the way it was asked for on the sheet.
            const char = idValue(id);
            const glyphs = [...char];
            const e = glyphs.length === 1 ? lib.byChar.get(char) : undefined;
            const w = e ? undefined : lib.byWord.get(char);
            const open = allShown || shown.has(id);
            return (
              <div key={id} className="mark-card" data-marked={marks[id] ?? undefined}>
                <div className="mark-card-top">
                  <span className="n">{String(n).padStart(2, '0')}</span>
                  <button
                    className="mark-peek"
                    aria-pressed={open}
                    aria-label={open ? `Hide the meaning of ${char}` : `Show the meaning of ${char}`}
                    onClick={() => toggleShown(id)}
                    disabled={allShown}
                  >
                    {open ? 'Hide' : 'Meaning'}
                  </button>
                </div>
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  {glyphs.map((g, i) => (
                    <Glyph key={i} char={g} strokes={lib.strokes} size={glyphs.length > 2 ? 32 : glyphs.length > 1 ? 40 : 48} />
                  ))}
                </span>
                <div className="mark-card-meaning" data-open={open || undefined}>
                  {open ? (
                    <>
                      <b>{e?.py[0] ?? w?.py ?? ''}</b>
                      <i>{e?.def ?? w?.d ?? ''}</i>
                    </>
                  ) : (
                    <span aria-hidden>· · ·</span>
                  )}
                </div>
                <span className="marks-row">
                  {MARKS.map((m) => (
                    <button
                      key={m.rating}
                      className={`mark ${m.rating}`}
                      aria-pressed={marks[id] === m.rating}
                      title={m.label}
                      aria-label={`${char}: ${m.label}`}
                      onClick={() =>
                        setMarks((prev) => {
                          const next = { ...prev };
                          if (next[id] === m.rating) delete next[id];
                          else next[id] = m.rating;
                          return next;
                        })
                      }
                    >
                      {m.glyph}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <span className="big">纸</span>
          <p>Nothing on this sheet is learned yet, so there is nothing to mark.</p>
          <p className="small">Throw it away, and print a new test once you have learned some of these.</p>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', paddingBottom: 30 }}>
        <button className="btn danger sm" onClick={throwAway}>
          Throw it away
        </button>
      </div>
    </section>
  );
}
