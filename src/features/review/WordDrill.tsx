import { useEffect, useMemo, useRef, useState } from 'react';
import { questionFor } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import { wordFor } from '../../domain/vocab';
import { say } from '../../platform/audio/voiceOut';
import { Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, RatingRow, useDrillRun, useRevealKeys } from './DrillFrame';

interface Props {
  ids: ItemId[];
  /** the characters you can already read, which decides what words may be used */
  known: ReadonlySet<string>;
  onExit: () => void;
}

/**
 * The same character, met inside a word.
 *
 * Recognising 好 on its own and reading 好看 at speed are not the same skill,
 * and the second is the one that makes a page of Chinese go by. So the
 * stimulus here is a word — with the character in question the only part of it
 * you might not have met in company before — and what gets graded is the
 * character, under `use`.
 *
 * Every word shown is one whose other characters you already have. A word
 * where two parts are unfamiliar teaches neither.
 */
export function WordDrill({ ids, known, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'use');
  const [shown, setShown] = useState(false);
  const used = useRef(new Set<string>());
  const skipped = useRef<ItemId | null>(null);

  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);
  // A fresh word where there is one; the same word again rather than no
  // question at all when this sitting has used them up.
  const word = useMemo(
    () => (q ? (wordFor(lib, q.char, known, used.current) ?? wordFor(lib, q.char, known)) : null),
    [lib, q, known],
  );

  useEffect(() => {
    setShown(false);
    if (word) used.current.add(word.w);
  }, [run.id, word]);

  // A character with nothing readable to sit inside is not a question yet,
  // so it is passed over without a grade — nothing was asked, and a pass
  // recorded here would push it back for a question never put. Once only: an
  // effect can run twice, and a second skip would pass the next one over too.
  useEffect(() => {
    if (!run.id || word || skipped.current === run.id) return;
    skipped.current = run.id;
    run.skip();
  }, [run.id, word, run]);

  useRevealKeys(Boolean(run.id && word), shown, () => setShown(true), run.answer);

  if (!run.id || !q) {
    return (
      <DrillFrame title="In a word" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="use" onExit={onExit} />
      </DrillFrame>
    );
  }

  if (!word) return null;

  return (
    <DrillFrame
      title="In a word"
      hint="Read the whole word. What does it mean, and how is it said?"
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <div className="prompt-card">
        <div className="word-prompt">
          {word.chars.map((c, i) => (
            <span key={i} data-target={c === q.char || undefined}>
              <Glyph char={c} strokes={lib.strokes} size={92} />
            </span>
          ))}
        </div>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          {shown ? `the one underlined is ${q.py} — ${q.gloss}` : 'What does this word mean?'}
        </p>
      </div>

      {shown ? (
        <div className="answer-card">
          <div className="reading">
            {word.p}
            <Say text={word.w} />
          </div>
          <div className="gloss">{word.d}</div>
          {word.hsk && <span className="tiny muted">HSK {word.hsk}</span>}
        </div>
      ) : (
        <button
          className="btn primary reveal"
          onClick={() => {
            setShown(true);
            void say(word.w);
          }}
        >
          Show me<span className="key-hint"> — space</span>
        </button>
      )}

      {shown && <RatingRow onRate={run.answer} />}
    </DrillFrame>
  );
}
