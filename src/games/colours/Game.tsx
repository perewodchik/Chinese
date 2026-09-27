import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import type { GameProps } from '../types';
import { buildColours, COLOURS, itemsOf, phrase } from './content';
import { Drawing } from './Drawing';
import './game.css';

/** 「红色的苹果」 — pick the paint pot, and the apple turns red. */
export default function ColoursGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildColours(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({
        ...o,
        label: 'a paint pot',
        body: <span className="g-pot" style={{ background: COLOURS.find((c) => c.w === o.id)!.hex }} />,
      })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      describe={(r) => ({ prompt: 'paint it', answer: phrase(r), items: itemsOf(r) })}
      say={(r) => phrase(r)}
      stage={(r, s) => (
        <div className="g-colours">
          <div className="g-ask">{phrase(r)}</div>
          <div className="g-ask-py">{s.done ? `${r.colour.py} de ${r.thing.py}` : 'Paint it.'}</div>
          <Drawing thing={r.thing} fill={s.done ? r.colour.hex : null} />
        </div>
      )}
      answer={(r) => (
        <>
          <span className="hanzi">{r.colour.w}</span> {r.colour.py}
        </>
      )}
    />
  );
}
