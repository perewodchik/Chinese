import { useMemo } from 'react';
import { questionFor } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import { useLibrary } from '../shared/library';
import { DrillDone, DrillFrame, useDrillRun } from './DrillFrame';
import { WritePad } from './WritePad';

interface Props {
  ids: ItemId[];
  onExit: () => void;
}

/**
 * Write it from memory, on an empty square, and be told stroke by stroke
 * whether you were right.
 *
 * This is the exercise the app was missing. Every practice sheet it prints has
 * the character standing at the top of the block, which makes writing it out
 * an act of copying — pleasant, useful for the hand, and almost worthless as
 * memory. Here there is nothing to copy from (see WritePad).
 */
export function WriteDrill({ ids, onExit }: Props) {
  const lib = useLibrary();
  const run = useDrillRun(ids, 'write');
  const q = useMemo(() => (run.id ? questionFor(lib, run.id) : null), [lib, run.id]);

  if (!run.id || !q) {
    return (
      <DrillFrame title="Write it" hint="" at={run.total} total={run.total} onExit={onExit}>
        <DrillDone log={run.log} skill="write" onExit={onExit} />
      </DrillFrame>
    );
  }

  return (
    <DrillFrame
      title="Write it"
      hint={run.repeat ? 'Once more — you missed this one a moment ago.' : 'From the meaning and the sound. Nothing to copy.'}
      at={run.at}
      total={run.total}
      onExit={onExit}
    >
      <WritePad key={run.at} char={q.char} py={q.py} gloss={q.gloss} onDone={run.answer} />
    </DrillFrame>
  );
}
