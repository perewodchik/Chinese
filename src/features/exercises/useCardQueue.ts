import { useCallback, useState } from 'react';
import type { Exercise } from '../../domain/exercises/generate';
import { requeueAt } from '../../domain/grading';

export interface Card {
  /** unique within the sitting; the component's key */
  key: string;
  ex: Exercise;
  /** a card put back after a miss */
  again?: boolean;
}

/**
 * A run of cards that can grow as it goes: a missed card sends a fresh one
 * for the same item a few places on, so it is met again while the answer is
 * warm. Shared by the lesson and the daily session.
 */
export function useCardQueue(initial: Card[]) {
  const [cards, setCards] = useState(initial);
  const [at, setAt] = useState(0);

  const next = useCallback(() => setAt((a) => a + 1), []);

  /** Put `card` back into the run, `gap` cards after the one on screen. */
  const insert = useCallback(
    (card: Card, gap = 3) =>
      setCards((cs) => {
        const out = [...cs];
        out.splice(requeueAt(at, cs.length, gap), 0, card);
        return out;
      }),
    [at],
  );

  const replace = useCallback((list: Card[]) => {
    setCards(list);
    setAt(0);
  }, []);

  return { card: cards[at] as Card | undefined, at, total: cards.length, cards, next, insert, replace };
}
