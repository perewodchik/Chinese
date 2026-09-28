/**
 * The world, drawn: one map with its layers, the props and people standing
 * on it sorted by where their feet are, the hero, the camera, the time of
 * day. No game rules — those are in core/.
 *
 * Loaded only on /play/world (boot.ts imports this file after Phaser).
 */

import * as Phaser from 'phaser';
import type { PartOfDay, Tile } from '../core/types';
import { readMap, type MapInfo } from './mapdata';
import { DAY_LOOK, zoomFor } from './look';

export const TILE = 16;
const ART = '/world/art';

export interface SceneOptions {
  map: string;
  time: PartOfDay;
  hero: Tile;
  facing?: 'up' | 'down' | 'left' | 'right';
  onReady?: () => void;
}

interface TilesetNames {
  names: string[];
}


export class WorldScene extends Phaser.Scene {
  private opts!: SceneOptions;
  private hero!: Phaser.GameObjects.Sprite;
  info!: MapInfo;

  constructor() {
    super('world');
  }

  init(opts: SceneOptions) {
    this.opts = opts;
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
            this.time.addEvent({ delay: 260 + Math.random() * 200, loop: true, callback: () => s.setFrame(s.frame.name === 'lantern/lit-0' ? 'lantern/lit-1' : 'lantern/lit-0') });
          }
        }
      } else if (o.kind === 'npc') {
        const { x, y } = feet(o.tile);
        this.add.sprite(x, y + 3, 'chars', `${o.npc}/${o.facing ?? 'down'}-0`).setOrigin(0, 1).setDepth(y);
      } else if (o.kind === 'light' && look.lit) {
        const { x, y } = feet(o.tile);
        glows.push({ x: x + TILE / 2, y: y - TILE / 2, color: Phaser.Display.Color.HexStringToColor(o.color ?? '#fff1b3').color, r: o.radius ?? 32 });
      }
    }
    // lit windows glow too
    if (look.lit) {
      below.forEachTile((t) => {
        if (t.index === gid('window-lit') || t.index === gid('shop-lit')) glows.push({ x: t.pixelX + 8, y: t.pixelY + 10, color: 0xffd98a, r: 16 });
      });
    }

    const { x, y } = feet(this.opts.hero);
    this.hero = this.add.sprite(x, y + 3, 'chars', `hero/${this.opts.facing ?? 'down'}-0`).setOrigin(0, 1).setDepth(y + 0.5);
    this.add.sprite(x + 12, y - 18, 'chars', 'rabbit/down-0').setOrigin(0, 1).setDepth(y + 0.6);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.setRoundPixels(true);
    const fit = () => cam.setZoom(zoomFor(this.scale.width, this.scale.height));
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
    this.opts.onReady?.();
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
