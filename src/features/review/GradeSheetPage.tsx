import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ItemId } from '../../domain/ids';
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
 * one click a line, in the order they were printed, against the same numbers
 * that are on the paper in front of you.
 *
 * Lines left unmarked are left alone rather than counted as failures. A sheet
 * you got halfway through is not evidence about the half you never reached.
 */
function GradeSheet({ sheet }: { sheet: PrintedSheet }) {
  useTitle(`Marking ${sheet.name}`);
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [marks, setMarks] = useState<Record<ItemId, Rating>>({});
  const done = Object.keys(marks).length;

  function save() {
    const results = sheet.items.filter((id) => marks[id]).map((id) => ({ id, rating: marks[id] }));
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

  return (
    <section className="drill">
      <div className="drill-head">
        <Link className="btn ghost sm" to={paths.review()}>
          ← Later
        </Link>
        <div style={{ minWidth: 0 }}>
          <b>{sheet.name}</b>
          <div className="tiny muted">
            Printed {new Date(sheet.printedAt).toLocaleDateString()} · {sheet.items.length} characters ·
            the numbers match the sheet
          </div>
        </div>
        <div className="spacer" />
        <button
          className="btn ghost sm"
          onClick={() => {
            const all: Record<ItemId, Rating> = {};
            for (const id of sheet.items) all[id] = marks[id] ?? 'good';
            setMarks(all);
          }}
        >
          Mark the rest right
        </button>
        <button className="btn primary" onClick={save} disabled={!done}>
          Save {done ? `${done} mark${done === 1 ? '' : 's'}` : ''}
        </button>
      </div>

      <div className="marking">
        {sheet.items.map((id, i) => {
          const char = id.slice(1);
          const e = lib.byChar.get(char);
          return (
            <div key={id} className="mark-row" data-marked={marks[id] ?? undefined}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <Glyph char={char} strokes={lib.strokes} size={34} />
              <span className="meta">
                <b>{e?.py[0] ?? ''}</b>
                <i>{e?.def ?? ''}</i>
              </span>
              <span className="marks-row">
                {MARKS.map((m) => (
                  <button
                    key={m.rating}
                    className={`mark ${m.rating}`}
                    aria-pressed={marks[id] === m.rating}
                    title={m.label}
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

      <div className="row" style={{ justifyContent: 'center', paddingBottom: 30 }}>
        <button className="btn danger sm" onClick={throwAway}>
          Throw it away
        </button>
      </div>
    </section>
  );
}
