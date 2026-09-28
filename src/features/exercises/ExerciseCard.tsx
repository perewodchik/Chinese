import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '../../domain/exercises/generate';
import { selfRating } from '../../domain/grading';
import { RATING_META, RATINGS, type Rating } from '../../domain/memory';
import { dropPending, say } from '../../platform/audio/voiceOut';
import { useStore } from '../../store/store';
import { Say } from '../../ui/Say';
import { WritePad } from '../review/WritePad';
import { MatchCard } from './MatchCard';
import { useClock, useKeys, type ExerciseResult } from './parts';
import { PickCard, SwipeCard } from './PickCard';
import { SpeakCard } from './SpeakCard';
import { TilesCard } from './TilesCard';
import { TonesCard } from './TonesCard';
import { TypeCard } from './TypeCard';
import '../review/session.css';
import './exercises.css';

/**
 * Any exercise, drawn. The host gives it a fresh `key` per card and is told
 * how each item fared; turning that into grades is the host's business.
 *
 * `first` says the item has never been answered for this skill, which only
 * the self-graded card needs to know (a first answer is never "easy").
 * `onSkip` is offered by cards that can be declined — speaking.
 */
export function ExerciseCard({
  ex,
  first = false,
  onDone,
  onSkip,
}: {
  ex: Exercise;
  first?: boolean;
  onDone: (results: ExerciseResult[]) => void;
  onSkip?: () => void;
}) {
  // A word this card asked for that has not arrived by the time the card
  // goes would be heard over the next one.
  useEffect(() => dropPending, []);
  switch (ex.kind) {
    case 'pick-meaning':
    case 'pick-hanzi':
    case 'pick-picture':
    case 'pick-listen':
    case 'pick-measure':
    case 'pick-cloze':
    case 'pick-which':
      return <PickCard ex={ex} onDone={onDone} />;
    case 'swipe':
      return <SwipeCard ex={ex} onDone={onDone} />;
    case 'tiles-word':
    case 'tiles-sentence':
    case 'tiles-listen':
    case 'tiles-reverse':
    case 'tiles-parts':
      return <TilesCard ex={ex} onDone={onDone} />;
    case 'tones':
      return <TonesCard ex={ex} onDone={onDone} />;
    case 'type-pinyin':
    case 'type-hanzi':
    case 'type-meaning':
    case 'type-dictation':
      return <TypeCard ex={ex} onDone={onDone} />;
    case 'match':
      return <MatchCard ex={ex} onDone={onDone} />;
    case 'speak':
      return <SpeakCard ex={ex} onDone={onDone} onSkip={onSkip} />;
    case 'recall':
      return <RecallCard ex={ex} first={first} onDone={onDone} />;
    case 'write':
      return (
        <div className="ex-card" data-kind="write">
          <p className="ex-ask">{ex.ask}</p>
          <WritePad
            char={ex.char}
            py={ex.py}
            gloss={ex.gloss}
            onDone={(rating) =>
              onDone([{ id: ex.ids[0]!, skill: ex.skill, ok: rating !== 'again', misses: 0, ms: 0, tier: ex.tier, weight: ex.weight, rating }])
            }
          />
        </div>
      );
  }
}

type RecallExercise = Extract<Exercise, { kind: 'recall' }>;

/**
 * The plain question: the item on its own, a pause, the answer, and how it
 * went — Forgot / Got it, with the time taken to think deciding how well, or
 * the four buttons for whoever asked for them.
 */
function RecallCard({ ex, first, onDone }: { ex: RecallExercise; first: boolean; onDone: (r: ExerciseResult[]) => void }) {
  const four = useStore((s) => s.settings.fourButtons);
  const [shown, setShown] = useState(false);
  const clock = useClock();
  const think = useRef(0);

  function show() {
    if (shown) return;
    think.current = clock();
    setShown(true);
    void say(ex.text);
  }

  function rate(rating: Rating) {
    onDone([{ id: ex.ids[0]!, skill: ex.skill, ok: rating !== 'again', misses: rating === 'again' ? 1 : 0, ms: think.current, tier: ex.tier, weight: ex.weight, rating }]);
  }
  const got = (yes: boolean) => rate(selfRating(yes, think.current, first));

  useKeys((e) => {
    if (!shown) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        show();
      }
      return;
    }
    if (four) {
      const r = RATINGS[Number(e.key) - 1];
      if (r) rate(r);
    } else if (e.key === '1') got(false);
    else if (e.key === '2' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      got(true);
    }
  });

  return (
    <div className="ex-card" data-kind="recall">
      <p className="ex-ask">{ex.ask}</p>
      <div className="ex-prompt">
        <span className="ex-hanzi hanzi" lang="zh-CN" data-len={Math.min(8, [...ex.text].length)}>
          {ex.text}
        </span>
      </div>
      <div className="ex-recall-answer" data-shown={shown || undefined}>
        {shown ? (
          <>
            <span className="ex-py">
              {ex.py} <Say text={ex.text} />
            </span>
            <span className="ex-en">{ex.gloss}</span>
            {ex.example && (
              <span className="ex-example">
                <span className="hanzi">{ex.example.zh}</span>
                <span className="tiny muted">{ex.example.en}</span>
              </span>
            )}
          </>
        ) : (
          <button type="button" className="btn primary reveal" onClick={show}>
            Show me<span className="key-hint"> — space</span>
          </button>
        )}
      </div>
      {shown &&
        (four ? (
          <div className="rating-row">
            {RATINGS.map((r, i) => (
              <button key={r} type="button" className={`rate ${r}`} onClick={() => rate(r)}>
                <b>{RATING_META[r].label}</b>
                <span>{RATING_META[r].hint}</span>
                <i>{i + 1}</i>
              </button>
            ))}
          </div>
        ) : (
          <div className="rating-row two">
            <button type="button" className="rate again" onClick={() => got(false)}>
              <b>Forgot</b>
              <span>Ask me again soon</span>
              <i>1</i>
            </button>
            <button type="button" className="rate good" onClick={() => got(true)}>
              <b>Got it</b>
              <span>How quickly decides when it comes back</span>
              <i>2</i>
            </button>
          </div>
        ))}
    </div>
  );
}
