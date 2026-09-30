import { useMemo } from 'react';
import { directions, trackedMaps } from '../core/journal';
import { nextHop } from '../core/guide';
import { stepWait } from '../core/rest';
import { line } from '../core/travel';
import type { WorldSave } from '../core/types';
import type { WorldContent } from './content';
import { placeZh, useMapIndex } from './Journal';
import { takeMeTo, useGuide } from './takeMeThere';
import './journal.css';

/**
 * The next hop of the quest you follow (§10 J3c), a small chip under the
 * minimap: "→ 南锣鼓巷站 · 8号线". A tap opens Journal → Now. It shows
 * nothing when you are there already, or the step has no place. The prints
 * beside it (M6) lay footprints there in the world; again, and they stop.
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
  const guide = useGuide();
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
  // where you walk to first: the guide's next hop knows a bus leaves from its stop, not the subway hall
  const hop = nextHop(save, to, index);
  const dest = hop.kind === 'walk' ? placeZh([hop.next, ...hop.then].at(-1)!) : walk && hop.kind !== 'board' ? placeZh(walk.maps.at(-1)!) : undefined;
  const taking = guide.to === to;
  return (
    <span className="wm-hop-row">
      {/* keyed by where it points: a new next step mounts it again, and it glows once (§13 K2) */}
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
      <button
        type="button"
        className="wm-hop wm-take"
        aria-pressed={taking}
        onClick={() => takeMeTo(taking ? null : to)}
        aria-label={taking ? 'Stop the footprints' : `Take me there — footprints to ${placeZh(to)}`}
        title={taking ? 'Stop the footprints' : 'Take me there'}
      >
        <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
          <rect x="1.5" y="5" width="3" height="4" rx="1.2" />
          <rect x="2" y="9.6" width="2" height="1.6" rx="0.6" />
          <rect x="7.5" y="1" width="3" height="4" rx="1.2" />
          <rect x="8" y="5.6" width="2" height="1.6" rx="0.6" />
        </svg>
      </button>
    </span>
  );
}
