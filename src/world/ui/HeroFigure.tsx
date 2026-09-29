import { useEffect, useRef, useState } from 'react';
import type { Dir } from '../art/hero';
import { wornOf } from '../art/hero';
import { paletteOf } from '../core/clothes';
import type { HeroLook, Outfit } from '../core/looks';
import type { ClothesContent } from '../core/wardrobe';
import type { HeroDress } from '../engine/look';
import { heroPicture } from './heroPicture';

/** The player's look and outfit as the composer takes them (clothes not yet loaded: none drawn). */
export function dressOf(look: HeroLook, outfit: Outfit, clothes: ClothesContent): HeroDress {
  return { look, worn: wornOf(outfit, (id) => paletteOf(clothes, id)) };
}

export type Facing4 = Dir | 'right';
export const TURN: readonly Facing4[] = ['down', 'left', 'up', 'right'];

/**
 * A whole figure, 16×32 pixels drawn `scale` times, in a box sized before
 * anything is drawn (no layout shift).
 */
export function Figure({ dress, dir = 'down', step = 0, scale = 4, label }: { dress: HeroDress; dir?: Facing4; step?: number; scale?: number; label?: string }) {
  return (
    <img
      className="wc-figure"
      src={heroPicture(dress, dir, step)}
      width={16 * scale}
      height={32 * scale}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  );
}

/** Just the head (rows 3–18 of the figure), for small tiles. */
export function Head({ dress, scale = 2, dir = 'down' }: { dress: HeroDress; scale?: number; dir?: Facing4 }) {
  return (
    <span
      className="wc-head"
      aria-hidden
      style={{
        width: 16 * scale,
        height: 16 * scale,
        backgroundImage: `url(${heroPicture(dress, dir)})`,
        backgroundSize: `${16 * scale}px ${32 * scale}px`,
        backgroundPosition: `0 ${-2 * scale}px`,
      }}
    />
  );
}

/**
 * The big preview that turns through the four directions on its own, and
 * by a drag (or a tap) when you want to see a side. Walks on the spot.
 */
export function TurningFigure({ dress, scale = 6 }: { dress: HeroDress; scale?: number }) {
  const [turn, setTurn] = useState(0);
  const [step, setStep] = useState(0);
  const held = useRef(false);
  const drag = useRef<{ x: number; turn: number } | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!held.current) setTurn((n) => (n + 1) % 4);
    }, 1800);
    const s = window.setInterval(() => setStep((n) => (n + 1) % 4), 260);
    return () => {
      window.clearInterval(t);
      window.clearInterval(s);
    };
  }, []);
  // stand, step, stand, the other step
  const frame = step === 1 ? 1 : step === 3 ? -1 : 0;
  return (
    <div
      className="wc-turn"
      style={{ width: 16 * scale + 24, height: 32 * scale + 16 }}
      role="img"
      aria-label="Your character — drag to turn"
      onPointerDown={(e) => {
        held.current = true;
        drag.current = { x: e.clientX, turn };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const by = Math.round((e.clientX - d.x) / 40);
        setTurn((((d.turn - by) % 4) + 4) % 4);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        // a tap without a drag turns a quarter
        if (d && Math.abs(e.clientX - d.x) < 6) setTurn((n) => (n + 1) % 4);
      }}
    >
      <Figure dress={dress} dir={TURN[turn]} step={frame} scale={scale} />
    </div>
  );
}
