import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import { gist } from '../kit/pool';
import type { GameProps } from '../types';
import { buildOpposites, itemsOf } from './content';
import './game.css';

/** A seesaw with 大 on one end: which word balances it? */
export default function OppositesGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildOpposites(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({
        ...o,
        body: (
          <>
            <span className="hanzi">{o.id}</span>
            <span className="g-sub">{ctx.lib.byWord.get(o.id)?.py}</span>
          </>
        ),
      })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      size="lg"
      describe={(r) => ({ prompt: `the opposite of ${r.shown.w}`, answer: r.opposite.w, items: itemsOf(r) })}
      say={(r) => r.opposite.w}
      stage={(r, s) => (
        <div className="g-seesaw" data-level={s.status === 'right' || s.status === 'shown' ? true : undefined}>
          <p className="g-prompt small muted">What is the opposite?</p>
          <div className="g-seesaw-board">
            <div className="g-seesaw-plank">
              <span className="g-seesaw-seat" data-side="left">
                <span className="hanzi">{r.shown.w}</span>
                <span className="tiny muted">{gist(r.shown.d)}</span>
              </span>
              <span className="g-seesaw-seat" data-side="right" data-empty={!s.done || undefined}>
                <span className="hanzi">{s.done ? r.opposite.w : '？'}</span>
                <span className="tiny muted">{s.done ? gist(r.opposite.d) : ' '}</span>
              </span>
            </div>
            <svg className="g-seesaw-base" viewBox="0 0 60 40" aria-hidden>
              <path d="M30 2 L56 38 H4 Z" />
            </svg>
          </div>
        </div>
      )}
    />
  );
}
