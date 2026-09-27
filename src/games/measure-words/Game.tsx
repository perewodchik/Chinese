import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import { count, countPy } from '../kit/numbers';
import { Photo } from '../kit/Photo';
import type { GameProps } from '../types';
import './game.css';
import { buildMeasure, itemsOf, phrase, phrasePy, RULES, type MeasureRound } from './content';

/** A photo and 「三＿书」: which measure word goes in the gap? */
export default function MeasureGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildMeasure(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({
        ...o,
        body: (
          <>
            <span className="hanzi">{o.id}</span>
            <span className="g-sub">{RULES[o.id].py}</span>
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
      describe={(r) => ({ prompt: `${count(r.n)}＿${r.word.w}`, answer: phrase(r), items: itemsOf(r) })}
      say={(r) => phrase(r)}
      stage={(r, s) => (
        <div className="g-measure">
          <div className="g-measure-photo">
            <Photo word={r.word.w} />
          </div>
          <div className="g-ask">
            {count(r.n)}
            <span className="g-gap" data-filled={s.done || undefined}>
              {s.done ? r.right : '＿'}
            </span>
            {r.word.w}
          </div>
          <div className="g-ask-py">{s.done ? phrasePy(r) : `${countPy(r.n)} … ${r.word.py}`}</div>
          <div className="g-rule tiny muted">{s.done ? `${r.right} — ${RULES[r.right].rule}` : ' '}</div>
        </div>
      )}
      answer={(r: MeasureRound) => (
        <>
          <span className="hanzi">{phrase(r)}</span> — {RULES[r.right].rule}
        </>
      )}
    />
  );
}
