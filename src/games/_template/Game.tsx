import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import { Photo } from '../kit/Photo';
import type { GameProps } from '../types';
import { buildRounds, itemsOf } from './content';

export default function TemplateGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildRounds(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({ ...o, body: <span className="hanzi">{o.id}</span> })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      describe={(r) => ({ prompt: r.gloss, answer: r.word, items: itemsOf(r) })}
      say={(r) => r.word}
      stage={(r) => (
        <div style={{ width: 200, margin: '0 auto' }}>
          <Photo word={r.word} />
        </div>
      )}
    />
  );
}
