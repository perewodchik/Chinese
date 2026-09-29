import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildAll } from './build';
import { pack } from './pack';
import { nearest, PALETTE } from './palette';
import { blank, decodePng, encodePng } from './png';
import { parsePx, PxError, render } from './px';
import { recolour, toPx } from './recolour';

const TWO = `
# a 2x2 test
size: 2x2
frame: a
kr
.w
frame: b = mirror a
frame: c = a
variant: blue r>n
`;

describe('.px files', () => {
  it('reads frames, mirrors, copies and palette-swap variants', () => {
    const s = parsePx(TWO, 'test');
    assert.equal(s.width, 2);
    assert.deepEqual(
      s.frames.map((f) => [f.name, f.rows.join('|')]),
      [
        ['test/a', 'kr|.w'],
        ['test/b', 'rk|w.'],
        ['test/c', 'kr|.w'],
        ['blue/a', 'kn|.w'],
        ['blue/b', 'nk|w.'],
        ['blue/c', 'kn|.w'],
      ],
    );
  });

  it('says the file and line of a mistake', () => {
    const bad = (t: string) => assert.throws(() => parsePx(t, 'hero'), PxError);
    bad('size: 2x2\nframe: a\nkr\n');
    bad('size: 2x2\nframe: a\nkrr\n.w\n');
    bad('size: 2x2\nframe: a\nk@\n.w\n');
    bad('frame: a\nkr\n.w\n');
    bad('size: 2x2\nframe: a = mirror nope\n');
    bad('size: 2x2\nframe: a\nkr\n.w\nframe: a\nkr\n.w\n');
    assert.throws(() => parsePx('size: 2x2\nframe: a\nkr\n', 'hero'), /hero\.px:2: frame "a" has 1 rows, not 2/);
    assert.throws(() => parsePx('size: 2x2\nframe: a\nk@\n.w\n', 'hero'), /hero\.px:3: "@" is not a palette letter/);
  });

  it('renders the palette colours, transparent where "."', () => {
    const s = parsePx(TWO, 'test');
    const img = render(s.frames[0]!, 2, 2);
    assert.deepEqual([...img.data.subarray(0, 4)], [...PALETTE.get('k')!]);
    assert.deepEqual([...img.data.subarray(8, 12)], [0, 0, 0, 0]);
  });
});

describe('PNG', () => {
  it('round-trips RGBA', () => {
    const img = blank(3, 2);
    img.data.set([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const back = decodePng(encodePng(img));
    assert.equal(back.width, 3);
    assert.equal(back.height, 2);
    assert.deepEqual([...back.data], [...img.data]);
  });
});

describe('the atlas', () => {
  it('packs frames without overlap and maps each name to its place', () => {
    const items = ['a', 'b', 'c'].map((name, i) => ({ name, img: blank(16, 16 + i * 16) }));
    const { png, json } = pack(items, 'x.png', 40);
    const rects = Object.values(json.frames).map((f) => f.frame);
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        assert.ok(apart, JSON.stringify([a, b]));
      }
      assert.ok(a.x + a.w <= png.width && a.y + a.h <= png.height);
    }
    assert.deepEqual(json.frames.c!.frame, { x: 1, y: 1, w: 16, h: 48 });
    assert.equal(json.meta.image, 'x.png');
  });

  it('builds atlases from a sprites folder, the same bytes every time', () => {
    const root = mkdtempSync(join(tmpdir(), 'world-art-'));
    mkdirSync(join(root, 'src', 'chars'), { recursive: true });
    writeFileSync(join(root, 'src', 'chars', 'test.px'), TWO);
    assert.deepEqual(buildAll(join(root, 'src'), join(root, 'out')), ['chars: 6 frames']);
    const first = readFileSync(join(root, 'out', 'chars.png'));
    buildAll(join(root, 'src'), join(root, 'out'));
    assert.deepEqual(readFileSync(join(root, 'out', 'chars.png')), first);
    const json = JSON.parse(readFileSync(join(root, 'out', 'chars.json'), 'utf8'));
    assert.deepEqual(Object.keys(json.frames), ['blue/a', 'blue/b', 'blue/c', 'test/a', 'test/b', 'test/c']);
  });
});

describe('recolour', () => {
  it('maps every pixel to the nearest palette colour, faint ones to nothing', () => {
    assert.equal(nearest([216, 68, 59, 255]), 'r');
    assert.equal(nearest([250, 30, 30, 255]), 'r');
    assert.equal(nearest([0, 0, 0, 255]), 'k');
    const img = blank(2, 1);
    img.data.set([214, 70, 60, 255, 10, 10, 10, 40]);
    const r = recolour(img);
    assert.deepEqual(r.letters, ['r.']);
    assert.deepEqual([...r.img.data.subarray(0, 4)], [...PALETTE.get('r')!]);
  });

  it('writes a .px that reads back', () => {
    const letters = Array.from({ length: 16 }, () => 'r'.repeat(16) + '.'.repeat(16));
    const text = toPx(letters, 16, 'test');
    const s = parsePx(text, 'imp');
    assert.deepEqual(s.frames.map((f) => f.name), ['imp/r0c0']);
  });
});

describe('the generated art', () => {
  it('every generated .px parses, and the committed ones match the generator', async () => {
    const { sources } = await import('./generate');
    for (const [rel, text] of sources()) {
      const name = rel.split('/').pop()!.replace('.px', '');
      parsePx(text, name);
      const committed = join('content/world/art/sprites', rel);
      let onDisk = '';
      try {
        onDisk = readFileSync(committed, 'utf8');
      } catch {
        assert.fail(`${committed} is missing — run scripts/world/art/generate.ts`);
      }
      if (onDisk.startsWith('# generated')) assert.equal(onDisk, text, `${committed} is stale — run scripts/world/art/generate.ts`);
    }
  });
});

describe('the kit and the motion (§13 V2–V3)', () => {
  const props = JSON.parse(readFileSync('public/world/art/props.json', 'utf8')) as { frames: Record<string, unknown> };
  const tiles = (JSON.parse(readFileSync('public/world/art/tiles-set.json', 'utf8')) as { names: string[] }).names.map((n) => n.replace(/^[^/]+\//, ''));

  it('every frame an animation names is in the built atlases', async () => {
    const { PROP_ANIM_LIST, TILE_ANIMS, IDLE_THINGS } = await import('../../../src/world/art/anims');
    for (const a of [...PROP_ANIM_LIST, ...Object.values(IDLE_THINGS)]) for (const f of a!.frames) assert.ok(props.frames[f], `props atlas has no ${f}`);
    for (const a of TILE_ANIMS) for (const f of a.frames) assert.ok(tiles.includes(f), `tileset has no ${f}`);
  });

  it('the kit: twelve roof tiles for each glaze, every tile name once', async () => {
    const { GLAZES } = await import('./gen/kit');
    for (const g of GLAZES) assert.equal(tiles.filter((n) => n.startsWith(`pitch-${g}-`)).length, 12, g);
    assert.equal(new Set(tiles).size, tiles.length);
    for (const f of ['censer/smoke-0', 'prayer-wheels/turn-2', 'chuihuamen/painted', 'bike-rack/shared', 'idle/jianzi-2', 'tree/huai-1']) assert.ok(props.frames[f], f);
  });

  it('the 鼓楼 drums play at their show times', async () => {
    const { isDrumShow } = await import('../../../src/world/audio/mix');
    assert.ok(isDrumShow(9 * 60 + 30));
    assert.ok(isDrumShow(3 * 1440 + 16 * 60 + 30));
    assert.ok(!isDrumShow(12 * 60 + 30));
  });
});
