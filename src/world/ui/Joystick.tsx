import { useRef, useState } from 'react';
import type { Facing } from '../core/types';
import { stickFacing } from './stick';

/**
 * The optional on-screen joystick (concept §4; off by default, switched on
 * in ⚙): a pad bottom-right that walks the hero while held, pushed to the
 * rim to run, and an A button to talk or look — as the arrows and Space do.
 */
export function Joystick({ onStick, onAct }: { onStick: (f: Facing | null, run: boolean) => void; onAct: () => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const last = useRef<string>('');

  const at = (x: number, y: number) => {
    const r = pad.current?.getBoundingClientRect();
    if (!r) return;
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    const max = r.width / 2 - 16;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, max / d);
    setKnob([dx * k, dy * k]);
    const s = stickFacing(dx, dy);
    const key = `${s.facing}:${s.run}`;
    if (key !== last.current) {
      last.current = key;
      onStick(s.facing, s.run);
    }
  };
  const release = () => {
    setKnob([0, 0]);
    last.current = '';
    onStick(null, false);
  };

  return (
    <div className="wj">
      <div
        ref={pad}
        className="wj-pad"
        aria-label="Joystick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons && at(e.clientX, e.clientY)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="wj-knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
      </div>
      <button type="button" className="wj-a" onClick={onAct} aria-label="Talk or look">
        A
      </button>
    </div>
  );
}
