import { useMemo } from 'react';
import { directions, trackedMaps } from '../core/journal';
import { stepWait } from '../core/rest';
import { line } from '../core/travel';
import type { WorldSave } from '../core/types';
import type { WorldContent } from './content';
import { placeZh, useMapIndex } from './Journal';
import './journal.css';

/**
 * The next hop of the quest you follow (§10 J3c), a small chip under the
 * minimap: "→ 南锣鼓巷站 · 8号线". A tap opens Journal → Now. It shows
 * nothing when you are there already, or the step has no place.
 */
export function NextHop({
  save,
  content,
  onOpen,
  onWait,
}: {
  save: WorldSave;
  content: WorldContent;
  onOpen: () => void;
  /** §13 Q2: let the hours pass here (a seat is at hand); none where there is nowhere to sit */
  onWait?: (hour: number) => void;
}) {
  const index = useMapIndex();
  const to = useMemo(() => trackedMaps(save, content)[0], [save, content]);
  // §13 Q2: the step waits for an hour — say so, and offer to wait where you can sit
  const wait = useMemo(() => stepWait(save, content), [save, content]);
  if (!to || !Object.keys(index).length) return null;
  const dir = directions(save, to, index);
  if (dir.kind === 'here' && wait) {
    return (
      <span className="wm-hop-row">
        <button type="button" className="wm-hop" onClick={onOpen} aria-label={`It can happen ${wait.text} — open the journal`}>
          <span aria-hidden>⏳</span>
          <span>{wait.text}</span>
        </button>
        {onWait && (
          <button type="button" className="wm-hop wm-wait" onClick={() => onWait(wait.from)}>
            Wait here
          </button>
        )}
      </span>
    );
  }
  if (dir.kind === 'here' || dir.kind === 'none' || !dir.legs.length) return null;
  const [first, second] = dir.legs;
  const walk = first!.kind === 'walk' ? first : undefined;
  const ride = [first, second].find((l) => l?.kind === 'ride');
  const rideLine = ride?.kind === 'ride' ? line(ride.line) : undefined;
  const dest = walk ? placeZh(walk.maps.at(-1)!) : undefined;
  return (
    // keyed by where it points: a new next step mounts it again, and it glows once (§13 K2)
    <button key={to} type="button" className="wm-hop" onClick={onOpen} aria-label={`Next: ${dest ?? ''} ${rideLine?.zh ?? ''} — open the journal`}>
      <span aria-hidden>→</span>
      {dest && <span className="han">{dest}</span>}
      {rideLine && (
        <span className="wm-hop-line" style={{ background: rideLine.color }}>
          {rideLine.zh}
        </span>
      )}
      {wait && <span className="wm-hop-when">· {wait.text}</span>}
    </button>
  );
}
