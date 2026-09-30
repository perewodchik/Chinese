/**
 * Starts Phaser inside an element. Phaser is imported here, dynamically, so
 * it is only ever downloaded on /play/world.
 */

import type { Facing, MapObject, PartOfDay } from '../core/types';
import type { Arrival } from './doors';
import type { HeroDress } from './look';
import type { OwnBikeLook, SceneOptions, WorldScene as Scene } from './scene';
import type { Cutscene } from '../core/cutscene';
import type { TrailSpec } from '../core/guide';
import type { CutsceneHooks, RunningCutscene } from './cutscene';

export interface RunningWorld {
  destroy(): void;
  /** go to another map (a door the page has let you through) */
  travel(to: Arrival): void;
  /** stop drawing while a full-screen panel covers the world, and start again */
  setPaused(paused: boolean): void;
  /** the part of the day changed on the game clock */
  setTime(time: PartOfDay): void;
  /** the on-screen joystick: walk that way while held (null lets go) */
  stick(f: Facing | null, run?: boolean): void;
  /** the joystick's action button */
  act(): void;
  /** on or off a shared bike, or your own (§13 L2) */
  setBike(on: boolean | OwnBikeLook): void;
  /** ring your bike's bell: who ahead says 「慢点儿！」, if anyone */
  ringBell(): string | null;
  /** today's rain or snow (X4) */
  setSky(kind: 'none' | 'rain' | 'snow'): void;
  /** the part of the map on screen, in tiles, and a zoom step for photos (X6) */
  view(): { x: number; y: number; w: number; h: number } | null;
  zoomBy(d: 1 | -1): void;
  /** the player's clothes or look changed (W4): draw them */
  setDress(d: HeroDress): void;
  /** 兔儿爷: today's hat, and a feeling for a moment (X7) */
  setHat(kind: 'none' | 'snow' | 'flower' | 'armour'): void;
  emote(kind: 'happy' | 'sulky' | 'sleepy' | 'proud' | 'blush', ms?: number): void;
  /** walk through a station's ticket gates at this tile */
  passGate(gate: readonly [number, number], down: boolean): void;
  /** §13 Q1: quest marks over people, by map object id; null for none */
  setQuestMarks(marks: Readonly<Record<string, 'main' | 'side' | 'next'>> | null): void;
  /** M6: faint footprints to the next door, street end or train board on the way; null for none */
  setTrail(spec: TrailSpec | null): void;
  /** the footprints' tiles and yours, for probes */
  trail(): { at: readonly [number, number]; path: (readonly [number, number])[] } | null;
  /** marks over what can be talked to or looked at; null for none */
  setHints(pred: ((o: MapObject) => boolean) | null): void;
  /** play a cutscene on the map on screen (§13 K1); null when no map is running */
  cutscene(cs: Cutscene, hooks: CutsceneHooks): RunningCutscene | null;
  /** frames a second lately (for the map probe) */
  fps(): number;
  /** a PNG data URL of the canvas, for review screenshots */
  snapshot(): Promise<string>;
}

/** `snapshots` keeps the drawing buffer so the canvas can be saved as a picture; it costs frame time, so only for review shots. */
export async function startWorld(parent: HTMLElement, opts: SceneOptions, snapshots = false): Promise<RunningWorld> {
  const Phaser = await import('phaser');
  const { WorldScene } = await import('./scene');
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#22202e',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    // The page has its own UI and its own loading state.
    banner: false,
    audio: { noAudio: true },
    render: { preserveDrawingBuffer: snapshots },
    // 60 frames a second where the iPad manages, never slower than 30 in the game's own sums.
    fps: { target: 60, min: 30, smoothStep: true },
  });
  game.scene.add('world', WorldScene, true, opts);
  return {
    destroy: () => game.destroy(true),
    setPaused: (paused) => (paused ? game.loop.sleep() : game.loop.wake()),
    setTime: (time) => (game.scene.getScene('world') as Scene | null)?.setTime(time),
    travel: (to) => (game.scene.getScene('world') as Scene | null)?.travel(to),
    stick: (f, run) => (game.scene.getScene('world') as Scene | null)?.setStick(f, run),
    act: () => (game.scene.getScene('world') as Scene | null)?.act(),
    passGate: (gate, down) => (game.scene.getScene('world') as Scene | null)?.passGate([gate[0], gate[1]], down),
    setQuestMarks: (marks) => (game.scene.getScene('world') as Scene | null)?.setQuestMarks(marks),
    setHints: (pred) => (game.scene.getScene('world') as Scene | null)?.setHints(pred),
    setTrail: (spec) => (game.scene.getScene('world') as Scene | null)?.setTrail(spec),
    trail: () => (game.scene.getScene('world') as Scene | null)?.trailTiles() ?? null,
    cutscene: (cs, hooks) => (game.scene.getScene('world') as Scene | null)?.playCutscene(cs, hooks) ?? null,
    fps: () => Math.round(game.loop.actualFps),
    setBike: (on) => (game.scene.getScene('world') as Scene | null)?.setBike(on),
    ringBell: () => (game.scene.getScene('world') as Scene | null)?.ringBell() ?? null,
    setSky: (kind) => (game.scene.getScene('world') as Scene | null)?.setSky(kind),
    view: () => (game.scene.getScene('world') as Scene | null)?.viewTiles() ?? null,
    zoomBy: (d) => (game.scene.getScene('world') as Scene | null)?.zoomStep(d),
    setDress: (d) => (game.scene.getScene('world') as Scene | null)?.setDress(d),
    setHat: (kind) => (game.scene.getScene('world') as Scene | null)?.setHat(kind),
    emote: (kind, ms) => (game.scene.getScene('world') as Scene | null)?.showEmote(kind, ms),
    snapshot: () =>
      new Promise((resolve) => {
        game.renderer.snapshot((img) => resolve((img as HTMLImageElement).src));
      }),
  };
}
