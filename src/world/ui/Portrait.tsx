import { useEffect, useState } from 'react';
import { currentDress, heroPicture } from './heroPicture';

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
  // 我: the player's own look and clothes (W1), drawn by the composer
  const dress = sprite === 'hero' ? currentDress() : null;
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
  // a person's head: 16 pixels of a 16×32 figure from row 3; a 16×16 figure (兔儿爷) whole
  const w = 16 * scale;
  const h = 16 * scale;
  if (dress) {
    return (
      <span
        className="wt-portrait"
        aria-hidden
        style={{ width: w, height: h, backgroundImage: `url(${heroPicture(dress)})`, backgroundSize: `${16 * scale}px ${32 * scale}px`, backgroundPosition: `0 ${-3 * scale}px` }}
      />
    );
  }
  return (
    <span
      className="wt-portrait"
      aria-hidden
      style={{
        width: w,
        height: h,
        backgroundImage: f ? 'url(/world/art/chars.png)' : undefined,
        backgroundSize: size ? `${size.w * scale}px ${size.h * scale}px` : undefined,
        backgroundPosition: f ? `${-f.x * scale}px ${-(f.y + (f.h > 16 ? 3 : 0)) * scale}px` : undefined,
      }}
    />
  );
}
