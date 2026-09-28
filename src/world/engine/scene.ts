/**
 * The world, drawn and walked: one map with its layers, the props and people
 * on it sorted by where their feet are, the hero and 兔儿爷, the camera, the
 * time of day, and input — tap, double tap, hold, pinch, keys (concept §4).
 *
 * No game rules here. What a tap means is decided in movement.ts; what a
 * step, a door or a conversation changes is the host's business (the page,
 * through core/save.ts). Loaded only on /play/world (boot.ts imports this
 * file after Phaser).
 */

import * as Phaser from 'phaser';
import { ahead } from '../core/grid';
import type { Facing, MapObject, PartOfDay, Tile } from '../core/types';
import { DAY_LOOK, zoomFor } from './look';
import { readMap, type MapInfo } from './mapdata';
import { DOUBLE_TAP_MS, facingTo, KEY_FACING, objectAt, pinchTo, planTap, RUN_MS, stepOnce, WALK_MS, type Plan } from './movement';

export const TILE = 16;
const ART = '/world/art';

/** What the scene tells the page, and asks of it. */
export interface WorldHost {
  /** the hero stepped onto a tile */
  onStep(tile: Tile, facing: Facing, running: boolean): void;
  /** the hero is beside a person, facing them */
  onTalk(npc: string, spot: string): void;
  /** the hero is beside a sign or a thing, facing it */
  onLook(object: MapObject): void;
  /** the hero stepped onto a door or off an edge */
  onDoor(door: Extract<MapObject, { kind: 'door' }>): void;
  /** M, B, Tab */
  onKey(key: 'map' | 'bag' | 'companion'): void;
  /** true while a dialogue or a panel is open: the world takes no input */
  isBusy(): boolean;
}

export interface SceneOptions {
  map: string;
  time: PartOfDay;
  hero: Tile;
  facing?: Facing;
  host?: WorldHost;
  onReady?: () => void;
}

interface TilesetNames {
  names: string[];
}

const idleHost: WorldHost = {
  onStep: () => undefined,
  onTalk: () => undefined,
  onLook: () => undefined,
  onDoor: () => undefined,
  onKey: () => undefined,
  isBusy: () => false,
};

export class WorldScene extends Phaser.Scene {
  private opts!: SceneOptions;
  private host: WorldHost = idleHost;
  info!: MapInfo;
  private hero!: Phaser.GameObjects.Sprite;
  private rabbit!: Phaser.GameObjects.Sprite;
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();

  /** where the hero stands (the tile, not the sprite mid-step) */
  private at: Tile = [0, 0];
  private facing: Facing = 'down';
  private queue: Tile[] = [];
  private after: Plan | null = null;
  private moving = false;
  private running = false;
  private stepFrame = 0;

  private baseZoom = 2;
  private lastTap = { time: 0, tile: [-1, -1] as Tile };
  private down: { x: number; y: number; time: number } | null = null;
  private holding = false;
  private holdTimer?: Phaser.Time.TimerEvent;
  private pinchStart: { dist: number; zoom: number } | null = null;
  private dots?: Phaser.GameObjects.Graphics;

  constructor() {
    super('world');
  }

  init(opts: SceneOptions) {
    this.opts = opts;
    this.host = opts.host ?? idleHost;
    this.at = [...opts.hero] as Tile;
    this.facing = opts.facing ?? 'down';
    this.queue = [];
    this.after = null;
    this.moving = false;
    this.npcSprites.clear();
  }

  preload() {
    this.load.image('tiles-set', `${ART}/tiles-set.png`);
    this.load.json('tiles-names', `${ART}/tiles-set.json`);
    this.load.atlas('chars', `${ART}/chars.png`, `${ART}/chars.json`);
    this.load.atlas('props', `${ART}/props.png`, `${ART}/props.json`);
    this.load.tilemapTiledJSON(this.opts.map, `/world/maps/${this.opts.map}.json`);
  }

  create() {
    const { map: key, time } = this.opts;
    const look = DAY_LOOK[time];
    const map = this.make.tilemap({ key });
    this.info = readMap(key, this.cache.tilemap.get(key).data);
    const tileset = map.addTilesetImage('tiles', 'tiles-set')!;
    const names = (this.cache.json.get('tiles-names') as TilesetNames).names.map((n) => n.replace(/^[^/]+\//, ''));
    const gid = (n: string) => names.indexOf(n) + 1;
    map.createLayer('ground', tileset, 0, 0)!.setDepth(0);
    const below = map.createLayer('below', tileset, 0, 0)!.setDepth(1);
    const above = map.createLayer('above', tileset, 0, 0)!.setDepth(10_000);
    if (look.lit) {
      for (const layer of [below, above]) {
        layer.replaceByIndex(gid('window'), gid('window-lit'));
        layer.replaceByIndex(gid('shop'), gid('shop-lit'));
      }
    }

    const glows: Array<{ x: number; y: number; color: number; r: number }> = [];
    const feet = (t: Tile) => ({ x: t[0] * TILE, y: (t[1] + 1) * TILE });
    for (const o of this.info.objects) {
      if (o.kind === 'prop') {
        let frame = o.frame;
        if (look.lit && frame === 'lantern/unlit') frame = 'lantern/lit-0';
        const { x, y } = feet(o.tile);
        const s = this.add.sprite(x, y, 'props', frame).setOrigin(0, 1).setDepth(y);
        if (look.lit && o.light) {
          glows.push({ x: x + s.width / 2, y: y - s.height / 2, color: Phaser.Display.Color.HexStringToColor(o.light).color, r: 28 });
          if (o.frame === 'lantern/unlit') {
            this.time.addEvent({
              delay: 260 + Math.random() * 200,
              loop: true,
              callback: () => s.setFrame(s.frame.name === 'lantern/lit-0' ? 'lantern/lit-1' : 'lantern/lit-0'),
            });
          }
        }
      } else if (o.kind === 'npc') {
        const { x, y } = feet(o.tile);
        const s = this.add.sprite(x, y + 3, 'chars', `${o.npc}/${o.facing ?? 'down'}-0`).setOrigin(0, 1).setDepth(y);
        this.npcSprites.set(o.id, s);
      } else if (o.kind === 'light' && look.lit) {
        const { x, y } = feet(o.tile);
        glows.push({ x: x + TILE / 2, y: y - TILE / 2, color: Phaser.Display.Color.HexStringToColor(o.color ?? '#fff1b3').color, r: o.radius ?? 32 });
      }
    }
    if (look.lit) {
      below.forEachTile((t) => {
        if (t.index === gid('window-lit') || t.index === gid('shop-lit')) glows.push({ x: t.pixelX + 8, y: t.pixelY + 10, color: 0xffd98a, r: 16 });
      });
    }

    const { x, y } = feet(this.at);
    this.hero = this.add.sprite(x, y + 3, 'chars', `hero/${this.facing}-0`).setOrigin(0, 1).setDepth(y + 0.5);
    this.rabbit = this.add.sprite(x + 12, y - 18, 'chars', 'rabbit/down-0').setOrigin(0, 1).setDepth(y + 0.6);
    // the bob is in the frames: 0 up, 1 down
    this.time.addEvent({
      delay: 450,
      loop: true,
      callback: () => {
        const f = this.facing === 'up' ? 'up' : this.facing;
        this.rabbit.setFrame(`rabbit/${f}-${this.rabbit.frame.name.endsWith('0') ? 1 : 0}`);
      },
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setRoundPixels(true);
    const fit = () => {
      this.baseZoom = zoomFor(this.scale.width, this.scale.height);
      cam.setZoom(this.baseZoom);
    };
    fit();
    this.scale.on('resize', fit);
    // A soft follow; roundPixels keeps the art on whole pixels while it glides.
    cam.startFollow(this.hero, true, 0.15, 0.15, -8, 16);

    if (look.tint !== 0xffffff) {
      this.add
        .rectangle(0, 0, map.widthInPixels, map.heightInPixels, look.tint)
        .setOrigin(0, 0)
        .setDepth(20_000)
        .setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    if (glows.length) {
      this.makeGlowTexture();
      for (const g of glows) {
        this.add
          .image(g.x, g.y, 'glow')
          .setDisplaySize(g.r * 2, g.r * 2)
          .setTint(g.color)
          .setAlpha(look.glow)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(20_001);
      }
    }
    this.dots = this.add.graphics().setDepth(9_999);
    this.bindInput();
    this.opts.onReady?.();
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.host.isBusy()) return;
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.startPinch();
        return;
      }
      this.down = { x: p.x, y: p.y, time: p.downTime };
      this.holding = false;
      this.holdTimer?.remove();
      this.holdTimer = this.time.delayedCall(320, () => {
        if (!this.down || this.pinchStart) return;
        this.holding = true;
        this.queue = [];
        this.after = null;
        this.holdStep();
      });
    });
    this.input.on('pointermove', () => {
      if (this.pinchStart) this.movePinch();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.holdTimer?.remove();
      if (this.pinchStart) {
        if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinchStart = null;
        this.down = null;
        return;
      }
      const d = this.down;
      this.down = null;
      if (!d || this.holding || this.host.isBusy()) {
        this.holding = false;
        return;
      }
      if (Math.hypot(p.x - d.x, p.y - d.y) > 12) return;
      this.tap(p.worldX, p.worldY, p.upTime);
    });

    const keys = this.input.keyboard;
    keys?.on('keydown', (e: KeyboardEvent) => {
      if (this.host.isBusy()) return;
      const f = KEY_FACING[e.key];
      if (f) {
        this.running = e.shiftKey;
        this.queue = [];
        this.after = null;
        if (!this.moving) this.keyStep(f);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') this.actAhead();
      else if (e.key === 'm' || e.key === 'M') this.host.onKey('map');
      else if (e.key === 'b' || e.key === 'B') this.host.onKey('bag');
      else if (e.key === 'Tab') {
        e.preventDefault();
        this.host.onKey('companion');
      }
    });
  }

  private tileAt(wx: number, wy: number): Tile {
    return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
  }

  private tap(wx: number, wy: number, time: number) {
    const tile = this.tileAt(wx, wy);
    const again = time - this.lastTap.time < DOUBLE_TAP_MS && Math.abs(tile[0] - this.lastTap.tile[0]) + Math.abs(tile[1] - this.lastTap.tile[1]) <= 1;
    this.lastTap = { time, tile };
    this.running = again;
    const plan = planTap(this.info.grid, this.info.objects, this.at, tile, this.occupied());
    this.queue = [...plan.path];
    this.after = plan.kind === 'walk' ? null : plan;
    this.showPath(plan.path);
    if (!this.moving) this.next();
  }

  private keyStep(f: Facing) {
    const s = stepOnce(this.info.grid, this.at, f, this.occupied());
    if (s.to) this.stepTo(s.to);
    else this.face(f);
  }

  private holdStep() {
    if (!this.holding || !this.down) return;
    const p = this.input.activePointer;
    const f = facingTo(this.at, p.worldX / TILE, p.worldY / TILE);
    if (!f) return;
    const s = stepOnce(this.info.grid, this.at, f, this.occupied());
    if (s.to) this.stepTo(s.to);
    else this.face(f);
  }

  private actAhead() {
    const o = objectAt(this.info.objects, ahead(this.at, this.facing));
    if (o?.kind === 'npc') this.host.onTalk(o.npc, o.id);
    else if (o) this.host.onLook(o);
  }

  private startPinch() {
    const [a, b] = [this.input.pointer1, this.input.pointer2];
    this.pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cameras.main.zoom };
    this.holdTimer?.remove();
    this.down = null;
  }

  private movePinch() {
    const [a, b] = [this.input.pointer1, this.input.pointer2];
    if (!this.pinchStart || !a.isDown || !b.isDown) return;
    const scale = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinchStart.dist);
    this.cameras.main.setZoom(pinchTo(this.baseZoom, (this.pinchStart.zoom / this.baseZoom) * scale));
  }

  private occupied(): Set<string> {
    const out = new Set<string>();
    for (const o of this.info.objects) if (o.kind === 'npc') out.add(`${o.tile[0]},${o.tile[1]}`);
    return out;
  }

  // ---------------------------------------------------------------- walking

  private showPath(path: Tile[]) {
    const g = this.dots!;
    g.clear();
    g.fillStyle(0xf8f5ec, 0.9);
    path.forEach(([x, y]) => {
      g.fillRect(x * TILE + 7, y * TILE + 9, 2, 2);
    });
    g.setAlpha(1);
    this.tweens.killTweensOf(g);
    this.tweens.add({ targets: g, alpha: 0, delay: 250, duration: 400 });
  }

  private face(f: Facing) {
    this.facing = f;
    this.hero.setFrame(`hero/${f}-0`);
  }

  private next() {
    const t = this.queue.shift();
    if (t) {
      this.stepTo(t);
      return;
    }
    this.moving = false;
    this.hero.setFrame(`hero/${this.facing}-0`);
    const plan = this.after;
    this.after = null;
    if (!plan || plan.kind === 'walk' || !plan.arrived) return;
    this.face(plan.facing);
    if (plan.kind === 'talk') this.host.onTalk(plan.npc, plan.spot);
    else this.host.onLook(plan.object);
  }

  private stepTo(t: Tile) {
    const dx = t[0] - this.at[0];
    const dy = t[1] - this.at[1];
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.at = t;
    this.moving = true;
    this.stepFrame = (this.stepFrame + 1) % 2;
    this.hero.setFrame(`hero/${this.facing}-${this.stepFrame + 1}`);
    const x = t[0] * TILE;
    const y = (t[1] + 1) * TILE;
    const ms = this.running ? RUN_MS : WALK_MS;
    this.hero.setDepth(Math.max(this.hero.depth, y + 0.5));
    this.tweens.add({
      targets: this.hero,
      x,
      y: y + 3,
      duration: ms,
      onUpdate: () => this.hero.setDepth(this.hero.y - 3 + 0.5),
      onComplete: () => {
        this.hero.setFrame(`hero/${this.facing}-0`);
        this.host.onStep(t, this.facing, this.running);
        const door = this.info.objects.find((o): o is Extract<MapObject, { kind: 'door' }> => o.kind === 'door' && o.tile[0] === t[0] && o.tile[1] === t[1]);
        if (door) {
          this.queue = [];
          this.after = null;
          this.moving = false;
          this.host.onDoor(door);
          return;
        }
        if (this.holding) {
          this.moving = false;
          this.holdStep();
          return;
        }
        this.next();
      },
    });
    // 兔儿爷 floats after, a little behind
    this.tweens.add({ targets: this.rabbit, x: x + 12, duration: ms * 1.6, ease: 'Sine.easeOut' });
    this.rabbit.setDepth(y + 0.6);
    this.tweens.add({ targets: this.rabbit, y: y - 18, duration: ms * 1.6, ease: 'Sine.easeOut' });
  }

  private makeGlowTexture() {
    if (this.textures.exists('glow')) return;
    const size = 64;
    const tex = this.textures.createCanvas('glow', size, size)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }
}
