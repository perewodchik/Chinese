import { useEffect, useMemo, useRef, useState } from "react";
import { alignPinyin } from "../../domain/reading";
import { segment, writerHints } from "../../domain/segment";
import { matchStroke, medianPoints, type Pt } from "../../domain/stroke";
import { isHanzi, type GeneratedText } from "../../domain/text";
import { studyText } from "../../store/commands";
import { Icon } from "../../ui/Icon";
import { StrokeCanvas } from "../../ui/StrokeCanvas";
import { useLibrary } from "../shared/library";

/**
 * Copying the text out, a piece at a time: the word (or the character) to
 * write now, large, with its reading; what comes after it in small, the
 * punctuation included; and Next.
 *
 * Copying a text by hand is the oldest way there is of getting it into the
 * hand and the eye at once, and it is what the learner does with a book open
 * beside a notebook. On paper the app only keeps the place; on screen the
 * character can be traced over its own outline, stroke by stroke, and the
 * next one comes up as soon as it is finished.
 */

interface Unit {
  /** the characters to write: one, or a word's worth */
  text: string;
  /** their readings, one per character */
  py: string[];
  line: number;
  /** characters of the whole text before this unit, for the progress */
  before: number;
}

interface Piece {
  text: string;
  /** a piece to write, by index into the units; punctuation is not one */
  unit: number | null;
}

type By = "word" | "char";
type Where = "paper" | "screen";

function cut(
  text: GeneratedText,
  lib: ReturnType<typeof useLibrary>,
  by: By,
): { units: Unit[]; lines: Piece[][] } {
  const own = new Set(text.vocab.map((v) => v.w));
  const units: Unit[] = [];
  const lines: Piece[][] = [];
  let before = 0;
  text.lines.forEach((l, i) => {
    const py = alignPinyin(l, lib);
    let h = 0;
    const pieces: Piece[] = [];
    for (const t of segment(
      l.zh,
      lib,
      new Set([...own, ...writerHints(l.zh, l.py, lib)]),
    )) {
      const chars = [...t.text];
      if (!t.word || !chars.some(isHanzi)) {
        pieces.push({ text: t.text, unit: null });
        continue;
      }
      const groups = by === "word" ? [chars] : chars.map((c) => [c]);
      for (const g of groups) {
        const readings = g.map((c) => (isHanzi(c) ? (py[h++] ?? "") : ""));
        units.push({ text: g.join(""), py: readings, line: i, before });
        pieces.push({ text: g.join(""), unit: units.length - 1 });
        before += g.filter(isHanzi).length;
      }
    }
    lines.push(pieces);
  });
  return { units, lines };
}

export function CopyOut({
  text,
  onClose,
}: {
  text: GeneratedText;
  onClose: () => void;
}) {
  const lib = useLibrary();
  const [by, setBy] = useState<By>("word");
  const [where, setWhere] = useState<Where>("paper");
  const { units, lines } = useMemo(() => cut(text, lib, by), [text, lib, by]);
  const totalChars = useMemo(
    () => text.lines.reduce((n, l) => n + [...l.zh].filter(isHanzi).length, 0),
    [text.lines],
  );
  // Start where the last copy stopped, if it did not reach the end.
  const resumeAt =
    text.study?.copied && text.study.copied < totalChars
      ? text.study.copied
      : 0;
  const [at, setAt] = useState(() =>
    Math.max(
      0,
      units.findIndex((u) => u.before >= resumeAt),
    ),
  );
  const unit = units[Math.min(at, units.length - 1)];
  const done = at >= units.length;

  // The place is kept, as characters copied, whenever it moves on.
  useEffect(() => {
    const reached = done ? totalChars : (unit?.before ?? 0);
    if (reached > (text.study?.copied ?? 0))
      studyText(text.id, { copied: reached });
  }, [done, unit, totalChars, text.id, text.study?.copied]);

  // Switching between words and characters keeps the place in the text.
  const keep = useRef(unit?.before ?? 0);
  keep.current = unit?.before ?? keep.current;
  useEffect(() => {
    setAt(
      Math.max(
        0,
        units.findIndex((u) => u.before >= keep.current),
      ),
    );
    // Only when the cutting changes; `units` is what changes then.
  }, [units]);

  const next = () => setAt((i) => Math.min(units.length, i + 1));
  // On screen, the word moves on once every character in it has been traced, in any order.
  const [traced, setTraced] = useState<Set<number>>(new Set());
  useEffect(() => setTraced(new Set()), [at, where, by]);
  useEffect(() => {
    if (where === "screen" && unit && traced.size >= [...unit.text].length)
      next();
    // `next` is the same step every time; the count is what decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traced, where, unit]);
  const traceSize = unit
    ? ([220, 150, 100, 76][Math.min(4, [...unit.text].length) - 1] ?? 76)
    : 150;
  const back = () => setAt((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Enter or Space on a focused button is that button's, not Next.
      const onButton =
        document.activeElement instanceof HTMLButtonElement &&
        (e.key === "Enter" || e.key === " ");
      if (e.key === "Escape") onClose();
      else if (onButton) return;
      else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // What comes next, punctuation included, as it stands in the text.
  const flat = useMemo(() => lines.flat(), [lines]);
  const ahead = useMemo(() => {
    const i = flat.findIndex((p) => p.unit === at);
    return i < 0
      ? []
      : flat
          .slice(i + 1, i + 13)
          .map((p) => ({ text: p.text, punct: p.unit === null }));
  }, [flat, at]);

  return (
    <div
      className="co-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Copy out the text"
    >
      <div className="co">
        <header className="co-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
          <div className="co-progress" aria-hidden>
            <i
              style={{
                width: `${((done ? totalChars : (unit?.before ?? 0)) / Math.max(1, totalChars)) * 100}%`,
              }}
            />
          </div>
          <span className="small muted co-count">
            {done ? totalChars : (unit?.before ?? 0)} of {totalChars}
          </span>
        </header>

        {!(done || !unit) && (
          <div className="co-switches">
            <div className="seg sm" role="group" aria-label="A piece at a time">
              <button
                aria-pressed={by === "word"}
                onClick={() => setBy("word")}
              >
                By word
              </button>
              <button
                aria-pressed={by === "char"}
                onClick={() => setBy("char")}
              >
                By character
              </button>
            </div>
            <div className="seg sm" role="group" aria-label="Where you write">
              <button
                aria-pressed={where === "paper"}
                onClick={() => setWhere("paper")}
              >
                In my notebook
              </button>
              <button
                aria-pressed={where === "screen"}
                onClick={() => setWhere("screen")}
              >
                On screen
              </button>
            </div>
          </div>
        )}

        {done || !unit ? (
          <div className="co-end">
            <span className="cs-seal hanzi">好</span>
            <h2>The whole text, copied out</h2>
            <div className="row" style={{ gap: 8, justifyContent: "center" }}>
              <button className="btn" onClick={() => setAt(0)}>
                From the start again
              </button>
              <button className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="hanzi co-line">
              {lines[unit.line]!.map((p, k) => (
                <span
                  key={k}
                  data-state={
                    p.unit === null
                      ? undefined
                      : p.unit < at
                        ? "done"
                        : p.unit === at
                          ? "now"
                          : undefined
                  }
                >
                  {p.text}
                </span>
              ))}
            </p>

            <div className="co-now">
              <div
                className="co-boxes"
                data-n={Math.min(4, [...unit.text].length)}
              >
                {[...unit.text].map((c, i) => (
                  <div key={`${at}-${i}`} className="co-char">
                    <span className="co-py">{unit.py[i]}</span>
                    {where === "screen" ? (
                      <Trace
                        char={c}
                        size={traceSize}
                        onFinished={() => setTraced((t) => new Set(t).add(i))}
                      />
                    ) : (
                      <span className="co-box hanzi">{c}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="co-ahead" aria-label="Coming next">
              <span className="tiny muted">Next</span>
              <span className="hanzi co-ahead-chars">
                {ahead.map((a, k) => (
                  <span key={k} data-punct={a.punct || undefined}>
                    {a.text}
                  </span>
                ))}
              </span>
            </div>

            <div className="co-actions">
              <button
                className="btn lg"
                onClick={back}
                disabled={at === 0}
                aria-label="Back"
              >
                <Icon name="back" />
              </button>
              <button className="btn primary lg co-next" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One character traced over its own outline, stroke by stroke. A stroke out
 * of place is simply not taken; the outline stays to follow. Copying is
 * practice, not a test, so nothing here is graded.
 */
function Trace({
  char,
  size,
  onFinished,
}: {
  char: string;
  size: number;
  onFinished: () => void;
}) {
  const lib = useLibrary();
  const data = lib.strokes[char];
  const total = data?.s.length ?? 0;
  const [done, setDone] = useState(0);
  const [flash, setFlash] = useState<"ok" | "miss" | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (!total || done < total) return;
    const id = setTimeout(() => finished.current(), 450);
    return () => clearTimeout(id);
  }, [done, total]);

  if (!data?.m) return <span className="co-box hanzi">{char}</span>;

  function onStroke(pts: Pt[]) {
    if (!data?.m || done >= total) return;
    const ok = matchStroke(pts, medianPoints(data.m[done]!)).ok;
    setFlash(ok ? "ok" : "miss");
    setTimeout(() => setFlash(null), 250);
    if (ok) setDone((d) => d + 1);
  }

  return (
    <span className="co-trace">
      <StrokeCanvas
        char={char}
        strokes={lib.strokes}
        size={size}
        done={done}
        ghost
        flash={flash}
        onStroke={onStroke}
      />
    </span>
  );
}
