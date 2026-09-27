import { useState } from 'react';
import { ChoiceGame } from '../kit/ChoiceGame';
import { gist } from '../kit/pool';
import { Photo } from '../kit/Photo';
import type { GameProps } from '../types';
import { buildCompound, itemsOf } from './content';
import './game.css';

/** 火 fire + 车 car = ? Pick the photo of the word they make. */
export default function CompoundGame({ ctx, report, finish }: GameProps) {
  const [rounds] = useState(() =>
    buildCompound(ctx).map((r) => ({
      ...r,
      options: r.options.map((o) => ({ ...o, label: `photo ${o.id}`, body: <Photo word={o.id} /> })),
    })),
  );
  return (
    <ChoiceGame
      rounds={rounds}
      props={{ report, finish }}
      describe={(r) => ({ prompt: r.parts.map((p) => p.gloss).join(' + '), answer: r.word.w, items: itemsOf(r) })}
      say={(r) => r.word.w}
      stage={(r, s) => (
        <div className="g-sum">
          {r.parts.map((p, i) => (
            <div key={i} className="g-sum-part">
              {i > 0 && <span className="g-sum-op">+</span>}
              <figure>
                <span className="g-photo">
                  <img src={p.picture!.src} alt="" data-ready draggable={false} />
                </span>
                <figcaption>
                  <span className="hanzi">{p.ch}</span>
                  <span className="tiny muted">{p.gloss}</span>
                </figcaption>
              </figure>
            </div>
          ))}
          <div className="g-sum-part">
            <span className="g-sum-op">=</span>
            <figure>
              <span className="g-sum-q hanzi">{s.done ? r.word.w : '？'}</span>
              <figcaption>
                <span className="tiny muted">{s.done ? `${r.word.py} · ${gist(r.word.d)}` : ' '}</span>
              </figcaption>
            </figure>
          </div>
        </div>
      )}
      answer={(r) => (
        <>
          <span className="hanzi">{r.word.w}</span> {r.word.py} — {gist(r.word.d)}
        </>
      )}
    />
  );
}
