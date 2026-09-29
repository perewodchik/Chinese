import { useEffect, useState } from 'react';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
}

type Atlas = { frames: Record<string, Frame>; meta: { size: { w: number; h: number } } };
const atlases = new Map<string, Promise<Atlas>>();
/** `props` (the street's things) or `menu` (the bag's things and the menu's icons) */
export type AtlasName = 'props' | 'menu';
const loadAtlas = (name: AtlasName) => {
  let a = atlases.get(name);
  if (!a) atlases.set(name, (a = fetch(`/world/art/${name}.json`).then((r) => r.json() as Promise<Atlas>)));
  return a;
};

/**
 * One frame of the props atlas drawn big with square pixels — a sticker, a
 * decoration. The box is sized before the atlas arrives, so nothing moves.
 */
export function PropSprite({
  frame,
  size = 16,
  scale = 2,
  label,
  atlas = 'props',
  fallback,
}: {
  frame: string;
  size?: number;
  scale?: number;
  label?: string;
  atlas?: AtlasName;
  /** drawn instead when the atlas has no `frame` */
  fallback?: string;
}) {
  const [f, setF] = useState<{ x: number; y: number } | null>(null);
  const [whole, setWhole] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    void loadAtlas(atlas).then((a) => {
      if (!live) return;
      setF(a.frames[frame]?.frame ?? (fallback ? a.frames[fallback]?.frame : undefined) ?? null);
      setWhole(a.meta.size);
    });
    return () => {
      live = false;
    };
  }, [frame, atlas, fallback]);
  return (
    <span
      className="w-prop"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: size * scale,
        height: size * scale,
        backgroundImage: f ? `url(/world/art/${atlas}.png)` : undefined,
        backgroundSize: whole ? `${whole.w * scale}px ${whole.h * scale}px` : undefined,
        backgroundPosition: f ? `${-f.x * scale}px ${-f.y * scale}px` : undefined,
      }}
    />
  );
}

/** A thing in the bag, by item id, from the menu atlas (a gift box when it has no picture yet). */
export function ItemSprite({ id, scale = 2, label }: { id: string; scale?: number; label?: string }) {
  return <PropSprite atlas="menu" frame={`item/${id}`} fallback="ui/gift" scale={scale} label={label} />;
}

/** One of the menu's own icons: `journal`, `bag`, `map`, `people`, `collection`, `coin`, `card`, `gift`, `seal`, `clothes`. */
export function MenuIcon({ name, scale = 2 }: { name: string; scale?: number }) {
  return <PropSprite atlas="menu" frame={`ui/${name}`} scale={scale} />;
}

/**
 * A frame of any size fitted into a fixed square box at the largest whole
 * scale that fits (a 16×32 lion, a 48×32 dragon), centred. The box is its
 * size from the start, so nothing moves when the atlas arrives.
 */
export function FitSprite({ frame, box, atlas = 'props', label }: { frame: string; box: number; atlas?: AtlasName; label?: string }) {
  const [f, setF] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [whole, setWhole] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let live = true;
    void loadAtlas(atlas).then((a) => {
      if (!live) return;
      setF(a.frames[frame]?.frame ?? null);
      setWhole(a.meta.size);
    });
    return () => {
      live = false;
    };
  }, [frame, atlas]);
  const scale = f ? Math.max(1, Math.floor(Math.min(box / f.w, box / f.h))) : 1;
  return (
    <span className="w-fit" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ width: box, height: box }}>
      {f && whole && (
        <span
          className="w-prop"
          style={{
            width: f.w * scale,
            height: f.h * scale,
            backgroundImage: `url(/world/art/${atlas}.png)`,
            backgroundSize: `${whole.w * scale}px ${whole.h * scale}px`,
            backgroundPosition: `${-f.x * scale}px ${-f.y * scale}px`,
          }}
        />
      )}
    </span>
  );
}
