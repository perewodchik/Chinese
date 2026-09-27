import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps, RoundResult } from '../types';

/**
 * The life of a round, the same in every game.
 *
 *   asking → right           (reported; next one after a moment)
 *   asking → wrong → asking  (one more try; the wrong pick stays marked)
 *   asking → wrong → shown   (reported as missed; the answer is shown, Next moves on)
 *
 * Two tries, because a child's game that ends a prompt on the first slip
 * teaches guessing; three would make the second guess free. A game says what
 * each prompt is about with `describe`, and whether an answer was right with
 * `answer(ok)`; everything else is here.
 */

export type RoundStatus = 'asking' | 'wrong' | 'right' | 'shown';

export interface Rounds<T> {
  round: T;
  index: number;
  total: number;
  status: RoundStatus;
  /** wrong answers given on this prompt so far */
  misses: number;
  /** true once the prompt is settled, either way */
  done: boolean;
  answer(ok: boolean): void;
  next(): void;
}

const RIGHT_PAUSE = 900;

export function useRounds<T>(
  rounds: T[],
  props: Pick<GameProps, 'report' | 'finish'>,
  describe: (round: T) => Omit<RoundResult, 'correct' | 'firstTry'>,
  opts: { tries?: number } = {},
): Rounds<T> {
  const tries = opts.tries ?? 2;
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<RoundStatus>('asking');
  const [misses, setMisses] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const next = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (index + 1 >= rounds.length) {
      props.finish();
      return;
    }
    setIndex(index + 1);
    setStatus('asking');
    setMisses(0);
  }, [index, rounds.length, props]);

  const answer = useCallback(
    (ok: boolean) => {
      if (status === 'right' || status === 'shown') return;
      const round = rounds[index];
      if (ok) {
        setStatus('right');
        props.report({ ...describe(round), correct: true, firstTry: misses === 0 });
        timer.current = window.setTimeout(next, RIGHT_PAUSE);
        return;
      }
      const m = misses + 1;
      setMisses(m);
      if (m >= tries) {
        setStatus('shown');
        props.report({ ...describe(round), correct: false, firstTry: false });
      } else {
        setStatus('wrong');
      }
    },
    [status, rounds, index, misses, tries, props, describe, next],
  );

  return {
    round: rounds[index],
    index,
    total: rounds.length,
    status,
    misses,
    done: status === 'right' || status === 'shown',
    answer,
    next,
  };
}
