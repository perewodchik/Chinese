/**
 * Starts Phaser inside an element. Phaser is imported here, dynamically, so
 * it is only ever downloaded on /play/world.
 */

import type { Facing, PartOfDay } from '../core/types';
import type { Arrival } from './doors';
import type { SceneOptions, WorldScene as Scene } from './scene';

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
  /** on or off a shared bike */
  setBike(on: boolean): void;
  /** today's rain or snow (X4) */
  setSky(kind: 'none' | 'rain' | 'snow'): void;
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
    fps: () => Math.round(game.loop.actualFps),
    setBike: (on) => (game.scene.getScene('world') as Scene | null)?.setBike(on),
    setSky: (kind) => (game.scene.getScene('world') as Scene | null)?.setSky(kind),
    snapshot: () =>
      new Promise((resolve) => {
        game.renderer.snapshot((img) => resolve((img as HTMLImageElement).src));
      }),
  };
}
