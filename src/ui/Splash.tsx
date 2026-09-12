import type { ReactNode } from 'react';

/** A whole screen with one thing to say: that something is loading, or why it could not. */
export function Splash({ mark, children }: { mark: string; children: ReactNode }) {
  return (
    <div className="empty splash">
      <span className="big">{mark}</span>
      {children}
    </div>
  );
}
