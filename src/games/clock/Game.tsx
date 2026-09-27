import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import type { GameProps } from '../types';
import { Clock } from './Clock';
import { buildClock, itemsOf, sayPy } from './content';
import './game.css';

/** A clock; which of four is the time on it? */
export default function ClockGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildClock(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({ ...o, body: <span className="hanzi g-clock-say">{o.label}</span> })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      describe={(r) => ({ prompt: 'the clock', answer: r.right, items: itemsOf(r) })}
      say={(r) => r.right}
      stage={(r, s) => (
        <div className="g-clock-stage">
          <p className="g-prompt small muted">几点了？ What time is it?</p>
          <Clock time={r.time} part={r.withPart} />
          <div className="g-ask-py">{s.done ? sayPy(r.time, r.withPart) : ' '}</div>
        </div>
      )}
    />
  );
}
