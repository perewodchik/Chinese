import { useEffect, useRef, useState } from 'react';
import { say } from '../../platform/audio/voiceOut';
import { Photo } from '../kit/Photo';
import { gist } from '../kit/pool';
import type { GameProps } from '../types';
import { buildPairs, itemsOf, type Card } from './content';

/**
 * Turn two cards; a photo and its word stay face up.
 *
 * A pair counts as found first time unless a card of it was already known —
 * both of its cards had been seen — and was still turned wrongly. Forgetting
 * where a card is, is the game; forgetting which card is the word is not.
 */
export default function PairsGame({ ctx, report, finish }: GameProps) {
  const [{ cards }] = useState(() => buildPairs(ctx));
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const seen = useRef(new Set<string>());
  const slipped = useRef(new Set<string>());
  const timer = useRef<number | null>(null);

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const turn = (c: Card) => {
    if (found.has(c.word) || open.includes(c.key) || open.length === 2) return;
    const next = [...open, c.key];
    setOpen(next);
    if (next.length < 2) {
      seen.current.add(c.key);
      return;
    }
    const [a, b] = next.map((k) => cards.find((x) => x.key === k)!);
    if (a.word === b.word) {
      const f = new Set(found).add(a.word);
      setFound(f);
      setOpen([]);
      void say(a.word);
      report({
        prompt: gist(ctx.lib.byWord.get(a.word)?.d ?? ''),
        answer: a.word,
        items: itemsOf(a.word),
        correct: true,
        firstTry: !slipped.current.has(a.word),
      });
      if (f.size * 2 === cards.length) timer.current = window.setTimeout(finish, 900);
    } else {
      // a card whose partner had already been seen should have been found
      for (const x of [a, b]) {
        const partner = cards.find((y) => y.word === x.word && y.key !== x.key)!;
        if (seen.current.has(partner.key)) slipped.current.add(x.word);
      }
      seen.current.add(c.key);
      timer.current = window.setTimeout(() => setOpen([]), 1100);
    }
  };

  return (
    <div className="g-pairs">
      <p className="g-prompt small muted">Find each photo and its word.</p>
      <div className="g-pairs-grid">
        {cards.map((c) => {
          const up = open.includes(c.key) || found.has(c.word);
          return (
            <button
              key={c.key}
              type="button"
              className="g-card"
              data-up={up || undefined}
              data-found={found.has(c.word) || undefined}
              aria-label={up ? (c.face === 'word' ? c.word : `photo of ${c.word}`) : 'face-down card'}
              onClick={() => turn(c)}
            >
              <span className="g-card-back hanzi" aria-hidden>
                玩
              </span>
              <span className="g-card-face">
                {c.face === 'picture' ? <Photo word={c.word} /> : <span className="g-card-word hanzi">{c.word}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
