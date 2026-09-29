import { useEffect, useState } from 'react';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
}

let atlas: Promise<{ frames: Record<string, Frame>; meta: { size: { w: number; h: number } } }> | null = null;
const loadAtlas = () => (atlas ??= fetch('/world/art/props.json').then((r) => r.json()));

/**
 * One frame of the props atlas drawn big with square pixels — a sticker, a
 * decoration. The box is sized before the atlas arrives, so nothing moves.
 */
export function PropSprite({ frame, size = 16, scale = 2, label }: { frame: string; size?: number; scale?: number; label?: string }) {
  const [f, setF] = useState<{ x: number; y: number } | null>(null);
  const [whole, setWhole] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    void loadAtlas().then((a) => {
      if (!live) return;
      setF(a.frames[frame]?.frame ?? null);
      setWhole(a.meta.size);
    });
    return () => {
      live = false;
    };
  }, [frame]);
  return (
    <span
      className="w-prop"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: size * scale,
        height: size * scale,
        backgroundImage: f ? 'url(/world/art/props.png)' : undefined,
        backgroundSize: whole ? `${whole.w * scale}px ${whole.h * scale}px` : undefined,
        backgroundPosition: f ? `${-f.x * scale}px ${-f.y * scale}px` : undefined,
      }}
    />
  );
}
