import type { ReactNode } from 'react';
import type { Rounds } from './useRounds';

/**
 * The line under a prompt: nothing while asking, a word of encouragement
 * after a slip, and the answer with a Next button once a prompt is missed.
 *
 * Always rendered at the same height, so nothing above it moves.
 */
export function Feedback({ r, answer, children }: { r: Rounds<unknown>; answer?: ReactNode; children?: ReactNode }) {
  return (
    <div className="g-feedback" data-state={r.status} aria-live="polite">
      {r.status === 'wrong' && <span>Not that one — try again.</span>}
      {r.status === 'right' && <span className="g-yes">对！</span>}
      {r.status === 'shown' && (
        <>
          <span className="g-answer">{answer}</span>
          <button type="button" className="btn primary" onClick={r.next} autoFocus>
            Next
          </button>
        </>
      )}
      {children}
    </div>
  );
}
