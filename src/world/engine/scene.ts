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
import { edgeAt, resolveArrival, throughEdge, type Arrival, type Door } from './doors';
import { crowdTrip, facingOf, idleNext, PASSERS, pigeonSpots, rand, scared, type Rand } from './life';
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
  /** the hero stepped onto a door: the page checks it and calls travel() */
  onDoor(door: Door): void;
  /** the hero stepped onto an edge exit */
  onEdge(to: Arrival): void;
  /** a map is on screen with the hero on it (after a start or a travel) */
  onArrive(info: MapInfo, tile: Tile, facing: Facing): void;
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
  /** who stands on this map now (core/cast.ts); without it, the map's own spawns */
  cast?: (info: MapInfo) => MapObject[];
  /** npc id → sprite frame prefix (the card's look); without it the id is the sprite */
  looks?: Record<string, string>;
}

interface TilesetNames {
  names: string[];
}

const idleHost: WorldHost = {
  onStep: () => undefined,
  onTalk: () => undefined,
  onLook: () => undefined,
  onDoor: () => undefined,
  onEdge: () => undefined,
  onArrive: () => undefined,
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
  /** the on-screen joystick's direction while it is held */
  private stick: Facing | null = null;
  private stepFrame = 0;

  private baseZoom = 2;
  private lastTap = { time: 0, tile: [-1, -1] as Tile };
  private down: { x: number; y: number; time: number } | null = null;
  private holding = false;
  private holdTimer?: Phaser.Time.TimerEvent;
  private pinchStart: { dist: number; zoom: number } | null = null;
  private dots?: Phaser.GameObjects.Graphics;
  private rng: Rand = rand(1);
  private gid: (name: string) => number = () => 0;
  private lightLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private lanterns: Phaser.GameObjects.Sprite[] = [];
  /** props with a frame of their own after dark (the stone lion's eyes): sprite, day frame, night frame */
  private nightProps: Array<[Phaser.GameObjects.Sprite, string, string]> = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private shade?: Phaser.GameObjects.Rectangle;
  private lit = false;
  private weather?: Phaser.GameObjects.Particles.ParticleEmitter;
  private pigeons: Array<{ s: Phaser.GameObjects.Sprite; tile: Tile; gone: boolean }> = [];

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
    const { map: key } = this.opts;
    const map = this.make.tilemap({ key });
    this.info = readMap(key, this.cache.tilemap.get(key).data);
    if (this.opts.cast) this.info = { ...this.info, objects: this.opts.cast(this.info) };
    this.at = resolveArrival(this.at, this.info.width, this.info.height);
    const tileset = map.addTilesetImage('tiles', 'tiles-set')!;
    const names = (this.cache.json.get('tiles-names') as TilesetNames).names.map((n) => n.replace(/^[^/]+\//, ''));
    this.gid = (n: string) => names.indexOf(n) + 1;
    map.createLayer('ground', tileset, 0, 0)!.setDepth(0);
    this.lightLayers = [
      map.createLayer('below', tileset, 0, 0)!.setDepth(1) as Phaser.Tilemaps.TilemapLayer,
      map.createLayer('above', tileset, 0, 0)!.setDepth(10_000) as Phaser.Tilemaps.TilemapLayer,
    ];
    this.lanterns = [];
    this.nightProps = [];
    this.glows = [];
    this.makeGlowTexture();
    const glow = (x: number, y: number, color: number, r: number) =>
      this.glows.push(this.add.image(x, y, 'glow').setDisplaySize(r * 2, r * 2).setTint(color).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(20_001));

    const feet = (t: Tile) => ({ x: t[0] * TILE, y: (t[1] + 1) * TILE });
    for (const o of this.info.objects) {
      if (o.kind === 'prop') {
        const { x, y } = feet(o.tile);
        const s = this.add.sprite(x, y, 'props', o.frame).setOrigin(0, 1).setDepth(y);
        if (o.frame === 'lantern/unlit') this.lanterns.push(s);
        if (o.night) this.nightProps.push([s, o.frame, o.night]);
        if (o.light) glow(x + s.width / 2, y - s.height / 2, Phaser.Display.Color.HexStringToColor(o.light).color, 28);
      } else if (o.kind === 'npc') {
        const { x, y } = feet(o.tile);
        const s = this.add.sprite(x, y + 3, 'chars', `${this.opts.looks?.[o.npc] ?? o.npc}/${o.facing ?? 'down'}-0`).setOrigin(0, 1).setDepth(y);
        this.npcSprites.set(o.id, s);
      } else if (o.kind === 'light') {
        const { x, y } = feet(o.tile);
        glow(x + TILE / 2, y - TILE / 2, Phaser.Display.Color.HexStringToColor(o.color ?? '#fff1b3').color, o.radius ?? 32);
      }
    }
    // Windows and shop fronts glow once they are lit.
    this.lightLayers[0]!.forEachTile((t) => {
      if ([this.gid('window'), this.gid('shop')].includes(t.index)) glow(t.pixelX + 8, t.pixelY + 10, 0xffd98a, 16);
    });
    this.time.addEvent({
      delay: 320,
      loop: true,
      callback: () => {
        if (!this.lit) return;
        for (const s of this.lanterns) if (Math.random() < 0.5) s.setFrame(s.frame.name === 'lantern/lit-0' ? 'lantern/lit-1' : 'lantern/lit-0');
      },
    });

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
    cam.setRoundPixels(true);
    const fit = () => {
      this.baseZoom = zoomFor(this.scale.width, this.scale.height);
      cam.setZoom(this.baseZoom);
      this.frameBounds();
    };
    fit();
    this.scale.on('resize', fit);
    // A soft follow; roundPixels keeps the art on whole pixels while it glides.
    cam.startFollow(this.hero, true, 0.15, 0.15, -8, 16);

    this.shade = this.add
      .rectangle(0, 0, map.widthInPixels, map.heightInPixels, 0xffffff)
      .setOrigin(0, 0)
      .setDepth(20_000)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.setTime(this.opts.time, false);
    this.dots = this.add.graphics().setDepth(9_999);
    this.bindInput();
    this.startLife();
    cam.fadeIn(180, 34, 32, 46);
    this.host.onArrive(this.info, this.at, this.facing);
    this.opts.onReady?.();
  }

  /**
   * The part of the day: the colour over everything, lamps and windows lit
   * or not. Changes softly (a few seconds) unless `soft` is false.
   */
  setTime(time: PartOfDay, soft = true) {
    const look = DAY_LOOK[time];
    this.opts = { ...this.opts, time };
    const shade = this.shade!;
    const from = Phaser.Display.Color.IntegerToColor(shade.fillColor);
    const to = Phaser.Display.Color.IntegerToColor(look.tint);
    if (soft) {
      this.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 3000,
        onUpdate: (tw) => {
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue() ?? 0);
          shade.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        },
      });
    } else shade.setFillStyle(look.tint);
    shade.setVisible(true);
    this.lit = look.lit;
    const [on, off] = look.lit ? ['-lit', ''] : ['', '-lit'];
    for (const layer of this.lightLayers) {
      if (!this.gid('window') || !this.gid('window-lit')) break;
      layer.replaceByIndex(this.gid(`window${off}`), this.gid(`window${on}`));
      layer.replaceByIndex(this.gid(`shop${off}`), this.gid(`shop${on}`));
    }
    for (const s of this.lanterns) s.setFrame(look.lit ? 'lantern/lit-0' : 'lantern/unlit');
    for (const [s, day, night] of this.nightProps) s.setFrame(look.lit ? night : day);
    for (const g of this.glows) {
      if (soft) this.tweens.add({ targets: g, alpha: look.glow, duration: 2000 });
      else g.setAlpha(look.glow);
    }
  }

  /**
   * The weather hook (off for now): rain or snow falling over the view.
   * Nothing calls it yet; seasons may later.
   */
  setWeather(kind: 'none' | 'rain' | 'snow') {
    this.weather?.destroy();
    this.weather = undefined;
    if (kind === 'none') return;
    const key = `weather-${kind}`;
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, kind === 'rain' ? 1 : 2, kind === 'rain' ? 4 : 2)!;
      const ctx = t.getContext();
      ctx.fillStyle = kind === 'rain' ? 'rgba(200,220,255,0.7)' : 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, 0, t.width, t.height);
      t.refresh();
    }
    const cam = this.cameras.main;
    this.weather = this.add
      .particles(0, 0, key, {
        x: { min: 0, max: cam.width },
        y: -8,
        lifespan: kind === 'rain' ? 900 : 5000,
        speedY: kind === 'rain' ? { min: 260, max: 320 } : { min: 18, max: 36 },
        speedX: kind === 'rain' ? -30 : { min: -10, max: 10 },
        quantity: kind === 'rain' ? 4 : 1,
        frequency: kind === 'rain' ? 30 : 120,
      })
      .setScrollFactor(0)
      .setDepth(20_002);
  }

  /** Off to another map: a short fade, then the scene starts again there. */
  travel(to: Arrival) {
    this.queue = [];
    this.after = null;
    this.holding = false;
    this.input.enabled = false;
    const cam = this.cameras.main;
    cam.fadeOut(180, 34, 32, 46);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.input.enabled = true;
      // Only the map on screen stays in memory; the atlases are shared and small.
      if (to.map !== this.opts.map) this.cache.tilemap.remove(this.opts.map);
      this.scene.restart({ ...this.opts, map: to.map, hero: to.tile, facing: to.facing });
    });
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

  /** The on-screen joystick (E6): walk that way while held, step by step; null lets go. */
  setStick(f: Facing | null, run = false) {
    this.stick = f;
    if (!f || this.host.isBusy()) return;
    this.running = run;
    this.queue = [];
    this.after = null;
    if (!this.moving) this.keyStep(f);
  }

  /** The joystick's action button: talk to or look at what is ahead, as Space does. */
  act() {
    if (!this.host.isBusy() && !this.moving) this.actAhead();
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
    this.frameBounds();
  }

  /**
   * The camera stays on the map; a map smaller than the screen (a room, a
   * shop) sits in the middle of it rather than in the top-left corner.
   */
  private frameBounds() {
    const cam = this.cameras.main;
    const [w, h] = [this.info.width * TILE, this.info.height * TILE];
    const [vw, vh] = [cam.width / cam.zoom, cam.height / cam.zoom];
    const [bw, bh] = [Math.max(w, vw), Math.max(h, vh)];
    cam.setBounds(Math.round((w - bw) / 2), Math.round((h - bh) / 2), Math.round(bw), Math.round(bh));
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
        this.scarePigeons();
        const door = this.info.objects.find((o): o is Door => o.kind === 'door' && o.tile[0] === t[0] && o.tile[1] === t[1]);
        const edge = door ? undefined : edgeAt(this.info.objects, t, this.info.width, this.info.height);
        if (door || edge) {
          this.queue = [];
          this.after = null;
          this.moving = false;
          if (door) this.host.onDoor(door);
          else this.host.onEdge(throughEdge(edge!, t));
          return;
        }
        if (this.stick && !this.host.isBusy()) {
          this.moving = false;
          this.keyStep(this.stick);
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

  // ---------------------------------------------------------------- life (D5)

  private startLife() {
    this.rng = rand(Math.floor(Math.random() * 1e9));
    this.pigeons = [];
    for (const s of this.npcSprites.values()) this.idle(s);
    const { crowd, pigeons, bikes } = this.info.life;
    for (let i = 0; i < crowd; i++) this.time.delayedCall(this.rng() * 6000, () => this.passerBy(false));
    for (let i = 0; i < bikes; i++) this.time.delayedCall(2000 + this.rng() * 8000, () => this.passerBy(true));
    for (const t of pigeonSpots(this.info.grid, this.rng, pigeons)) this.addPigeon(t);
  }

  /** Someone standing about: now and then they blink or look another way. */
  private idle(s: Phaser.GameObjects.Sprite) {
    const [base, dir] = s.frame.name.split('/');
    let facing = (dir?.split('-')[0] ?? 'down') as Facing;
    const loop = () => {
      const n = idleNext(this.rng, facing);
      this.time.delayedCall(n.after, () => {
        if (!s.active) return;
        if (n.act === 'blink' && facing === 'down') {
          s.setFrame(`${base}/down-blink`);
          this.time.delayedCall(140, () => s.active && s.setFrame(`${base}/${facing}-0`));
        } else if (n.act === 'turn') {
          facing = n.facing;
          s.setFrame(`${base}/${facing}-0`);
        }
        loop();
      });
    };
    loop();
  }

  /** A passer-by (or a cyclist) crosses the map, then another comes a while later. */
  private passerBy(bike: boolean) {
    if (!this.scene.isActive()) return;
    const trip = crowdTrip(this.info.grid, this.rng);
    const again = () => this.time.delayedCall(3000 + this.rng() * 9000, () => this.passerBy(bike));
    if (!trip) return;
    const look = bike ? 'rider' : PASSERS[Math.floor(this.rng() * PASSERS.length)]!;
    const [x0, y0] = trip[0]!;
    const s = this.add.sprite(x0 * TILE, (y0 + 1) * TILE + 3, 'chars', `${look}/down-0`).setOrigin(0, 1);
    const ms = bike ? RUN_MS * 0.8 : WALK_MS * 1.3;
    let i = 1;
    let step = 0;
    const go = () => {
      const t = trip[i];
      if (!t || !s.active) {
        s.destroy();
        again();
        return;
      }
      const f = facingOf(trip[i - 1]!, t);
      step = (step + 1) % 2;
      s.setFrame(`${look}/${f}-${bike ? 1 : step + 1}`);
      this.tweens.add({
        targets: s,
        x: t[0] * TILE,
        y: (t[1] + 1) * TILE + 3,
        duration: ms,
        onUpdate: () => s.setDepth(s.y - 3),
        onComplete: () => {
          i++;
          go();
        },
      });
    };
    go();
  }

  private addPigeon(t: Tile) {
    const s = this.add.sprite(t[0] * TILE + 4 + Math.floor(this.rng() * 6), (t[1] + 1) * TILE - 2, 'props', 'pigeon/peck').setOrigin(0, 1);
    s.setDepth(s.y).setFlipX(this.rng() < 0.5);
    const bird = { s, tile: t, gone: false };
    this.pigeons.push(bird);
    this.time.addEvent({
      delay: 500 + this.rng() * 700,
      loop: true,
      callback: () => !bird.gone && s.setFrame(s.frame.name === 'pigeon/peck' ? 'pigeon/look' : 'pigeon/peck'),
    });
  }

  /** Pigeons near the hero take off, and settle somewhere else later. */
  private scarePigeons() {
    for (const bird of this.pigeons) {
      if (bird.gone || !scared(bird.tile, this.at)) continue;
      bird.gone = true;
      const away = bird.s.x < this.hero.x ? -1 : 1;
      const flap = this.time.addEvent({ delay: 90, loop: true, callback: () => bird.s.setFrame(bird.s.frame.name === 'pigeon/fly-0' ? 'pigeon/fly-1' : 'pigeon/fly-0') });
      bird.s.setDepth(9_000).setFlipX(away < 0);
      this.tweens.add({
        targets: bird.s,
        x: bird.s.x + away * 140,
        y: bird.s.y - 120,
        duration: 1400,
        ease: 'Quad.easeIn',
        onComplete: () => {
          flap.remove();
          bird.s.destroy();
          this.time.delayedCall(8000 + this.rng() * 8000, () => {
            const [spot] = pigeonSpots(this.info.grid, this.rng, 1);
            if (spot && !scared(spot, this.at)) this.addPigeon(spot);
          });
        },
      });
    }
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
