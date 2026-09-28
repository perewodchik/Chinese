/**
 * Starts Phaser inside an element. Phaser is imported here, dynamically, so
 * it is only ever downloaded on /play/world.
 */

import type { SceneOptions } from './scene';

export interface RunningWorld {
  destroy(): void;
  /** a PNG data URL of the canvas, for review screenshots */
  snapshot(): Promise<string>;
}

export async function startWorld(parent: HTMLElement, opts: SceneOptions): Promise<RunningWorld> {
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
    render: { preserveDrawingBuffer: true },
  });
  game.scene.add('world', WorldScene, true, opts);
  return {
    destroy: () => game.destroy(true),
    snapshot: () =>
      new Promise((resolve) => {
        game.renderer.snapshot((img) => resolve((img as HTMLImageElement).src));
      }),
  };
}
