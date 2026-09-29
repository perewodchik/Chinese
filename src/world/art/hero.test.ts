import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { BROWS, BUILDS, DEFAULT_LOOK, EYES, HAIR_COLOURS, HAIR_STYLES, MOUTHS, SKINS, type HeroLook } from '../core/looks';
import { Grid } from './grid';
import { DEFAULT_WORN, FRAME_NAMES, GARMENT_ART, heroFrame, heroFrames, layerFrame, ORDER, toRgba, type Dir, type WornOutfit } from './hero';
import { PALETTE } from './palette';

const DIRS: Dir[] = ['down', 'up', 'left'];
const STEPS = [0, 1, -1];
const drawn = (g: Grid) => g.rows.some((r) => r.some((c) => c !== '.'));

/** Every figure pixel has a neighbour on all four sides inside the box that is not empty: the outline is closed. */
function outlineClosed(g: Grid): string | null {
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.get(x, y);
      if (c === '.' || c === '_' || c === 'k') continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) return `${c} at ${x},${y} touches the edge`;
        const n = g.get(nx, ny);
        if (n === '.' || n === '_') return `${c} at ${x},${y} has no outline towards ${nx},${ny}`;
      }
    }
  }
  return null;
}

const onlyPalette = (g: Grid) => g.rows.every((r) => r.every((c) => c === '.' || PALETTE.has(c)));

describe('the layered hero (W1)', () => {
  it('draws the thirteen frames every person has, with the names the scene uses', () => {
    const frames = heroFrames(DEFAULT_LOOK, DEFAULT_WORN);
    assert.deepEqual(frames.map(([n]) => n), [...FRAME_NAMES]);
    const atlas = JSON.parse(readFileSync('public/world/art/chars.json', 'utf8')) as { frames: Record<string, unknown> };
    for (const n of FRAME_NAMES) assert.ok(atlas.frames[`hero/${n}`], `the atlas's plain hero has ${n}`);
    for (const [n, g] of frames) {
      assert.equal(g.w, 16, n);
      assert.equal(g.h, 32, n);
      assert.ok(onlyPalette(g), n);
    }
  });

  it('the body, and every garment, has pixels in every frame it should', () => {
    for (const build of BUILDS) {
      for (const dir of DIRS) {
        for (const step of STEPS) {
          assert.ok(drawn(layerFrame('body', { ...DEFAULT_LOOK, build }, {}, dir, step)), `body ${build} ${dir} ${step}`);
          for (const [id, art] of Object.entries(GARMENT_ART)) {
            const g = layerFrame(art.slot, { ...DEFAULT_LOOK, build }, { [art.slot]: { art: id, palette: 'nBrR' } }, dir, step);
            // glasses cannot be seen from behind
            if (art.slot === 'accessory' && dir === 'up' && /glasses/.test(id)) continue;
            assert.ok(drawn(g), `${id} ${build} ${dir} ${step}`);
            assert.ok(onlyPalette(g), `${id}: every key swapped for a palette letter`);
          }
        }
      }
    }
  });

  it('every garment says how many colour keys it uses (1–4)', () => {
    for (const [id, art] of Object.entries(GARMENT_ART)) assert.ok(art.keys >= 1 && art.keys <= 4, `${id}: ${art.keys}`);
  });

  it('every hair style in every colour, every face and every skin: inside the box, the outline closed', () => {
    const looks: HeroLook[] = [];
    for (const style of HAIR_STYLES) for (const colour of HAIR_COLOURS) looks.push({ ...DEFAULT_LOOK, hair: { style, colour } });
    for (const build of BUILDS) for (let skin = 0; skin < SKINS; skin++) looks.push({ ...DEFAULT_LOOK, build, skin });
    for (const eyes of EYES) for (const brows of BROWS) for (const mouth of MOUTHS) looks.push({ ...DEFAULT_LOOK, face: { eyes, brows, mouth } });
    for (const look of looks) {
      for (const [n, g] of heroFrames(look, DEFAULT_WORN)) {
        const bad = outlineClosed(g);
        assert.equal(bad, null, `${JSON.stringify(look)} ${n}: ${bad}`);
      }
    }
  });

  it('every garment on both builds, with and without a hat: inside the box, the outline closed', () => {
    for (const [id, art] of Object.entries(GARMENT_ART)) {
      for (const build of BUILDS) {
        for (const [hat, style] of [[undefined, 'long'], ['tophat', 'buns'], ['straw', 'curly']] as const) {
          const worn: WornOutfit = { ...DEFAULT_WORN, ...(hat ? { hat: { art: hat, palette: 'aby' } } : {}), [art.slot]: { art: id, palette: 'rRyY' } };
          {
            for (const [n, g] of heroFrames({ ...DEFAULT_LOOK, build, hair: { style, colour: 'brown' } }, worn)) {
              const bad = outlineClosed(g);
              assert.equal(bad, null, `${id} ${build} ${hat ?? ''} ${style} ${n}: ${bad}`);
            }
          }
        }
      }
    }
  });

  it('draws in the order given per direction: a scarf over the jacket going down, long hair behind the shoulders', () => {
    assert.ok(ORDER.down.indexOf('accessory') > ORDER.down.indexOf('top'));
    assert.ok(ORDER.down.indexOf('hairBack') < ORDER.down.indexOf('body'));
    assert.ok(!ORDER.up.includes('face'));
    // the scarf's red is on the jacket's chest, facing down
    const g = heroFrame(DEFAULT_LOOK, DEFAULT_WORN, 'down', 0);
    assert.equal(g.get(9, 19), 'r');
  });

  it('a hat keeps buns from poking out above it', () => {
    const look: HeroLook = { ...DEFAULT_LOOK, hair: { style: 'buns', colour: 'black' } };
    const bare = heroFrame(look, DEFAULT_WORN, 'down', 0);
    const capped = heroFrame(look, { ...DEFAULT_WORN, hat: { art: 'beanie', palette: 'rRw' } }, 'down', 0);
    assert.ok(bare.rows.slice(0, 4).some((r) => r.includes('H')));
    assert.ok(!capped.rows.slice(0, 4).some((r) => r.includes('H')));
  });

  it('composes once quickly: all thirteen frames of a look well under a frame on the iPad', () => {
    const t = performance.now();
    for (let i = 0; i < 20; i++) heroFrames({ ...DEFAULT_LOOK, skin: i % SKINS }, DEFAULT_WORN).forEach(([, g]) => toRgba(g));
    const each = (performance.now() - t) / 20;
    assert.ok(each < 30, `${each.toFixed(1)} ms a look`);
  });
});
