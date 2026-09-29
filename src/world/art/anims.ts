/**
 * What moves, and how fast (§13 V3). The engine runs one clock for all of
 * it (no timer per thing — the iPad's frame time matters); a map names one
 * frame of a prop, and if that frame belongs to an animation here, the prop
 * plays it. Tiles animate by name wherever a map uses them.
 *
 * `art.test.ts` checks every frame named here is in the built atlases.
 */

export interface Anim {
  frames: readonly string[];
  /** frames a second */
  fps: number;
  /** each copy starts somewhere else in the cycle, so a row of trees does not sway in step */
  random?: boolean;
  /** only turns while you are within this many tiles (prayer wheels turn as you walk past) */
  near?: number;
}

const urbanTree = (n: string): Anim => ({ frames: [`urban-tall/${n}`, `urban-tall/${n}-1`], fps: 0.9, random: true });

export const PROP_ANIM_LIST: readonly Anim[] = [
  { frames: ['steamer/steam-0', 'steamer/steam-1'], fps: 3, random: true },
  { frames: ['censer/smoke-0', 'censer/smoke-1'], fps: 2, random: true },
  { frames: ['grill/smoke-0', 'grill/smoke-1'], fps: 4, random: true },
  { frames: ['prayer-wheels/turn-0', 'prayer-wheels/turn-1', 'prayer-wheels/turn-2'], fps: 8, near: 3 },
  { frames: ['tree/huai', 'tree/huai-1'], fps: 0.8, random: true },
  { frames: ['willow/green', 'willow/green-1'], fps: 0.6, random: true },
  urbanTree('tree-round'),
  urbanTree('tree-small'),
  urbanTree('tree-ginkgo'),
  urbanTree('tree-ginkgo-small'),
  { frames: ['fox/sway-0', 'fox/sway-1'], fps: 2 },
  { frames: ['dragon/fly-0', 'dragon/fly-1'], fps: 3 },
  { frames: ['flag/red-0', 'flag/red-1', 'flag/red-2'], fps: 5, random: true },
  { frames: ['fountain/spray-0', 'fountain/spray-1', 'fountain/spray-2'], fps: 6, random: true },
  // red, then green, then a moment of amber
  { frames: ['signal/red', 'signal/red', 'signal/red', 'signal/green', 'signal/green', 'signal/green', 'signal/amber'], fps: 0.5, random: true },
  { frames: ['puddle/ripple-0', 'puddle/ripple-1'], fps: 1.5, random: true },
];

/** Any frame of an animation → the animation (a map may name any of its frames). */
export const PROP_ANIMS: ReadonlyMap<string, Anim> = new Map(PROP_ANIM_LIST.flatMap((a) => a.frames.map((f) => [f, a] as const)));

export const TILE_ANIMS: readonly Anim[] = [
  { frames: ['water-0', 'water-1', 'water-2', 'water-3'], fps: 2.5, random: true },
  { frames: ['stairs-down', 'stairs-down-1', 'stairs-down-2'], fps: 5 },
];

/**
 * What a person does while they stand about (§13 V3), from their card's
 * `idle`: most hold a thing that moves (the `idle/*` frames beside their
 * hand); 太极 and dancing move the person.
 */
export type IdleAction = 'fan' | 'knit' | 'birdcage' | 'chess' | 'taiji' | 'dance' | 'kongzhu' | 'jianzi' | 'read' | 'phone' | 'sweep';
export const IDLE_ACTIONS: readonly IdleAction[] = ['fan', 'knit', 'birdcage', 'chess', 'taiji', 'dance', 'kongzhu', 'jianzi', 'read', 'phone', 'sweep'];

/** The thing held, its frames and speed, and where it sits against the person's 16×24 sprite (dx right, dy up from the feet). */
export const IDLE_THINGS: Readonly<Partial<Record<IdleAction, Anim & { dx: number; dy: number }>>> = {
  fan: { frames: ['idle/fan-0', 'idle/fan-1'], fps: 3, random: true, dx: 6, dy: 10 },
  birdcage: { frames: ['idle/cage-0', 'idle/cage-1'], fps: 1.2, random: true, dx: 8, dy: 12 },
  chess: { frames: ['idle/chess-0', 'idle/chess-1'], fps: 0.4, random: true, dx: 0, dy: -2 },
  read: { frames: ['idle/paper-0', 'idle/paper-1'], fps: 0.3, random: true, dx: 2, dy: 8 },
  phone: { frames: ['idle/phone-0', 'idle/phone-1'], fps: 0.8, random: true, dx: 0, dy: 9 },
  sweep: { frames: ['idle/broom-0', 'idle/broom-1'], fps: 1.5, random: true, dx: 4, dy: 2 },
  knit: { frames: ['idle/knit-0', 'idle/knit-1'], fps: 2, random: true, dx: 1, dy: 6 },
  kongzhu: { frames: ['idle/diabolo-0', 'idle/diabolo-1', 'idle/diabolo-2'], fps: 3, random: true, dx: 7, dy: 4 },
  jianzi: { frames: ['idle/jianzi-0', 'idle/jianzi-1', 'idle/jianzi-2'], fps: 2.5, random: true, dx: 3, dy: 0 },
};

/** The frame an animation shows at a moment: `t` in ms, `phase` in frames (for `random` ones). */
export const frameAt = (a: Anim, t: number, phase = 0): string => a.frames[Math.floor((t / 1000) * a.fps + phase) % a.frames.length]!;
