import { useState } from 'react';

/** Where the viewfinder sits, as fractions of the game box — the part of the screenshot that becomes the photo. */
export const FINDER = { x: 0.1, y: 0.16, w: 0.8, h: 0.62 };

/**
 * Photo mode (X6): the world stands still behind a viewfinder; zoom in or
 * out a step, take the picture, and it goes to the 相册 tab (on this device).
 * What is inside the frame counts for photo tasks.
 */
export function PhotoMode({ onTake, onZoom, onClose }: { onTake: () => Promise<string | null>; onZoom: (d: 1 | -1) => void; onClose: () => void }) {
  const [flash, setFlash] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const take = async () => {
    if (busy) return;
    setBusy(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    const note = await onTake().catch(() => 'The picture did not come out — try again.');
    setSaid(note);
    setBusy(false);
  };
  return (
    <div className="wph" role="dialog" aria-label="Photo mode">
      <div
        className="wph-finder"
        style={{ left: `${FINDER.x * 100}%`, top: `${FINDER.y * 100}%`, width: `${FINDER.w * 100}%`, height: `${FINDER.h * 100}%` }}
        data-flash={flash ? '' : undefined}
      />
      <div className="wph-bar">
        <button type="button" className="wd-tool" onClick={() => onZoom(-1)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="wd-tool" onClick={() => onZoom(1)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="wd-go wph-take" onClick={() => void take()} disabled={busy}>
          📷 Take
        </button>
        <span className="wph-said tiny">{said ?? 'Frame it, then take it.'}</span>
        <button type="button" className="wd-tool" onClick={onClose} aria-label="Leave photo mode">
          ×
        </button>
      </div>
    </div>
  );
}
