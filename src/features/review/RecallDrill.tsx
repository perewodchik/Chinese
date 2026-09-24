import { useEffect, useMemo, useState } from 'react';
import { questionFor } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import type { Skill } from '../../domain/memory';
import { say } from '../../platform/audio/voiceOut';
import { Glyph } from '../../ui/Glyph';
import { Say } from '../../ui/Say';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, RatingRow, useDrillRun, useRevealKeys } from './DrillFrame';

interface Props {
  ids: ItemId[];
  skill: Extract<Skill, 'recognise' | 'sound'>;
  onExit: () => void;
}

const COPY = {
  recognise: {
    title: 'Recognise',
    hint: 'What does it mean? Answer before you look.',
    ask: 'What does this mean?',
  },
  sound: {
    title: 'Say it',
    hint: 'Say it out loud, tone and all, then check.',
    ask: 'How is this said?',
  },
} as const;

/**
 * The plainest drill there is: the character, a pause, then the answer, and
 * you say how it went.
 *
 * Self-rating rather than multiple choice is the point. Four wrong options on
 * screen let you arrive at the answer by elimination, which is a different and
 * much easier task than producing it from nothing — and it is the producing
 * that moves the memory. The only guard against grading yourself generously is
 * that the schedule will find you out in a fortnight.
 */
export function RecallDrill({ ids, skill, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, skill);
  const [shown, setShown] = useState(false);
  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);

  useEffect(() => setShown(false), [run.id]);

  // The reading drill is about sound, so when the answer appears it makes one.
  // Only that drill: hearing 好 while being asked what it means would give the
  // answer away half the time.
  useEffect(() => {
    if (shown && skill === 'sound' && q) void say(q.char);
  }, [shown, skill, q]);

  useRevealKeys(Boolean(run.id), shown, () => setShown(true), run.answer);

  if (!run.id || !q) {
    return (
      <DrillFrame title={COPY[skill].title} hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill={skill} onExit={onExit} />
      </DrillFrame>
    );
  }

  const words = lib.byChar.get(q.char)?.words.slice(0, 2) ?? [];

  return (
    <DrillFrame title={COPY[skill].title} hint={COPY[skill].hint} at={run.at} total={run.total} onExit={onExit}>
      <div className="prompt-card">
        <Glyph char={q.char} strokes={lib.strokes} size={168} />
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>
          {shown ? `${q.strokes} strokes` : COPY[skill].ask}
        </p>
      </div>

      {shown ? (
        <div className="answer-card">
          <div className="reading">
            {q.py}
            <Say text={q.char} />
          </div>
          <div className="gloss">{q.gloss}</div>
          {words.length > 0 && (
            <div className="answer-words">
              {words.map((w) => (
                <span key={w.w}>
                  <b className="hanzi">{w.w}</b>
                  <i>{w.p}</i>
                  <span className="tiny muted">{w.d}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button className="btn primary reveal" onClick={() => setShown(true)}>
          Show me<span className="key-hint"> — space</span>
        </button>
      )}

      {shown && <RatingRow onRate={run.answer} />}
    </DrillFrame>
  );
}
