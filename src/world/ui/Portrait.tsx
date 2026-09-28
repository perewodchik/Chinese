import { useEffect, useState } from 'react';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
}

let atlas: Promise<{ frames: Record<string, Frame>; meta: { size: { w: number; h: number } } }> | null = null;
const loadAtlas = () => (atlas ??= fetch('/world/art/chars.json').then((r) => r.json()));

/**
 * A person's head, cut from the characters' atlas and drawn big with square
 * pixels. The box is sized before the atlas arrives, so nothing moves.
 */
export function Portrait({ sprite, scale = 3 }: { sprite: string; scale?: number }) {
  const [f, setF] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    void loadAtlas().then((a) => {
      if (!live) return;
      setF(a.frames[`${sprite}/down-0`]?.frame ?? null);
      setSize(a.meta.size);
    });
    return () => {
      live = false;
    };
  }, [sprite]);
  // the head: the top 18 pixels of a 16×32 figure, from row 2
  const w = 16 * scale;
  const h = 16 * scale;
  return (
    <span
      className="wt-portrait"
      aria-hidden
      style={{
        width: w,
        height: h,
        backgroundImage: f ? 'url(/world/art/chars.png)' : undefined,
        backgroundSize: size ? `${size.w * scale}px ${size.h * scale}px` : undefined,
        backgroundPosition: f ? `${-f.x * scale}px ${-(f.y + 3) * scale}px` : undefined,
      }}
    />
  );
}
