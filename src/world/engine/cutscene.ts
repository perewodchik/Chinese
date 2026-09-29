/**
 * Plays a cutscene (§13 K1) on the running map: walks by A*, turns, feelings,
 * the camera, fades, particles. Lines, the chapter card, 弹幕 and the seal
 * are the page's (DOM text stays crisp and tappable) — the runner asks for
 * them through `CutsceneHooks` and waits.
 *
 * Skipping never leaves the world half-way: from the skip on, every step is
 * done at once (a walk ends on its last tile, a wait is over), so the map
 * looks as the script meant it to at the end.
 */

import type * as Phaser from 'phaser';
import { findPath, type Grid } from '../core/grid';
import { isSpiritActor, TIMING, type Actor, type CutMusic, type CutSound, type Cutscene, type CutStep, type Fx } from '../core/cutscene';
import type { Facing, Tile } from '../core/types';
import { SPIRIT_FRAMES } from './spiritFrames';

const TILE = 16;

/** What the page does for a cutscene. */
export interface CutsceneHooks {
  /** show a line (read-only box); resolves when the player taps on (or on skip) */
  say(line: { actor: Actor; zh?: string; en: string; pinyin?: string }): Promise<void>;
  /** the chapter card; resolves when it has been shown */
  title(t: { zh: string; en: string }): Promise<void>;
  /** 弹幕 across the screen, or the red seal */
  overlay(fx: 'danmaku' | 'seal' | 'lantern', text?: string[]): void;
  sound(id: CutSound): void;
  music(m: CutMusic): void;
}

/** What the runner needs of the map (the scene gives it). */
export interface Stage {
  scene: Phaser.Scene;
  grid: Grid;
  /** the sprite of an actor on the map now, or null */
  sprite(a: Actor): Phaser.GameObjects.Sprite | null;
  /** the atlas prefix for walking frames (`hero`, `auntie` …), null for a thing that does not walk (a spirit) */
  frames(a: Actor): string | null;
  tile(a: Actor): Tile | null;
  setTile(a: Actor, t: Tile, facing?: Facing): void;
  spawn(a: Actor, at: Tile, facing: Facing): void;
  despawn(a: Actor): void;
  /** a prop's picture for the rest of the visit (a map reload draws it from the save again) */
  prop(id: string, frame: string): void;
  /** the camera: follow a sprite or pan to a point, at a zoom step (1 = the usual) */
  camera(to: Phaser.GameObjects.Sprite | { x: number; y: number }, ms: number, zoom: number): Promise<void>;
  /** put things as they were: the camera on the hero, spawned actors gone, people back in place */
  restore(): void;
}

export interface RunningCutscene {
  done: Promise<void>;
  /** jump to the end: the rest happens at once */
  skip(): void;
}

const facingOf = (from: Tile, to: Tile): Facing => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
};

const isTile = (v: unknown): v is Tile => Array.isArray(v) && v.length === 2;

export function runCutscene(stage: Stage, cs: Cutscene, hooks: CutsceneHooks): RunningCutscene {
  const { scene } = stage;
  let skipping = false;
  let wake: (() => void) | null = null;
  const tweens = new Set<Phaser.Tweens.Tween>();

  /** a pause that a skip cuts short */
  const wait = (ms: number) =>
    skipping || ms <= 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const ev = scene.time.delayedCall(ms, () => {
            wake = null;
            resolve();
          });
          wake = () => {
            ev.remove(false);
            wake = null;
            resolve();
          };
        });

  const tween = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
    new Promise<void>((resolve) => {
      if (skipping) {
        const targets = (Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets]) as Record<string, unknown>[];
        for (const t of targets) for (const k of ['x', 'y', 'alpha', 'scale'] as const) if (typeof cfg[k] === 'number') t[k] = cfg[k];
        resolve();
        return;
      }
      const t = scene.tweens.add({
        ...cfg,
        onComplete: (...args) => {
          tweens.delete(t);
          (cfg.onComplete as ((...a: unknown[]) => void) | undefined)?.(...args);
          resolve();
        },
      });
      tweens.add(t);
    });

  const feet = (t: Tile) => ({ x: t[0] * TILE, y: (t[1] + 1) * TILE + 3 });
  const centre = (t: Tile) => ({ x: t[0] * TILE + TILE / 2, y: t[1] * TILE + TILE / 2 });
  const at = (a: Tile | Actor): { x: number; y: number } | null => {
    if (isTile(a)) return centre(a);
    const s = stage.sprite(a);
    return s ? { x: s.x + s.width / 2, y: s.y - s.height / 2 } : null;
  };

  const face = (a: Actor, f: Facing) => {
    const s = stage.sprite(a);
    const pre = stage.frames(a);
    if (s && pre) s.setFrame(`${pre}/${f}-0`);
    const t = stage.tile(a);
    if (t) stage.setTile(a, t, f);
  };

  const walk = async (a: Actor, to: Tile | Tile[], speed: 'walk' | 'run' | 'slow' = 'walk') => {
    const s = stage.sprite(a);
    const from = stage.tile(a);
    if (!s || !from) return;
    const path = isTile(to) ? (findPath(stage.grid, from, [to]) ?? [to]) : to;
    const ms = speed === 'run' ? TIMING.runMs : speed === 'slow' ? TIMING.slowMs : TIMING.walkMs;
    const pre = stage.frames(a);
    let prev = from;
    let step = 0;
    let last: Facing = 'down';
    for (const t of path) {
      if (t[0] === prev[0] && t[1] === prev[1]) continue;
      const f = facingOf(prev, t);
      last = f;
      step = (step + 1) % 2;
      if (pre && !skipping) s.setFrame(`${pre}/${f}-${step + 1}`);
      const { x, y } = feet(t);
      await tween({ targets: s, x, y, duration: ms, onUpdate: () => s.setDepth(s.y - 3 + 0.5) });
      s.setDepth(s.y - 3 + 0.5);
      stage.setTile(a, t, f);
      prev = t;
    }
    if (pre && prev !== from) s.setFrame(`${pre}/${last}-0`);
  };

  const fx = (kind: Fx, where: Tile | Actor | undefined, n = 16, text?: string[]) => {
    if (kind === 'danmaku' || kind === 'seal' || kind === 'lantern') return hooks.overlay(kind, text);
    if (skipping) return;
    const cam = scene.cameras.main;
    const p = where ? at(where) : { x: cam.midPoint.x, y: cam.midPoint.y };
    if (!p) return;
    const cfg = FX[kind];
    const e = scene.add
      .particles(p.x, p.y, `fx-${cfg.tex}`, {
        lifespan: cfg.life,
        speed: cfg.speed,
        angle: cfg.angle,
        gravityY: cfg.gravity,
        scale: cfg.scale,
        alpha: { start: 1, end: 0 },
        tint: cfg.tint,
        blendMode: cfg.add ? 'ADD' : 'NORMAL',
        emitting: false,
        ...(cfg.wide ? { x: { min: -cam.worldView.width / 2, max: cam.worldView.width / 2 }, y: -cam.worldView.height / 2 } : {}),
      })
      .setDepth(20_004);
    e.explode(Math.min(n, cfg.max));
    scene.time.delayedCall(cfg.life + 200, () => e.destroy());
  };

  const one = async (s: CutStep): Promise<void> => {
    if ('together' in s) {
      await Promise.all(s.together.map(one));
      return;
    }
    if ('camera' in s) {
      const target = isTile(s.camera) ? centre(s.camera) : stage.sprite(s.camera);
      if (target) await stage.camera(target, skipping ? 0 : (s.ms ?? TIMING.cameraMs), s.zoom ?? 1);
      return;
    }
    if ('move' in s) return walk(s.move, s.to, s.speed);
    if ('fly' in s) {
      const sp = stage.sprite(s.fly);
      if (!sp) return;
      sp.setDepth(20_003);
      await tween({ targets: sp, x: sp.x + s.by[0] * TILE, y: sp.y + s.by[1] * TILE, duration: s.ms ?? 1200, ease: 'Quad.easeIn' });
      return;
    }
    if ('face' in s) return face(s.face, s.dir);
    if ('prop' in s) return stage.prop(s.prop, s.frame);
    if ('emote' in s) {
      const sp = stage.sprite(s.emote);
      if (sp && !skipping) {
        const key = s.kind === 'surprised' ? 'emote/proud' : `emote/${s.kind}`;
        const e = scene.add.sprite(sp.x + sp.width / 2, sp.y - sp.height - 2, 'props', key).setOrigin(0.5, 1).setDepth(20_003).setScale(0.6);
        scene.tweens.add({ targets: e, scale: 1, duration: 160, ease: 'Back.easeOut' });
        scene.time.delayedCall(1600, () => scene.tweens.add({ targets: e, alpha: 0, duration: 250, onComplete: () => e.destroy() }));
      }
      return;
    }
    if ('say' in s) {
      if (skipping) return;
      await hooks.say({ actor: s.say, en: s.en, ...(s.zh ? { zh: s.zh } : {}), ...(s.pinyin ? { pinyin: s.pinyin } : {}) });
      return;
    }
    if ('wait' in s) return wait(s.wait);
    if ('fade' in s) {
      const cam = scene.cameras.main;
      const c = Number.parseInt((s.colour ?? '#22202e').slice(1), 16);
      const [r, g, b] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
      const ms = skipping ? 0 : (s.ms ?? TIMING.fadeMs);
      if (s.fade === 'out') cam.fadeOut(ms, r, g, b);
      else cam.fadeIn(ms, r, g, b);
      return wait(ms);
    }
    if ('flash' in s) {
      if (!skipping) scene.cameras.main.flash(TIMING.flashMs, 255, 250, 235);
      return wait(TIMING.flashMs);
    }
    if ('shake' in s) {
      if (!skipping) scene.cameras.main.shake(s.shake, 0.004);
      return wait(s.shake);
    }
    if ('title' in s) {
      if (skipping) return;
      await hooks.title(s.title);
      return;
    }
    if ('fx' in s) return fx(s.fx, s.at, s.n, s.text);
    if ('sound' in s) {
      if (!skipping) hooks.sound(s.sound);
      return;
    }
    if ('music' in s) return hooks.music(s.music);
    if ('spawn' in s) return stage.spawn(s.spawn, s.at, s.facing ?? 'down');
    if ('despawn' in s) {
      const sp = stage.sprite(s.despawn);
      if (sp && !skipping) await tween({ targets: sp, alpha: 0, duration: 250 });
      stage.despawn(s.despawn);
    }
  };

  const done = (async () => {
    makeFxTextures(scene);
    if (cs.music) hooks.music(cs.music);
    for (const c of cs.cast ?? []) {
      if (stage.sprite(c.actor)) stage.setTile(c.actor, c.at, c.facing);
      else stage.spawn(c.actor, c.at, c.facing ?? 'down');
    }
    try {
      for (const s of cs.steps) await one(s);
    } finally {
      scene.cameras.main.resetFX();
      stage.restore();
      hooks.music('on');
    }
  })();

  return {
    done,
    skip: () => {
      if (skipping) return;
      skipping = true;
      for (const t of tweens) t.complete();
      tweens.clear();
      wake?.();
    },
  };
}

// --- particles: tiny textures made once, the looks of each effect -------------

interface FxLook {
  tex: 'dot' | 'petal' | 'flake' | 'lantern' | 'smoke' | 'spark';
  life: number;
  speed: { min: number; max: number };
  angle: { min: number; max: number };
  gravity: number;
  scale: { start: number; end: number };
  tint: number | number[];
  add?: boolean;
  wide?: boolean;
  max: number;
}

const FX: Record<Exclude<Fx, 'danmaku' | 'seal' | 'lantern'>, FxLook> = {
  sparkle: { tex: 'spark', life: 900, speed: { min: 20, max: 60 }, angle: { min: 0, max: 360 }, gravity: -10, scale: { start: 1, end: 0.2 }, tint: [0xfff1b3, 0xffffff, 0xffd98a], add: true, max: 40 },
  petals: { tex: 'petal', life: 3000, speed: { min: 10, max: 30 }, angle: { min: 60, max: 120 }, gravity: 12, scale: { start: 1, end: 0.8 }, tint: [0xf2a7b8, 0xffd1dc], wide: true, max: 60 },
  snow: { tex: 'flake', life: 4000, speed: { min: 8, max: 20 }, angle: { min: 80, max: 100 }, gravity: 8, scale: { start: 1, end: 1 }, tint: 0xffffff, wide: true, max: 80 },
  'lanterns-rise': { tex: 'lantern', life: 5000, speed: { min: 12, max: 26 }, angle: { min: 255, max: 285 }, gravity: -4, scale: { start: 1, end: 0.6 }, tint: 0xffffff, add: false, max: 40 },
  fireworks: { tex: 'spark', life: 1200, speed: { min: 60, max: 110 }, angle: { min: 0, max: 360 }, gravity: 40, scale: { start: 1.2, end: 0 }, tint: [0xff5a4e, 0xffd23f, 0x7ad3ff, 0xb9ff8a], add: true, max: 80 },
  butterflies: { tex: 'petal', life: 3500, speed: { min: 14, max: 30 }, angle: { min: 200, max: 340 }, gravity: -2, scale: { start: 1, end: 1 }, tint: [0xdfe8ff, 0xffffff], add: true, max: 20 },
  incense: { tex: 'smoke', life: 3000, speed: { min: 4, max: 10 }, angle: { min: 260, max: 280 }, gravity: -6, scale: { start: 0.6, end: 1.6 }, tint: 0xd9d4cc, max: 30 },
};

function makeFxTextures(scene: Phaser.Scene) {
  const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h)!;
    draw(t.getContext());
    t.refresh();
  };
  const px = (c: CanvasRenderingContext2D, colour: string, pts: [number, number][]) => {
    c.fillStyle = colour;
    for (const [x, y] of pts) c.fillRect(x, y, 1, 1);
  };
  make('fx-dot', 2, 2, (c) => px(c, '#ffffff', [[0, 0], [1, 0], [0, 1], [1, 1]]));
  make('fx-spark', 3, 3, (c) => px(c, '#ffffff', [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]));
  make('fx-petal', 3, 2, (c) => px(c, '#ffffff', [[1, 0], [2, 0], [0, 1], [1, 1]]));
  make('fx-flake', 2, 2, (c) => px(c, '#ffffff', [[0, 0], [1, 1]]));
  make('fx-smoke', 4, 4, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(1, 0, 2, 4);
    c.fillRect(0, 1, 4, 2);
  });
  // a sky lantern: red body, a warm glow at the bottom
  make('fx-lantern', 4, 6, (c) => {
    c.fillStyle = '#d8423a';
    c.fillRect(0, 0, 4, 5);
    c.fillStyle = '#ffd98a';
    c.fillRect(1, 4, 2, 2);
    c.fillStyle = '#a32f2a';
    c.fillRect(0, 0, 4, 1);
  });
}

/** A spirit's frame, or a lit lantern for one not drawn yet (V4 draws the rest). */
export const spiritFrame = (a: Actor) => (isSpiritActor(a) ? (SPIRIT_FRAMES[a.slice(7)] ?? 'lantern/lit-0') : null);
