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
import { ahead, findPath, walkable, walkTo } from '../core/grid';
import { trailGoals, type TrailSpec } from '../core/guide';
import { rabbitSpot } from '../core/rabbit';
import type { Facing, MapObject, PartOfDay, Tile } from '../core/types';
import { composeHero, DAY_LOOK, zoomFor, type HeroDress } from './look';
import { isExtra, isSpiritActor, type Actor, type Cutscene } from '../core/cutscene';
import { frameAt, IDLE_THINGS, PROP_ANIMS, TILE_ANIMS, type Anim, type IdleAction } from '../art/anims';
import { runCutscene, spiritFrame, type CutsceneHooks, type RunningCutscene, type Stage } from './cutscene';
import { edgeAt, resolveArrival, throughEdge, type Arrival, type Door } from './doors';
import { crowdTrip, facingOf, idleNext, PASSERS, pigeonSpots, rand, scared, type Rand } from './life';
import { readMap, type MapInfo } from './mapdata';
import { DOUBLE_TAP_MS, facingTo, KEY_FACING, objectAt, pinchTo, pinchZooms, planTap, RUN_MS, stepOnce, WALK_MS, type Plan } from './movement';

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
  /** the hero walked into a station's ticket gates, from above (the street side) or below (the platform) */
  onGate?(tile: Tile, fromAbove: boolean): void;
  /** the hero walked up to the tracks on a platform: choose a train */
  onBoard?(): void;
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
  /** on a shared bike: faster, a bicycle under the hero */
  bike?: boolean;
  /** what falls from the sky today (X4); it only shows on maps out of doors */
  sky?: 'none' | 'rain' | 'snow';
  /** 兔儿爷's hat for the day (X7) */
  hat?: 'none' | 'snow' | 'flower' | 'armour';
  /** the silver butterflies (X11): after dark they circle you with a little light */
  butterflies?: () => boolean;
  /** whether the named 胡同 cat walks a step behind you on a map (X5) */
  pet?: (map: string) => boolean;
  /** §13 V3: the season (leaves in autumn, snow on the roofs in winter, 柳絮 in spring) */
  season?: 'spring' | 'summer' | 'autumn' | 'winter';
  /** §13 V3: what each person does while they stand about, by npc id (their card's `idle`) */
  idles?: Record<string, IdleAction>;
  /** the player's own look and clothes (W1), read at every map; the plain atlas hero without it */
  dress?: () => HeroDress | null;
  /** the "show what I can use" setting: which people and things get a small mark over them; off without it */
  hints?: ((o: MapObject) => boolean) | null;
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
  /** his side of you, as a step from your tile; null on your shoulder */
  private rabbitAt: Tile | null = null;
  private pet: Phaser.GameObjects.Sprite | null = null;
  /** 兔儿爷's hat for the day and the feeling over his head (X7) */
  private hat: Phaser.GameObjects.Sprite | null = null;
  private emote: Phaser.GameObjects.Sprite | null = null;
  private blush: Phaser.GameObjects.Sprite | null = null;
  private flies: { sprite: Phaser.GameObjects.Sprite; light: Phaser.GameObjects.Image; phase: number }[] = [];
  private petRight = false;
  /** the shared bike under the hero, while riding one */
  private bikeSprite: Phaser.GameObjects.Sprite | null = null;
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private propSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** the marks over what can be talked to or looked at, by object id */
  private hintMarks = new Map<string, Phaser.GameObjects.Image>();
  /** M6 "Take me there": what the footprints on this map lead to, and the prints drawn */
  private trailTo: TrailSpec | null = null;
  private prints: Phaser.GameObjects.Image[] = [];
  /** the tiles the prints are on, you excluded (for the guide probe) */
  private trailPath: Tile[] = [];
  /** a cutscene is playing: no prints until it is over */
  private inCut = false;
  /** §13 Q1: the quest marks over people (red 「!」, gold 「!」, 「…」), by object id, and what each shows */
  private questTags = new Map<string, { img: Phaser.GameObjects.Image; kind: string }>();

  /** where the hero stands (the tile, not the sprite mid-step) */
  private at: Tile = [0, 0];
  private facing: Facing = 'down';
  private queue: Tile[] = [];
  private after: Plan | null = null;
  private moving = false;
  private running = false;
  /** the on-screen joystick's direction while it is held */
  private stick: Facing | null = null;
  /** arrow / WASD keys held down, the latest last: the hero keeps walking while one is held */
  private held: Facing[] = [];
  /** the row of ticket gates on a station map, if there is one */
  private gateRow: number | null = null;
  /** a walk that ends by going through the gates at this tile */
  private afterGate: Tile | null = null;
  /** a walk that ends at the platform edge, choosing a train */
  private afterBoard = false;
  private shift = false;
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
  /** §13 V3: everything the one clock turns — props, the things people hold, crows, puddles */
  private turning: Array<{ s: Phaser.GameObjects.Sprite; a: Anim; phase: number; at?: Tile }> = [];
  /** §13 V3: animated tiles (water, the escalator) by animation, each tile with its own phase */
  private tileMoves: Array<{ a: Anim; gids: number[]; tiles: Array<{ t: Phaser.Tilemaps.Tile; phase: number }> }> = [];
  /** §13 V3: people who move as they idle (太极, dancing): their sprite, their frames' prefix, the move */
  private bodyMoves: Array<{ s: Phaser.GameObjects.Sprite; base: string; kind: 'taiji' | 'dance'; y: number }> = [];
  /** §13 V3: the morning mist over water */
  private mist?: Phaser.GameObjects.Rectangle;
  /** the tileset's names by index (gid - 1) */
  private tileNames: string[] = [];

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
    this.held = [];
    this.npcSprites.clear();
    this.propSprites.clear();
    this.hintMarks.clear();
    this.questTags.clear();
    this.turning = [];
    this.tileMoves = [];
    this.bodyMoves = [];
    this.mist = undefined;
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
    this.tileNames = names;
    map.createLayer('ground', tileset, 0, 0)!.setDepth(0);
    this.lightLayers = [
      map.createLayer('below', tileset, 0, 0)!.setDepth(1) as Phaser.Tilemaps.TilemapLayer,
      map.createLayer('above', tileset, 0, 0)!.setDepth(10_000) as Phaser.Tilemaps.TilemapLayer,
    ];
    this.gateRow = null;
    this.afterGate = null;
    this.lightLayers[0]!.forEachTile((t) => {
      if (this.gateRow === null && t.index === this.gid('gate')) this.gateRow = t.y;
    });
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
        this.propSprites.set(o.id, s);
        // §13 V3: a prop whose frame belongs to an animation plays it on the one clock
        const anim = PROP_ANIMS.get(o.frame);
        if (anim) this.turning.push({ s, a: anim, phase: anim.random ? Math.floor(Math.random() * anim.frames.length * 7) : 0, at: o.tile });
        if (o.frame === 'lantern/unlit') this.lanterns.push(s);
        if (o.night) this.nightProps.push([s, o.frame, o.night]);
        if (o.light) glow(x + s.width / 2, y - s.height / 2, Phaser.Display.Color.HexStringToColor(o.light).color, 28);
      } else if (o.kind === 'npc') {
        const { x, y } = feet(o.tile);
        const s = this.add.sprite(x, y + 3, 'chars', `${this.opts.looks?.[o.npc] ?? o.npc}/${o.facing ?? 'down'}-0`).setOrigin(0, 1).setDepth(y);
        this.npcSprites.set(o.id, s);
        // §13 V3: what they do while they stand about — a thing in their hand, or 太极 and dancing
        const idle = this.opts.idles?.[o.npc];
        const thing = idle ? IDLE_THINGS[idle] : undefined;
        if (thing) {
          const t = this.add.sprite(x + thing.dx, y + 3 - thing.dy, 'props', thing.frames[0]!).setOrigin(0, 1).setDepth(y + 0.1);
          this.turning.push({ s: t, a: thing, phase: Math.floor(Math.random() * 10) });
          s.setData('idle', idle);
        } else if (idle === 'taiji' || idle === 'dance') {
          this.bodyMoves.push({ s, base: this.opts.looks?.[o.npc] ?? o.npc, kind: idle, y: y + 3 });
          s.setData('idle', idle);
        }
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
    const dress = this.opts.dress?.();
    this.hero = this.add.sprite(x, y + 3, dress ? composeHero(this.textures, dress) : 'chars', `hero/${this.facing}-0`).setOrigin(0, 1).setDepth(y + 0.5);
    this.rabbit = this.add.sprite(x, y, 'chars', 'rabbit/down-0').setOrigin(0, 1);
    this.rabbitAt = null;
    this.bikeSprite = null;
    if (this.opts.bike) this.setBike(true);
    this.hat = null;
    this.emote = null;
    this.blush = null;
    this.setHat(this.opts.hat ?? 'none');
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => this.dressRabbit());
    this.flies = this.opts.butterflies?.()
      ? [0, Math.PI].map((phase) => ({
          phase,
          sprite: this.add.sprite(x, y, 'props', 'butterfly/open').setOrigin(0.5, 0.5).setScale(0.6).setDepth(20_002),
          light: this.add.image(x, y, 'glow').setDisplaySize(56, 56).setTint(0xdfe8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(20_001),
        }))
      : [];
    this.showFlies();
    this.pet = this.opts.pet?.(this.opts.map) ? this.add.sprite(x - TILE, y + 1, 'props', 'cat/sit').setOrigin(0, 1).setDepth(y + 0.4) : null;
    this.placeRabbit(this.at, 0, this.pet ? [this.at[0] - 1, this.at[1]] : null);
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
    this.setSky(this.opts.sky ?? 'none');
    // §13 V3: water and escalators move; the season shows on the map; one clock turns it all
    this.findTileMoves(map);
    this.decorate(map);
    this.time.addEvent({ delay: 90, loop: true, callback: () => this.animate() });
    this.dots = this.add.graphics().setDepth(9_999);
    // a new map: the page says where the footprints lead on it (after onArrive)
    this.trailTo = null;
    this.prints = [];
    this.inCut = false;
    this.bindInput();
    this.setHints(this.opts.hints ?? null);
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
    if (this.flies?.length) this.showFlies();
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
    // §13 V3: the morning mist comes and goes with the morning
    if (this.tileMoves.length) this.setMist(time === 'morning');
  }

  /**
   * Today's sky (X4): rain or snow over streets and parks — a map with
   * passers-by, pigeons or bikes counts as out of doors; rooms stay dry.
   */
  setSky(kind: 'none' | 'rain' | 'snow') {
    this.opts = { ...this.opts, sky: kind };
    const { crowd, pigeons, bikes } = this.info.life;
    this.setWeather(crowd + pigeons + bikes > 0 ? kind : 'none');
  }

  /** Rain or snow falling over the view, or none. */
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

  /** The butterflies only come out after dark. */
  private showFlies() {
    const dark = this.opts.time === 'evening' || this.opts.time === 'night';
    for (const f of this.flies) {
      f.sprite.setVisible(dark);
      f.light.setVisible(dark).setAlpha(this.opts.time === 'night' ? 0.55 : 0.35);
    }
  }

  /** His hat and feelings ride with him, bobbing as he bobs (X7); the butterflies circle you (X11). */
  private dressRabbit() {
    if (this.flies.length && this.hero) {
      const t = this.time.now / 1000;
      for (const f of this.flies) {
        const x = this.hero.x + 8 + Math.cos(t * 1.3 + f.phase) * 14;
        const y = this.hero.y - 20 + Math.sin(t * 2.1 + f.phase) * 6;
        f.sprite.setPosition(Math.round(x), Math.round(y)).setFrame(Math.sin(t * 12 + f.phase) > 0 ? 'butterfly/open' : 'butterfly/shut');
        f.light.setPosition(x, y);
      }
    }
    const r = this.rabbit;
    if (!r) return;
    // §13 V3: sorted by his feet every frame — behind you he is behind you, even mid-float (on your shoulder, just in front of you)
    if (this.hero) r.setDepth(this.rabbitAt === null ? this.hero.depth + 0.1 : r.y - 1 + 0.45);
    const bob = r.frame.name.endsWith('1') ? 1 : 0;
    this.hat?.setPosition(r.x, r.y).setDepth(r.depth + 0.01);
    this.blush?.setPosition(r.x, r.y + bob).setDepth(r.depth + 0.02);
    this.emote?.setPosition(r.x, r.y - 14).setDepth(20_003);
    if (this.hat) this.hat.y = r.y + bob;
  }

  /** New clothes or a new look (W4): the hero's texture is swapped, the frame kept. */
  setDress(d: HeroDress) {
    if (!this.hero) return;
    this.hero.setTexture(composeHero(this.textures, d), this.hero.frame.name);
  }

  setHat(kind: 'none' | 'snow' | 'flower' | 'armour') {
    this.opts = { ...this.opts, hat: kind };
    this.hat?.destroy();
    this.hat = kind === 'none' ? null : this.add.sprite(this.rabbit.x, this.rabbit.y, 'props', `rabbit-hat/${kind}`).setOrigin(0, 1);
  }

  /** A feeling over his head for a moment; `blush` sits on his cheeks instead. */
  showEmote(kind: 'happy' | 'sulky' | 'sleepy' | 'proud' | 'blush', ms = 2400) {
    const slot = kind === 'blush' ? 'blush' : 'emote';
    this[slot]?.destroy();
    const s = this.add.sprite(this.rabbit.x, this.rabbit.y, 'props', `emote/${kind}`).setOrigin(0, 1);
    this[slot] = s;
    if (kind !== 'blush') {
      s.setScale(0.6);
      this.tweens.add({ targets: s, scale: 1, duration: 160, ease: 'Back.easeOut' });
    }
    this.time.delayedCall(ms, () => {
      if (this[slot] !== s) return;
      this.tweens.add({ targets: s, alpha: 0, duration: 250, onComplete: () => s.destroy() });
      this[slot] = null;
    });
  }

  /**
   * A small bobbing diamond over each person and thing that answers Space
   * (or a tap), each door and each way off the map — the "show what I can
   * use" setting; null takes them away. Only redrawn when the set of marked
   * things changes.
   */
  setHints(pred: ((o: MapObject) => boolean) | null) {
    this.opts = { ...this.opts, hints: pred };
    const want = pred ? this.info.objects.filter(pred) : [];
    const spots = new Map<string, { x: number; y: number }>();
    for (const o of want) {
      const at = this.hintSpot(o, want);
      if (at) spots.set(o.id, at);
    }
    if (spots.size === this.hintMarks.size && [...spots.keys()].every((id) => this.hintMarks.has(id))) return;
    for (const m of this.hintMarks.values()) m.destroy();
    this.hintMarks.clear();
    this.makeHintTexture();
    for (const [id, { x, y }] of spots) {
      const m = this.add.image(Math.round(x), Math.round(y), 'hint').setOrigin(0.5, 1).setAlpha(0.8).setDepth(20_003);
      this.tweens.add({ targets: m, y: m.y - 2, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.floor(Math.random() * 600) });
      this.hintMarks.set(id, m);
    }
  }

  /**
   * "Take me there" (M6): faint footprints from where you stand to the door or street end of
   * the next map on the way, or to the train board on a platform; redrawn at every step, gone
   * with null. The ticket gates count as open for the trail (you walk through them).
   */
  setTrail(spec: TrailSpec | null) {
    this.trailTo = spec;
    this.drawTrail();
  }

  private drawTrail() {
    for (const p of this.prints) p.destroy();
    this.prints = [];
    this.trailPath = [];
    const spec = this.trailTo;
    if (!spec || !this.info || this.inCut) return;
    const goals = trailGoals(spec, this.info.objects, this.info.width, this.info.height);
    if (!goals.length) return;
    let grid = this.info.grid;
    if (this.gateRow !== null) {
      const open = new Uint8Array(grid.blocked);
      this.lightLayers[0]?.forEachTile((t) => {
        if (t.y === this.gateRow && t.index === this.gid('gate')) open[t.y * grid.width + t.x] = 0;
      });
      grid = { ...grid, blocked: open };
    }
    const path = findPath(grid, this.at, goals);
    if (!path?.length) return;
    this.trailPath = path;
    this.makePrintTexture();
    let prev = this.at;
    path.forEach((t, i) => {
      const dx = t[0] - prev[0];
      const dy = t[1] - prev[1];
      const angle = dx > 0 ? 90 : dx < 0 ? -90 : dy > 0 ? 180 : 0;
      // left foot, right foot: a little to either side of the way
      const side = i % 2 ? 2.5 : -2.5;
      const [ox, oy] = dx ? [0, side] : [side, 0];
      const img = this.add
        .image(t[0] * TILE + TILE / 2 + ox, t[1] * TILE + TILE / 2 + oy, 'print')
        .setAngle(angle)
        .setAlpha(Math.max(0.45, 0.85 - i * 0.015))
        .setDepth(2);
      this.prints.push(img);
      prev = t;
    });
  }

  /** Where the footprints are now, and the tile you stand on (the guide probe walks them). */
  trailTiles(): { at: Tile; path: Tile[] } {
    return { at: this.at, path: [...this.trailPath] };
  }

  private makePrintTexture() {
    if (this.textures.exists('print')) return;
    // a 5×8 shoe print, toes up: gold with a dark rim, the colour of the way on the maps
    // (a dark print alone reads as the pavement's own specks)
    const t = this.textures.createCanvas('print', 5, 8)!;
    const c = t.getContext();
    c.fillStyle = '#5a3a1c';
    c.fillRect(1, 0, 3, 5);
    c.fillRect(0, 1, 5, 3);
    c.fillRect(1, 5, 3, 3);
    c.fillStyle = '#f1c35a';
    c.fillRect(1, 1, 3, 3);
    c.fillRect(2, 6, 1, 1);
    t.refresh();
  }

  /**
   * The quest marks over people (§13 Q1): a red paper tag 「!」 for the one
   * the story needs now, a gold 「!」 for a side quest to start, a small 「…」
   * for the next step of a quest under way. Only redrawn where one changed.
   */
  setQuestMarks(marks: Readonly<Record<string, 'main' | 'side' | 'next'>> | null) {
    this.makeQuestTextures();
    const want = marks ?? {};
    for (const [id, t] of this.questTags) {
      if (want[id] === t.kind) continue;
      t.img.destroy();
      this.questTags.delete(id);
    }
    for (const [id, kind] of Object.entries(want)) {
      if (this.questTags.has(id)) continue;
      const s = this.npcSprites.get(id);
      if (!s) continue;
      const img = this.add.image(Math.round(s.x + s.width / 2), Math.round(s.y - s.height - 1), `qmark-${kind}`).setOrigin(0.5, 1).setDepth(20_003);
      this.tweens.add({ targets: img, y: img.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: Math.floor(Math.random() * 500) });
      this.questTags.set(id, { img, kind });
    }
  }

  private makeQuestTextures() {
    if (this.textures.exists('qmark-main')) return;
    // 8×10 paper tags with a dark rim; the 「!」 in paper white, the 「…」 bubble in ink
    const tag = (key: string, fill: string, mark: 'bang' | 'dots') => {
      const t = this.textures.createCanvas(key, 8, 10)!;
      const c = t.getContext();
      c.fillStyle = '#3a2f3f';
      c.fillRect(1, 0, 6, 9);
      c.fillRect(0, 1, 8, 7);
      c.fillStyle = fill;
      c.fillRect(1, 1, 6, 7);
      c.fillStyle = mark === 'bang' ? '#fff6ea' : '#3a2f3f';
      if (mark === 'bang') {
        c.fillRect(3, 2, 2, 3);
        c.fillRect(3, 6, 2, 1);
      } else {
        c.fillRect(1, 4, 1, 1);
        c.fillRect(3, 4, 2, 1);
        c.fillRect(6, 4, 1, 1);
      }
      // the little point under the tag
      c.fillStyle = '#3a2f3f';
      c.fillRect(3, 9, 2, 1);
      t.refresh();
    };
    tag('qmark-main', '#c8352e', 'bang');
    tag('qmark-side', '#d9a441', 'bang');
    tag('qmark-next', '#f8f5ec', 'dots');
  }

  /** Where a thing's mark sits (its foot is at the mark's bottom), or null for no mark of its own. */
  private hintSpot(o: MapObject, marked: readonly MapObject[]): { x: number; y: number } | null {
    if (o.kind === 'edge') {
      // in the middle of the stretch of edge that leads away
      const mid = Math.floor((o.from + o.to) / 2);
      const [tx, ty] =
        o.side === 'left' ? [0, mid] : o.side === 'right' ? [this.info.width - 1, mid] : o.side === 'up' ? [mid, 0] : [mid, this.info.height - 1];
      return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 + 4 };
    }
    const s = o.kind === 'npc' ? this.npcSprites.get(o.id) : o.kind === 'prop' ? this.propSprites.get(o.id) : undefined;
    if (s) return { x: s.x + s.width / 2, y: s.y - s.height - (o.kind === 'npc' ? 0 : 2) };
    if (!('tile' in o)) return null;
    const [tx, ty] = o.tile;
    if (o.kind === 'door') {
      // a wide way in (two gate tiles to the station) is one mark, over the middle of it
      const same = (x: number) => marked.some((d) => d.kind === 'door' && d.to.map === o.to.map && d.tile[0] === x && d.tile[1] === ty);
      if (same(tx - 1)) return null;
      let w = 1;
      while (same(tx + w)) w++;
      return { x: tx * TILE + (w * TILE) / 2, y: ty * TILE - 1 };
    }
    // a bike, a machine, a board: over the picture drawn on that tile, or
    // beside it (a bike stand is the tile next to the parked bike)
    const drawnAt = (x: number) =>
      [...this.propSprites.values()].find((p) => {
        const cx = x * TILE + TILE / 2;
        const foot = Math.round(p.y / TILE) - 1;
        return cx >= p.x && cx < p.x + p.width && ty <= foot && ty > foot - Math.max(1, Math.ceil(p.height / TILE));
      });
    const p = drawnAt(tx) ?? (o.kind === 'bike' ? (drawnAt(tx - 1) ?? drawnAt(tx + 1)) : undefined);
    if (p) return { x: p.x + p.width / 2, y: p.y - p.height - 2 };
    return { x: tx * TILE + TILE / 2, y: ty * TILE - 1 };
  }

  private makeHintTexture() {
    if (this.textures.exists('hint')) return;
    // a 7×7 pixel diamond, warm paper with a dark rim, like the path dots
    const t = this.textures.createCanvas('hint', 7, 7)!;
    const ctx = t.getContext();
    for (let y = 0; y < 7; y++) {
      const r = 3 - Math.abs(3 - y);
      for (let x = 3 - r; x <= 3 + r; x++) {
        ctx.fillStyle = x === 3 - r || x === 3 + r || y === 0 || y === 6 ? '#3a2f3f' : '#fff1b3';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    t.refresh();
  }

  /**
   * A cutscene on this map (§13 K1): the runner walks the people here and
   * moves the camera; the page shows the lines. Input waits (the page is
   * busy); at the end people stand where they stood, spawned ones go, the
   * camera follows you again, and the save hears where you ended up.
   */
  playCutscene(cs: Cutscene, hooks: CutsceneHooks): RunningCutscene {
    this.queue = [];
    this.after = null;
    this.held = [];
    this.stick = null;
    this.holding = false;
    // the quest marks and hint diamonds step aside while it runs
    const marks = [...[...this.questTags.values()].map((t) => t.img), ...this.hintMarks.values()];
    for (const m of marks) m.setVisible(false);
    // and so do the "Take me there" prints, until it is over
    for (const p of this.prints) p.setVisible(false);
    this.inCut = true;
    const spawned = new Map<Actor, Phaser.GameObjects.Sprite>();
    const tiles = new Map<Actor, Tile>();
    const before = new Map<Phaser.GameObjects.Sprite, { x: number; y: number; frame: string; depth: number }>();
    const npcObj = (a: Actor) => this.info.objects.find((o): o is Extract<MapObject, { kind: 'npc' }> => o.kind === 'npc' && o.npc === a);
    const feet = (t: Tile, sprite: boolean) => ({ x: t[0] * TILE, y: (t[1] + 1) * TILE + (sprite ? 3 : 0) });
    const sprite = (a: Actor): Phaser.GameObjects.Sprite | null => {
      if (a === 'hero') return this.hero;
      if (a === 'rabbit') return this.rabbit;
      const own = spawned.get(a);
      if (own) return own;
      const o = npcObj(a);
      return (o && this.npcSprites.get(o.id)) ?? null;
    };
    const frames = (a: Actor) =>
      a === 'hero' ? 'hero' : a === 'rabbit' || isSpiritActor(a) ? null : isExtra(a) ? a.slice(6) : (this.opts.looks?.[a] ?? a);
    const keep = (s: Phaser.GameObjects.Sprite) => {
      if (!before.has(s)) before.set(s, { x: s.x, y: s.y, frame: s.frame.name, depth: s.depth });
      s.setData('cut', true);
    };
    const stage: Stage = {
      scene: this,
      grid: this.info.grid,
      sprite,
      frames,
      tile: (a) => {
        if (a === 'hero') return this.at;
        const t = tiles.get(a);
        if (t) return t;
        if (a === 'rabbit') return [Math.floor(this.rabbit.x / TILE), Math.floor(this.rabbit.y / TILE) - 1];
        return npcObj(a)?.tile ?? null;
      },
      setTile: (a, t, f) => {
        const s = sprite(a);
        if (a === 'hero') {
          this.at = t;
          if (f) this.facing = f;
          const { x, y } = feet(t, true);
          this.hero.setPosition(x, y).setDepth(y - 3 + 0.5);
          this.placeRabbit(t, 200, null);
          return;
        }
        tiles.set(a, t);
        if (!s) return;
        if (!spawned.has(a)) keep(s);
        const { x, y } = feet(t, !isSpiritActor(a));
        s.setPosition(x, y).setDepth(y);
        const pre = frames(a);
        if (f && pre) s.setFrame(`${pre}/${f}-0`);
      },
      spawn: (a, at, facing) => {
        spawned.get(a)?.destroy();
        const spirit = spiritFrame(a);
        const { x, y } = feet(at, !spirit);
        const s = spirit
          ? this.add.sprite(x, y, 'props', spirit).setOrigin(0, 1)
          : this.add.sprite(x, y, 'chars', `${frames(a)}/${facing}-0`).setOrigin(0, 1);
        s.setDepth(y);
        spawned.set(a, s);
        tiles.set(a, at);
        // a spirit keeps its idle while it stands in a cutscene (§13 V4)
        const anim = spirit ? PROP_ANIMS.get(spirit) : undefined;
        if (anim) this.turning.push({ s, a: anim, phase: 0 });
      },
      despawn: (a) => {
        const own = spawned.get(a);
        if (own) {
          own.destroy();
          spawned.delete(a);
        } else {
          const s = sprite(a);
          if (s && a !== 'hero' && a !== 'rabbit') {
            keep(s);
            s.setVisible(false);
          }
        }
        tiles.delete(a);
      },
      prop: (id, frame) => {
        const p = this.propSprites.get(id);
        if (p && this.textures.get('props').has(frame)) p.setFrame(frame);
      },
      camera: (to, ms, zoom) => {
        const cam = this.cameras.main;
        cam.stopFollow();
        const z = Math.max(1, this.baseZoom + zoom - 1);
        if ('setFrame' in to) cam.startFollow(to, true, 0.12, 0.12);
        else cam.pan(to.x, to.y, ms, 'Sine.easeInOut');
        if (cam.zoom !== z) cam.zoomTo(z, ms);
        return new Promise((resolve) => (ms > 0 ? this.time.delayedCall(ms, () => resolve()) : resolve()));
      },
      restore: () => {
        for (const s of spawned.values()) s.destroy();
        spawned.clear();
        for (const [s, b] of before) {
          if (!s.active) continue;
          s.setPosition(b.x, b.y).setFrame(b.frame).setDepth(b.depth).setVisible(true).setAlpha(1).setData('cut', false);
        }
        before.clear();
        const cam = this.cameras.main;
        cam.stopFollow();
        cam.zoomTo(this.baseZoom, 250);
        cam.startFollow(this.hero, true, 0.15, 0.15, -8, 16);
        this.hero.setFrame(`hero/${this.facing}-0`);
        this.placeRabbit(this.at, 200, null);
        for (const m of marks) if (m.active) m.setVisible(true);
        this.inCut = false;
        this.drawTrail();
        this.host.onStep(this.at, this.facing, false);
      },
    };
    return runCutscene(stage, cs, hooks);
  }

  /** The part of the map on screen, in tiles (X6 photos). */
  viewTiles() {
    const v = this.cameras.main.worldView;
    return { x: v.x / TILE, y: v.y / TILE, w: v.width / TILE, h: v.height / TILE };
  }

  /** One step closer or further for a photo, among the zooms that keep pixels square. */
  zoomStep(d: 1 | -1) {
    const cam = this.cameras.main;
    const zooms = pinchZooms(this.baseZoom);
    const i = zooms.findIndex((z) => z === cam.zoom);
    const next = zooms[Math.max(0, Math.min(zooms.length - 1, (i < 0 ? zooms.indexOf(this.baseZoom) : i) + d))];
    if (next) cam.setZoom(next);
    this.frameBounds();
  }

  /** The cat pads after you onto the tile you just left (X5), and sits when you stop. */
  private followPet(to: Tile, ms: number) {
    const pet = this.pet;
    if (!pet) return;
    const x = to[0] * TILE;
    const y = (to[1] + 1) * TILE;
    if (x !== pet.x) this.petRight = x > pet.x;
    const side = this.petRight ? '-r' : '';
    pet.setFrame(`cat/walk-${this.stepFrame}${side}`);
    this.tweens.killTweensOf(pet);
    this.tweens.add({
      targets: pet,
      x,
      y: y + 1,
      duration: ms,
      onUpdate: () => pet.setDepth(pet.y - 1 + 0.4),
      onComplete: () => {
        this.time.delayedCall(ms + 40, () => {
          if (!this.tweens.isTweening(pet)) pet.setFrame('cat/sit');
        });
      },
    });
  }

  /** Through the ticket gates at this tile: two steps across, down to the platform or up to the street. */
  passGate(gate: Tile, down: boolean) {
    const [x, row] = gate;
    this.held = [];
    this.after = null;
    this.afterGate = null;
    this.afterBoard = false;
    this.running = false;
    const lineUp: Tile[] = this.at[0] === x ? [] : [[x, this.at[1]]];
    this.queue = [...lineUp, [x, row], [x, down ? row + 1 : row - 1]];
    if (!this.moving) this.next();
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
      this.shift = e.shiftKey;
      const f = KEY_FACING[e.key];
      // A held key walks on step after step (see stepTo), not at the pace of the keyboard's repeat.
      if (f && e.repeat && this.held.includes(f)) return;
      if (this.host.isBusy()) return;
      if (f) {
        this.held = [...this.held.filter((h) => h !== f), f];
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
    keys?.on('keyup', (e: KeyboardEvent) => {
      this.shift = e.shiftKey;
      const f = KEY_FACING[e.key];
      // W and w are one key: letting go of either lets go of it
      if (f) this.held = this.held.filter((h) => h !== f);
    });
    const letGo = () => {
      this.held = [];
      this.shift = false;
    };
    window.addEventListener('blur', letGo);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('blur', letGo));
  }

  /** the tracks: a blocked tile below the gates of a station, not a thing standing there */
  private isTrack([x, y]: Tile): boolean {
    return this.gateRow !== null && y > this.gateRow + 1 && y < this.info.height && !walkable(this.info.grid, x, y) && !objectAt(this.info.objects, [x, y]);
  }

  private tileAt(wx: number, wy: number): Tile {
    return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
  }

  private tap(wx: number, wy: number, time: number) {
    const tile = this.tileAt(wx, wy);
    const again = time - this.lastTap.time < DOUBLE_TAP_MS && Math.abs(tile[0] - this.lastTap.tile[0]) + Math.abs(tile[1] - this.lastTap.tile[1]) <= 1;
    this.lastTap = { time, tile };
    this.running = again;
    this.afterGate = null;
    this.afterBoard = false;
    // a tap on the tracks: walk to the edge and choose a train
    if (this.isTrack(tile)) {
      const w = walkTo(this.info.grid, this.at, tile, this.occupied());
      this.queue = [...w.path];
      this.after = null;
      this.afterBoard = w.path.length > 0 || this.isTrack(ahead(this.at, 'down'));
      this.showPath(w.path);
      if (!this.moving) this.next();
      return;
    }
    // a tap on the gates, or anywhere past them: walk up to the gates on this side and go through
    const g = this.gateRow;
    if (g !== null && (tile[1] === g || (tile[1] < g) !== (this.at[1] < g)) && !objectAt(this.info.objects, tile)) {
      const above = this.at[1] < g;
      const x = Math.max(1, Math.min(this.info.width - 2, tile[0]));
      const w = walkTo(this.info.grid, this.at, [x, above ? g - 1 : g + 1], this.occupied());
      this.queue = [...w.path];
      this.after = null;
      if (w.arrived) this.afterGate = [x, g];
      this.showPath(w.path);
      if (!this.moving) this.next();
      return;
    }
    const plan = planTap(this.info.grid, this.info.objects, this.at, tile, this.occupied());
    this.queue = [...plan.path];
    this.after = plan.kind === 'walk' ? null : plan;
    this.showPath(plan.path);
    if (!this.moving) this.next();
  }

  /** Get on or off a shared bike (H8): faster steps, a bicycle drawn under the hero. */
  setBike(on: boolean) {
    this.opts.bike = on;
    if (on && !this.bikeSprite) {
      this.bikeSprite = this.add.sprite(this.hero.x, this.hero.y, 'props', 'bicycle/side').setOrigin(0, 1);
      this.placeBike();
    } else if (!on && this.bikeSprite) {
      this.bikeSprite.destroy();
      this.bikeSprite = null;
    }
  }

  private placeBike() {
    const b = this.bikeSprite;
    if (!b) return;
    b.setPosition(this.hero.x, this.hero.y - 1).setDepth(this.hero.depth - 0.05);
    b.setFlipX(this.facing === 'left');
    b.setVisible(this.facing === 'left' || this.facing === 'right');
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
    else {
      this.face(f);
      // walking into the ticket gates goes through them, as in a real station
      const next = ahead(this.at, f);
      if (this.gateRow !== null && next[1] === this.gateRow && (f === 'up' || f === 'down')) {
        this.held = [];
        this.host.onGate?.(next, f === 'down');
      } else if (f === 'down' && this.isTrack(next)) {
        this.held = [];
        this.host.onBoard?.();
      }
    }
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
    const gate = this.afterGate;
    this.afterGate = null;
    if (this.afterBoard) {
      this.afterBoard = false;
      this.face('down');
      this.host.onBoard?.();
      return;
    }
    if (gate && this.gateRow !== null) {
      const down = this.at[1] < this.gateRow;
      this.face(down ? 'down' : 'up');
      this.host.onGate?.(gate, down);
      return;
    }
    const plan = this.after;
    this.after = null;
    if (!plan || plan.kind === 'walk' || !plan.arrived) return;
    this.face(plan.facing);
    if (plan.kind === 'talk') this.host.onTalk(plan.npc, plan.spot);
    else this.host.onLook(plan.object);
  }

  private stepTo(t: Tile) {
    const prev = this.at;
    const dx = t[0] - this.at[0];
    const dy = t[1] - this.at[1];
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.at = t;
    this.moving = true;
    this.stepFrame = (this.stepFrame + 1) % 2;
    this.hero.setFrame(`hero/${this.facing}-${this.stepFrame + 1}`);
    const x = t[0] * TILE;
    const y = (t[1] + 1) * TILE;
    const ms = this.bikeSprite ? RUN_MS * 0.75 : this.running ? RUN_MS : WALK_MS;
    this.hero.setDepth(Math.max(this.hero.depth, y + 0.5));
    this.followPet(prev, ms);
    // §13 V4: a 4-frame walk — the foot forward, then the passing frame halfway (1 → 3 → 2 → 3)
    let passed = !!this.bikeSprite;
    this.tweens.add({
      targets: this.hero,
      x,
      y: y + 3,
      duration: ms,
      onUpdate: (tw) => {
        this.hero.setDepth(this.hero.y - 3 + 0.5);
        this.placeBike();
        if (!passed && tw.progress >= 0.5) {
          passed = true;
          this.hero.setFrame(`hero/${this.facing}-3`);
        }
      },
      onComplete: () => {
        this.hero.setFrame(`hero/${this.facing}-0`);
        this.host.onStep(t, this.facing, this.running);
        if (this.trailTo) this.drawTrail();
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
        const key = this.held[this.held.length - 1];
        if (key && !this.queue.length) {
          this.moving = false;
          if (this.host.isBusy()) this.held = [];
          else {
            this.running = this.shift;
            this.keyStep(key);
          }
          return;
        }
        this.next();
      },
    });
    this.placeRabbit(t, ms * 1.6, this.pet ? prev : null);
  }

  /**
   * 兔儿爷 floats after you onto a free tile beside you — never over a wall,
   * a building or a person — and sorts by that tile, so what stands in front
   * of him hides him. Boxed in, he rides on your shoulder.
   */
  private placeRabbit(at: Tile, ms: number, cat: Tile | null) {
    const taken = this.occupied();
    if (cat) taken.add(`${cat[0]},${cat[1]}`);
    const off = rabbitSpot(this.info.grid, at, this.facing, this.rabbitAt, taken);
    const shoulder = off[0] === 0 && off[1] === 0;
    this.rabbitAt = shoulder ? null : off;
    const feetY = (at[1] + off[1] + 1) * TILE;
    const x = (at[0] + off[0]) * TILE + (shoulder ? 12 : 0);
    const y = shoulder ? feetY - 18 : feetY + 1;
    const depth = shoulder ? feetY + 0.6 : feetY + 0.45;
    this.tweens.killTweensOf(this.rabbit);
    if (!ms) {
      this.rabbit.setPosition(x, y).setDepth(depth);
      return;
    }
    // sort by the lower of the two rows on the way, so he never slips under what he passes in front of
    this.rabbit.setDepth(Math.max(this.rabbit.depth, depth));
    this.tweens.add({
      targets: this.rabbit,
      x,
      y,
      duration: ms,
      ease: 'Sine.easeOut',
      onComplete: () => this.rabbit.setDepth(depth),
    });
  }

  // ---------------------------------------------------------------- life (D5)

  private startLife() {
    this.rng = rand(Math.floor(Math.random() * 1e9));
    this.pigeons = [];
    // people with an idle action of their own (§13 V3) do that instead of looking about
    for (const s of this.npcSprites.values()) if (!s.getData('idle')) this.idle(s);
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
        // in a cutscene the script moves them (§13 K1)
        if (s.getData('cut')) return loop();
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

  // ---------------------------------------------------------------- V3: motion

  /** The tiles that move (water, the escalator): found once per map, turned by the clock. */
  private findTileMoves(map: Phaser.Tilemaps.Tilemap) {
    for (const a of TILE_ANIMS) {
      const gids = a.frames.map((f) => this.gid(f));
      if (gids.some((g) => g <= 0)) continue;
      const tiles: Array<{ t: Phaser.Tilemaps.Tile; phase: number }> = [];
      for (const layer of map.layers) {
        layer.tilemapLayer?.forEachTile((t) => {
          if (gids.includes(t.index)) tiles.push({ t, phase: a.random ? (t.x * 3 + t.y * 5) % a.frames.length : 0 });
        });
      }
      if (tiles.length) this.tileMoves.push({ a, gids, tiles });
    }
  }

  /** One tick of the one clock: props, held things, tiles and people who move as they idle. */
  private animate() {
    const t = this.time.now;
    for (const m of this.turning) {
      if (!m.s.active || !m.s.visible) continue;
      if (m.a.near !== undefined && m.at && Math.abs(m.at[0] - this.at[0]) + Math.abs(m.at[1] - this.at[1]) > m.a.near) continue;
      const f = frameAt(m.a, t, m.phase);
      if (m.s.frame.name !== f) m.s.setFrame(f);
    }
    for (const tm of this.tileMoves) {
      const step = Math.floor((t / 1000) * tm.a.fps);
      for (const x of tm.tiles) {
        const gid = tm.gids[(step + x.phase) % tm.gids.length]!;
        if (x.t.index !== gid) x.t.index = gid;
      }
    }
    // §13 V4: standing still, the player breathes — a pixel's dip now and then
    if (!this.moving && !this.bikeSprite && this.hero && !this.hero.getData('cut')) {
      const name = this.hero.frame.name;
      const rest = `hero/${this.facing}-0`;
      const up = `hero/${this.facing}-3`;
      if (name === rest || name === up) {
        const want = t % 2600 < 280 ? up : rest;
        if (name !== want) this.hero.setFrame(want);
      }
    }
    for (const b of this.bodyMoves) {
      if (!b.s.active || b.s.getData('cut')) continue;
      if (b.kind === 'taiji') {
        // slow: face one way, then the other, rising a little between
        const phase = (t / 1800) % 4;
        const f = phase < 1 ? 'left' : phase < 2 ? 'down' : phase < 3 ? 'right' : 'down';
        b.s.setFrame(`${b.base}/${f}-0`);
        b.s.y = b.y - (phase % 1 < 0.5 ? 1 : 0);
      } else {
        // 广场舞: a step to the beat, a turn every four
        const beat = Math.floor(t / 420);
        b.s.setFrame(`${b.base}/${['down', 'left', 'down', 'right'][Math.floor(beat / 4) % 4]}-${(beat % 2) + 1}`);
        b.s.y = b.y - (beat % 2);
      }
    }
  }

  /** Is this map out of doors (it has street life)? */
  private get outdoors() {
    const { crowd, pigeons, bikes } = this.info.life;
    return crowd + pigeons + bikes > 0;
  }

  /**
   * The season and the weather on the map (§13 V3): gold ginkgo leaves
   * drifting in autumn, snow on the roofs and wall tops in winter (and crows
   * at dusk), 柳絮 floating in spring, puddles with ripples in the rain, mist
   * over water in the morning.
   */
  private decorate(map: Phaser.Tilemaps.Tilemap) {
    this.makeSeasonTextures();
    const season = this.opts.season;
    const out = this.outdoors;
    const view = this.cameras.main;
    const drift = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add.particles(0, 0, key, { x: { min: 0, max: view.width }, y: -6, ...cfg }).setScrollFactor(0).setDepth(20_002);
    if (out && season === 'autumn') drift('season-leaf', { lifespan: 7000, speedY: { min: 14, max: 26 }, speedX: { min: -14, max: 8 }, rotate: { min: 0, max: 360 }, frequency: 700, quantity: 1 });
    if (out && season === 'spring') drift('season-fluff', { lifespan: 9000, speedY: { min: 4, max: 10 }, speedX: { min: 8, max: 22 }, frequency: 900, quantity: 1, alpha: { start: 0.9, end: 0.2 } });
    if (out && season === 'winter') {
      // snow lies on ridges, eaves and wall tops: a cap on each such tile, drawn once
      const capped = (name: string) => /^((roof|pitch)-[a-z]+-(ridge|eave)(-[lr])?|brick-top|wall-top|palace-top)$/.test(name);
      // how far down the tile the snow lies: the ¾ kit's ridge beam and eave sit lower in their tiles than the old flat ones
      const lift = (name: string) => (name.startsWith('pitch-') ? (name.includes('-ridge') ? 3 : 6) : name.includes('-eave') ? 3 : 0);
      for (const layer of map.layers) {
        const depth = layer.name === 'above' ? 10_000.5 : 1.5;
        layer.tilemapLayer?.forEachTile((t) => {
          const name = this.tileNames[t.index - 1];
          if (!name || !capped(name)) return;
          this.add.image(t.pixelX, t.pixelY + lift(name), 'season-snowcap').setOrigin(0, 0).setDepth(depth);
        });
      }
      if (this.opts.time === 'evening') this.crows();
    }
    if (out && this.opts.sky === 'rain') this.puddles(map);
    if (this.opts.time === 'morning') this.setMist(true);
  }

  /** Crows cross the dusk sky in winter, one after another, high over the lanes. */
  private crows() {
    const fly = (i: number) => {
      if (!this.scene.isActive()) return;
      const cam = this.cameras.main;
      const y = 10 + Math.random() * 40;
      const s = this.add.sprite(-16, y, 'props', 'crow/fly-0').setScrollFactor(0).setDepth(20_002);
      this.turning.push({ s, a: { frames: ['crow/fly-0', 'crow/fly-1'], fps: 5 }, phase: i });
      this.tweens.add({ targets: s, x: cam.width / cam.zoom + 16, y: y - 20 + Math.random() * 20, duration: 9000 + Math.random() * 4000, onComplete: () => s.destroy() });
      this.time.delayedCall(5000 + Math.random() * 9000, () => fly(i + 1));
    };
    fly(0);
    this.time.delayedCall(1500, () => fly(7));
  }

  /** Puddles on open paving in the rain, each with its ripple. */
  private puddles(map: Phaser.Tilemaps.Tilemap) {
    const ground = new Set(['paving', 'paving-2', 'plaza', 'square-stone', 'road', 'marble']);
    const spots: Tile[] = [];
    map.getLayer('ground')?.tilemapLayer?.forEachTile((t) => {
      const name = this.tileNames[t.index - 1];
      if (name && ground.has(name) && walkable(this.info.grid, t.x, t.y)) spots.push([t.x, t.y]);
    });
    for (let i = 0; i < Math.min(8, Math.floor(spots.length / 30)); i++) {
      const [x, y] = spots[Math.floor(Math.random() * spots.length)]!;
      const s = this.add.sprite(x * TILE, (y + 1) * TILE, 'props', 'puddle/ripple-0').setOrigin(0, 1).setDepth(0.6);
      this.turning.push({ s, a: PROP_ANIMS.get('puddle/ripple-0')!, phase: i * 3 });
    }
  }

  /** Mist over water in the morning: a pale veil that breathes, gone when the morning is. */
  private setMist(on: boolean) {
    const water = this.tileMoves.some((m) => m.a.frames[0] === 'water-0' && m.tiles.length > 20);
    if (!on || !water) {
      this.mist?.destroy();
      this.mist = undefined;
      return;
    }
    if (this.mist) return;
    const w = this.info.width * TILE;
    const h = this.info.height * TILE;
    this.mist = this.add.rectangle(0, 0, w, h, 0xeef2f6, 0.14).setOrigin(0, 0).setDepth(19_999);
    this.tweens.add({ targets: this.mist, fillAlpha: 0.22, duration: 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private makeSeasonTextures() {
    const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      if (this.textures.exists(key)) return;
      const t = this.textures.createCanvas(key, w, h)!;
      draw(t.getContext());
      t.refresh();
    };
    // a ginkgo leaf: a little gold fan
    make('season-leaf', 3, 3, (c) => {
      c.fillStyle = '#f4c542';
      c.fillRect(0, 0, 3, 1);
      c.fillRect(1, 1, 1, 1);
      c.fillStyle = '#d7982b';
      c.fillRect(1, 2, 1, 1);
    });
    // 柳絮: a wisp of willow cotton
    make('season-fluff', 3, 2, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(0, 1, 3, 1);
      c.fillRect(1, 0, 1, 1);
    });
    // snow lying along the top of a tile: an uneven white line with a pale edge
    make('season-snowcap', 16, 4, (c) => {
      c.fillStyle = '#f8f5ec';
      c.fillRect(0, 1, 16, 2);
      c.fillRect(2, 0, 5, 1);
      c.fillRect(10, 0, 4, 1);
      c.fillStyle = '#cbced8';
      c.fillRect(0, 3, 3, 1);
      c.fillRect(6, 3, 5, 1);
      c.fillRect(13, 3, 3, 1);
    });
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
