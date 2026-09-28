import { lazy, Suspense } from 'react';
import './world.css';

/**
 * /play/world. The page and Phaser behind it are a chunk of their own,
 * fetched only when the game is opened; until then the frame is already
 * there, the same size, so nothing moves when it arrives.
 */
const WorldPage = lazy(() => import('./WorldPage').then((m) => ({ default: m.WorldPage })));

export function WorldRoute() {
  return (
    <Suspense fallback={<div className="world-shell"><div className="world-loading small">Opening Beijing…</div></div>}>
      <WorldPage />
    </Suspense>
  );
}
