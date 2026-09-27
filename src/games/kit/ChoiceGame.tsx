import { useCallback, useState, type ReactNode } from 'react';
import { say } from '../../platform/audio/voiceOut';
import type { GameProps, RoundResult } from '../types';
import { Feedback } from './Feedback';
import { useGameKeys } from './keys';
import { Tiles, type TileOption } from './Tiles';
import { useRounds, type Rounds } from './useRounds';

/**
 * The shape most games share: something to look at, and two to six tiles to
 * pick from. A game supplies its rounds and says how to draw one; the picking,
 * the two tries, the keys, the feedback line and the report are here.
 */
export interface ChoiceRound {
  options: TileOption[];
  right: string;
}

export function ChoiceGame<R extends ChoiceRound>({
  rounds,
  props,
  describe,
  stage,
  answer,
  say: spoken,
  size,
}: {
  rounds: R[];
  props: Pick<GameProps, 'report' | 'finish'>;
  describe: (round: R) => Omit<RoundResult, 'correct' | 'firstTry'>;
  /** the prompt: a photo, a clock, a sentence */
  stage: (round: R, r: Rounds<R>) => ReactNode;
  /** shown when a prompt is missed; defaults to the right tile's label */
  answer?: (round: R) => ReactNode;
  /** said aloud once a prompt is right */
  say?: (round: R) => string | null;
  size?: 'md' | 'lg';
}) {
  const r = useRounds(rounds, props, describe);
  const [picked, setPicked] = useState<string[]>([]);
  const [at, setAt] = useState(r.index);
  if (at !== r.index) {
    setAt(r.index);
    setPicked([]);
  }
  const round = r.round;

  const pick = useCallback(
    (id: string) => {
      if (r.done || picked.includes(id)) return;
      setPicked((p) => [...p, id]);
      const ok = id === round.right;
      if (ok) {
        const text = spoken?.(round);
        if (text) void say(text);
      }
      r.answer(ok);
    },
    [r, picked, round, spoken],
  );

  useGameKeys(
    useCallback((n: number) => round.options[n] && pick(round.options[n].id), [round, pick]),
    r.status === 'shown' ? r.next : null,
  );

  return (
    <div className="g-choice">
      <div className="g-stage-top">{stage(round, r)}</div>
      <Tiles options={round.options} right={round.right} picked={picked} r={r as Rounds<unknown>} onPick={pick} size={size} />
      <Feedback
        r={r as Rounds<unknown>}
        answer={answer ? answer(round) : round.options.find((o) => o.id === round.right)?.label}
      />
    </div>
  );
}
