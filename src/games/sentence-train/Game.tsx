import { useState } from 'react';
import { say } from '../../platform/audio/voiceOut';
import { Feedback } from '../kit/Feedback';
import { useRounds } from '../kit/useRounds';
import type { GameProps } from '../types';
import { buildTrains, itemsOf, type TrainRound } from './content';
import './game.css';

/** The English, and the words as loose cars: couple them in order. */
export default function TrainGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() => buildTrains(ctx));
  const r = useRounds<TrainRound>(rounds, { report, finish }, (round) => ({
    prompt: round.en,
    answer: round.zh,
    items: itemsOf(round),
  }));
  // Heard only when a native speaker recorded the sentence: the app never
  // teaches a sentence in a synthetic voice.
  return <Round key={r.index} round={r.round} r={r} native={ctx.native.has(r.round.zh)} />;
}

function Round({
  round,
  r,
  native,
}: {
  round: TrainRound;
  r: ReturnType<typeof useRounds<TrainRound>>;
  native: boolean;
}) {
  // cars by their index in `shuffled`, so the same word twice is two cars
  const [train, setTrain] = useState<number[]>([]);
  const couple = (i: number) => {
    if (r.done || train.includes(i)) return;
    const next = [...train, i];
    setTrain(next);
    if (next.length === round.shuffled.length) {
      const ok = next.map((k) => round.shuffled[k]).join('') === round.cars.join('');
      if (ok && native) void say(round.zh);
      r.answer(ok);
      if (!ok) window.setTimeout(() => setTrain([]), 900);
    }
  };
  const cars = r.status === 'shown' ? round.cars.map((c) => c) : train.map((k) => round.shuffled[k]);
  return (
    <div className="g-train">
      <p className="g-train-en">“{round.en}”</p>
      <div className="g-rails" data-state={r.status}>
        <span className="g-engine" aria-hidden>
          <svg viewBox="0 0 64 48">
            <path d="M6 40V16h22V6h14v10h10l8 12v12z" />
            <circle cx="16" cy="42" r="5" />
            <circle cx="46" cy="42" r="5" />
          </svg>
        </span>
        {cars.map((c, i) => (
          <button
            key={i}
            type="button"
            className="g-car hanzi"
            disabled={r.done}
            onClick={() => setTrain(train.filter((_, j) => j !== i))}
            aria-label={`uncouple ${c}`}
          >
            {c}
          </button>
        ))}
        {Array.from({ length: round.shuffled.length - cars.length }, (_, i) => (
          <span key={`e${i}`} className="g-car g-car-empty" aria-hidden />
        ))}
        <span className="g-car-end hanzi">{round.end}</span>
      </div>
      <div className="g-ask-py">{r.done ? round.py : ' '}</div>
      <div className="g-yard">
        {round.shuffled.map((c, i) => (
          <button
            key={i}
            type="button"
            className="g-car hanzi"
            disabled={r.done || train.includes(i)}
            onClick={() => couple(i)}
          >
            {c}
          </button>
        ))}
      </div>
      <Feedback r={r} answer={<span className="hanzi">{round.zh}</span>}>
        {r.status === 'wrong' && <span className="tiny muted">The cars go back; couple them again.</span>}
      </Feedback>
    </div>
  );
}
