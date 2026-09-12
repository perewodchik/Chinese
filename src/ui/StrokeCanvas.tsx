import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StrokeMap } from '../data/types';
import { toCanvasSpace, toGlyphSpace, type Pt } from '../domain/stroke';

interface Props {
  char: string;
  strokes: StrokeMap;
  /** the largest it may draw; it fills the width it is given, up to this */
  size?: number;
  /** how many strokes have been accepted so far */
  done: number;
  /** draw the expected stroke as a guide */
  hint?: boolean;
  /** draw the whole character, faint, behind everything */
  ghost?: boolean;
  flash?: 'ok' | 'miss' | null;
  disabled?: boolean;
  /** ignore fingers — set once a stylus has been seen, so a palm cannot draw */
  penOnly?: boolean;
  onPenDetected?: () => void;
  onStroke: (pts: Pt[]) => void;
}

interface Sample extends Pt {
  /** 0 to 1, from the stylus; a mouse always reports the middle */
  force: number;
}

const MIN_WIDTH = 4.5;
const MAX_WIDTH = 15;

/**
 * A square to write one character in, and the only place in the app that takes
 * handwriting rather than showing it.
 *
 * What it draws back is deliberately not what you drew. Once a stroke is
 * accepted the real outline appears in its place, so the character assembles
 * itself correctly under your hand instead of preserving the wobble — you are
 * being asked whether you knew the stroke, not how steady your hand was. The
 * only ink of your own that stays on screen is the stroke in progress.
 *
 * On a tablet this is the whole app, so the input path is written for a stylus
 * first: pressure varies the line, every coalesced sample is kept so a fast
 * stroke is a curve rather than four points, and the moment a stylus touches
 * the glass fingers stop counting — which is what lets you rest a hand on the
 * screen to write, the way you would on paper.
 */
export function StrokeCanvas({
  char,
  strokes,
  size = 380,
  done,
  hint,
  ghost,
  flash,
  disabled,
  penOnly,
  onPenDetected,
  onStroke,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef<Sample[]>([]);
  /** the one pointer being drawn with; a second finger is ignored, not merged */
  const active = useRef<number | null>(null);
  const [box, setBox] = useState(size);
  const data = strokes[char];

  // Fill the width it is given, stay square, never exceed `size`.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setBox(Math.max(160, Math.min(size, el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  const paint = useCallback(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box, box);

    const css = getComputedStyle(cv);
    const line = css.getPropertyValue('--line-2').trim() || '#d3cabc';
    const ink = css.getPropertyValue('--ink').trim() || '#241f1b';
    const accent = css.getPropertyValue('--accent').trim() || '#b8452f';
    const faint = css.getPropertyValue('--line').trim() || '#e4ddd2';

    // 米字格: the cross and the diagonals, the way squared paper is ruled.
    ctx.save();
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(box / 2, 0);
    ctx.lineTo(box / 2, box);
    ctx.moveTo(0, box / 2);
    ctx.lineTo(box, box / 2);
    ctx.moveTo(0, 0);
    ctx.lineTo(box, box);
    ctx.moveTo(box, 0);
    ctx.lineTo(0, box);
    ctx.stroke();
    ctx.restore();

    if (!data) return;

    // Glyph space is 1024 wide and y-up, sitting on a baseline at 900.
    const k = box / 1024;
    const glyph = new DOMMatrix([k, 0, 0, -k, 0, 900 * k]);

    const fillStroke = (i: number, style: string, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = style;
      const p = new Path2D();
      p.addPath(new Path2D(data.s[i]), glyph);
      ctx.fill(p);
      ctx.restore();
    };

    if (ghost) for (let i = 0; i < data.s.length; i++) fillStroke(i, ink, 0.1);
    for (let i = 0; i < Math.min(done, data.s.length); i++) {
      fillStroke(i, flash === 'ok' && i === done - 1 ? accent : ink, 1);
    }

    // The guide: the centre line of the stroke you owe, with a dot at the end
    // it starts from, because half of stroke order is which end you start at.
    const median = data.m?.[done];
    if (hint && median?.length) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      median.forEach(([x, y], i) => {
        const [cx, cy] = toCanvasSpace({ x, y }, box);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      const [sx, sy] = toCanvasSpace({ x: median[0][0], y: median[0][1] }, box);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // The stroke in progress, segment by segment so pressure can vary the
    // line. One flat polyline would draw the same for a stylus and a mouse.
    if (pts.current.length > 1) {
      ctx.save();
      ctx.strokeStyle = flash === 'miss' ? line : accent;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const scale = box / 300;
      for (let i = 1; i < pts.current.length; i++) {
        const a = pts.current[i - 1];
        const b = pts.current[i];
        const force = (a.force + b.force) / 2;
        ctx.beginPath();
        ctx.lineWidth = (MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * force) * scale;
        const [ax, ay] = toCanvasSpace(a, box);
        const [bx, by] = toCanvasSpace(b, box);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [char, data, done, hint, ghost, flash, box]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = box * dpr;
    cv.height = box * dpr;
    paint();
  }, [paint, box]);

  /**
   * Safari treats two fingers over any element as a page zoom, including one
   * being written on. These events are non-standard and only exist there, so
   * they are attached by hand rather than through React.
   */
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const stop = (e: Event) => e.preventDefault();
    const kinds = ['gesturestart', 'gesturechange', 'gestureend'];
    kinds.forEach((k) => cv.addEventListener(k, stop, { passive: false }));
    return () => kinds.forEach((k) => cv.removeEventListener(k, stop));
  }, []);

  const sample = (e: { clientX: number; clientY: number; pressure?: number }): Sample => {
    const r = ref.current!.getBoundingClientRect();
    const p = toGlyphSpace(e.clientX - r.left, e.clientY - r.top, box);
    // A mouse reports 0.5 while down and 0 otherwise; a stylus that does not
    // measure pressure reports 0. Either way the middle is the honest guess.
    const raw = e.pressure ?? 0;
    return { ...p, force: raw > 0 ? raw : 0.5 };
  };

  /** True when this pointer is allowed to draw. */
  const accepts = (e: React.PointerEvent) => {
    if (disabled) return false;
    // Once a stylus has been seen, a touch is a palm resting on the glass.
    if (penOnly && e.pointerType === 'touch') return false;
    return true;
  };

  return (
    <div
      ref={wrap}
      className="stroke-pad"
      style={{ maxWidth: size }}
      // The whole pad, not just the canvas: a stroke that starts a pixel
      // outside it should not begin scrolling the page instead.
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={ref}
        className="stroke-canvas"
        style={{ width: box, height: box }}
        aria-label={`Write ${char} here`}
        onPointerDown={(e) => {
          if (!accepts(e) || active.current !== null) return;
          if (e.pointerType === 'pen') onPenDetected?.();
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          active.current = e.pointerId;
          pts.current = [sample(e)];
          paint();
        }}
        onPointerMove={(e) => {
          if (active.current !== e.pointerId) return;
          e.preventDefault();
          // A stylus on a 120Hz screen produces several positions between two
          // frames. Taking only the last of them is what turns a fast curve
          // into a straight line, and a straight line is a different stroke.
          const native = e.nativeEvent;
          const coalesced =
            typeof native.getCoalescedEvents === 'function'
              ? native.getCoalescedEvents()
              : [];
          if (coalesced.length) {
            for (const c of coalesced) pts.current.push(sample(c));
          } else {
            pts.current.push(sample(e));
          }
          paint();
        }}
        onPointerUp={(e) => {
          if (active.current !== e.pointerId) return;
          active.current = null;
          const drawn = pts.current;
          pts.current = [];
          paint();
          if (drawn.length) onStroke(drawn.map(({ x, y }) => ({ x, y })));
        }}
        onPointerCancel={(e) => {
          if (active.current !== e.pointerId) return;
          active.current = null;
          pts.current = [];
          paint();
        }}
      />
    </div>
  );
}
