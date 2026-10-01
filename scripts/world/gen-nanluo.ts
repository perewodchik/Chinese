/**
 * 南锣鼓巷 (`nanluo-main`), drawn by rule (MH2, the learner 2026-10-01: "lots of holes on left
 * and right but I can't visit them — this kind of map should never exist").
 *
 * The real lane has 16 胡同 off it, eight each side like a centipede's legs (facts.md
 * `nlgx-centipede`, `nlgx-hutongs`). Each one here is a real lane: two tiles wide, lined with the
 * walls and gates of the houses on it, and it ends where you can see it end — at a courtyard's
 * wall inside the map — unless it leads somewhere: 帽儿胡同 runs on west to your lane
 * (`hutong-home`), 东棉花胡同 east past the drama academy (`dongmianhua`), and three lanes have
 * a gate you can go in by (雨儿, 后圆恩寺, 菊儿).
 * The houses along 南锣鼓巷 itself keep their roofs with the ridge along the street.
 *
 * This writes `content/world/maps/nanluo-main.map.txt` and the objects it owns in
 * `nanluo-main.objects.json` (ids starting `g-`, the hutong signs, the edges, the lane gates and
 * the shops' doors); every other object (people, the street's props) is kept as it is.
 *
 *   npx tsx scripts/world/gen-nanluo.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';

export const W = 40;
export const H = 64;
/** the street: x 16..23 */
export const STREET = [16, 23] as const;
/** the houses on the street (roof ridge along it), then the lanes' houses behind them */
const FRONT_W = [9, 15] as const;
const FRONT_E = [24, 30] as const;
/** where each side's first lane period starts, and its length: a lane every 7 rows */
const BASE = { w: 4, e: 6 } as const;
const PERIOD = 7;

/** the 16 胡同, north to south (facts.md `nlgx-hutongs`) */
const HUTONGS = {
  w: ['前鼓楼苑胡同', '黑芝麻胡同', '沙井胡同', '景阳胡同', '帽儿胡同', '雨儿胡同', '蓑衣胡同', '福祥胡同'],
  e: ['菊儿胡同', '后圆恩寺胡同', '前圆恩寺胡同', '秦老胡同', '北兵马司胡同', '东棉花胡同', '板厂胡同', '炒豆胡同'],
} as const;

/** the gates you can go in by: side, lane, and where they lead */
const OPEN_GATES: Array<{ side: 'w' | 'e'; lane: number; id: string; to: { map: string; tile: [number, number] } }> = [
  { side: 'w', lane: 5, id: 'g-qibaishi', to: { map: 'qibaishi', tile: [9, 12] } },
  { side: 'e', lane: 0, id: 'g-juer', to: { map: 'juer', tile: [9, 12] } },
  { side: 'e', lane: 1, id: 'g-maodun', to: { map: 'maodun', tile: [9, 12] } },
];

/** the lanes that run on past the map's edge: 帽儿胡同 west to your lane, 东棉花胡同 east past the drama academy */
const THROUGH: Array<{ side: 'w' | 'e'; lane: number; map: string; row: number }> = [
  { side: 'w', lane: 4, map: 'hutong-home', row: 7 },
  { side: 'e', lane: 5, map: 'dongmianhua', row: 6 },
];
const through = (side: 'w' | 'e', i: number) => THROUGH.find((t) => t.side === side && t.lane === i);

/** the rows a side's lane `i` takes */
export const laneRows = (side: 'w' | 'e', i: number) => [BASE[side] + PERIOD * i + 4, BASE[side] + PERIOD * i + 5] as const;

/** a row's part in a side's period: 0–3 the house north of the next lane (roof, eave, wall, base), 4–5 the lane, 6 the back wall of the house south of it */
function role(side: 'w' | 'e', y: number): number | 'top' {
  if (y < BASE[side]) return 'top';
  const i = Math.floor((y - BASE[side]) / PERIOD);
  const r = (y - BASE[side]) % PERIOD;
  // past the last lane: houses to the end
  if (i > 7 && r !== 6) return 'top';
  return r;
}

/** the gates on each lane's north wall (deep part), x */
const GATE_X = { w: 5, e: 34 } as const;

export function build() {
  const ground: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => 'p'));
  const below: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  // a few worn stones down the street, always the same
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < H; y++) for (let x = STREET[0]; x <= STREET[1]; x++) if (rand() < 0.06) ground[y]![x] = 'P';

  for (const side of ['w', 'e'] as const) {
    const front = side === 'w' ? FRONT_W : FRONT_E;
    const deep = side === 'w' ? [0, FRONT_W[0] - 1] : [FRONT_E[1] + 1, W - 1];
    // the street-side houses, seen from above with the ridge along the street (legend keys 1–6, see the header)
    const pattern = side === 'w' ? '1121135' : '6411211';
    for (let y = 0; y < H; y++) {
      const r = role(side, y);
      const lane = typeof r === 'number' && (r === 4 || r === 5);
      for (let x = front[0]; x <= front[1]; x++) {
        const k = x - front[0];
        below[y]![x] = lane ? '.' : r === 6 ? 'T' : r === 3 ? 'B' : pattern[k]!;
      }
      for (let x = deep[0]!; x <= deep[1]!; x++) {
        if (lane) {
          // the lane's far end: a courtyard's back wall, three tiles thick — unless the lane goes on
          const i = Math.floor((y - BASE[side]) / PERIOD);
          const end = side === 'w' ? x <= 2 : x >= W - 3;
          below[y]![x] = end && !through(side, i) ? 'T' : '.';
        } else if (r === 'top') below[y]![x] = 'x';
        else if (r === 0) below[y]![x] = 'x';
        else if (r === 1) below[y]![x] = 'e';
        else if (r === 2) below[y]![x] = x === GATE_X[side] ? 'd' : (x - deep[0]!) % 4 === 1 ? 'n' : 'b';
        else if (r === 3) below[y]![x] = x === GATE_X[side] ? 'D' : 'B';
        else below[y]![x] = 'T';
      }
    }
  }
  // the shops' doorways on the street (a gap in the wall, the shop's sign over it)
  for (const s of SHOPS) below[s.door[1]]![s.door[0]] = '.';
  return { ground, below };
}

/** the shops on the street: their door tile on the street-side wall, and where you come out */
export const SHOPS: Array<{ id: string; sign: string; door: [number, number]; out: [number, number]; facing: 'left' | 'right' }> = [
  { id: 'chaguan', sign: '茶馆', door: [24, 14], out: [23, 14], facing: 'left' },
  { id: 'lifadian', sign: '理发', door: [15, 19], out: [16, 19], facing: 'right' },
  { id: 'xiaomaibu', sign: '小卖部', door: [24, 42], out: [23, 42], facing: 'left' },
  { id: 'zaodian', sign: '早点', door: [15, 47], out: [16, 47], facing: 'right' },
];

type Obj = Record<string, unknown> & { kind: string; id: string };

/** the objects this file owns */
export function structure(): Obj[] {
  const out: Obj[] = [];
  for (const side of ['w', 'e'] as const) {
    HUTONGS[side].forEach((name, i) => {
      const [a, b] = laneRows(side, i);
      const mouth = side === 'w' ? FRONT_W[1] : FRONT_E[0];
      // the street sign at the lane's corner, on the street-side house's wall
      out.push({ kind: 'sign', id: `hutong-${side}${i}`, tile: [mouth, a - 1], text: name, en: `${name} — a lane off 南锣鼓巷` });
      const open = OPEN_GATES.find((g) => g.side === side && g.lane === i);
      const gx = GATE_X[side];
      if (open) out.push({ kind: 'door', id: open.id, tile: [gx, a - 1], to: { ...open.to, facing: 'up' } });
      else if (!through(side, i))
        out.push({
          kind: 'door',
          id: `g-gate-${side}${i}`,
          tile: [gx, a - 1],
          to: { map: 'nanluo-main', tile: [gx, a], facing: 'down' },
          when: { flag: 'never' },
          locked: '大杂院 — a courtyard where several families live. You knock; someone calls 「找谁啊？」 (Who are you looking for?) and the gate stays shut.',
        });
      // what lives in a lane: one or two things, never the same in two lanes next to each other
      const deepX = side === 'w' ? [3, 8] : [31, 36];
      const things = [
        { frame: 'bicycle/side', w: 1 },
        { frame: 'plant/green', w: 1 },
        { frame: 'cat/sleep', w: 1 },
        { frame: 'coal/stack', w: 1 },
        { frame: 'bird-cage/cage', w: 1 },
        { frame: 'cabbages/stack', w: 1 },
        { frame: 'stool/red', w: 1 },
      ];
      const t1 = things[(i * 3 + (side === 'w' ? 0 : 2)) % things.length]!;
      const t2 = things[(i * 3 + (side === 'w' ? 4 : 5)) % things.length]!;
      const x1 = side === 'w' ? deepX[0]! + 1 : deepX[1]!;
      const x2 = side === 'w' ? deepX[1]! : deepX[0]! + 1;
      out.push({ kind: 'prop', id: `g-lane-${side}${i}-a`, tile: [x1, b], frame: t1.frame, blocks: [1, 1] });
      if (i % 2 === 0) out.push({ kind: 'prop', id: `g-lane-${side}${i}-b`, tile: [x2, a], frame: t2.frame, blocks: [1, 1] });
    });
  }
  // VB2/VB3: the street's own clutter — tricycles by the shops, bikes against the walls, washing over two lanes
  const street: Array<[string, [number, number], string, [number, number]?]> = [
    ['g-st-tricycle-1', [22, 22], 'tricycle/side', [2, 1]],
    ['g-st-tricycle-2', [16, 55], 'tricycle/side-r', [2, 1]],
    ['g-st-bike-1', [23, 30], 'bicycle/side'],
    ['g-st-bike-2', [16, 27], 'bicycle/side-r'],
    ['g-st-bike-3', [23, 52], 'bicycle/side'],
    ['g-st-plant-1', [16, 21], 'plant/green'],
    ['g-st-plant-2', [23, 16], 'plant/green'],
    ['g-st-cage', [16, 34], 'bird-cage/cage'],
  ];
  for (const [id, tile, frame, blocks] of street) out.push({ kind: 'prop', id, tile, frame, blocks: blocks ?? [1, 1] });
  for (const [side, i] of [['w', 2], ['e', 6]] as const) {
    const [, b] = laneRows(side, i);
    out.push({ kind: 'prop', id: `g-wash-${side}${i}`, tile: [side === 'w' ? 6 : 33, b], frame: 'washing-line/clothes', blocks: [3, 1] });
  }
  for (const s of SHOPS) {
    out.push({ kind: 'door', id: s.id, tile: s.door, to: { map: s.id, tile: DOOR_IN[s.id]!, facing: 'up' } });
    out.push({ kind: 'sign', id: `s-${s.id}`, tile: [s.door[0], s.door[1] - 1], text: s.sign });
  }
  out.push(
    { kind: 'edge', id: 'north', side: 'up', from: STREET[0], to: STREET[1], target: { map: 'gulou-dongdajie', offset: 4 } },
    { kind: 'edge', id: 'south', side: 'down', from: STREET[0], to: STREET[1], target: { map: 'subway-lane', offset: -8 } },
  );
  for (const t of THROUGH) {
    const [a] = laneRows(t.side, t.lane);
    out.push({ kind: 'edge', id: t.side === 'w' ? 'west' : 'east', side: t.side === 'w' ? 'left' : 'right', from: a, to: a + 1, target: { map: t.map, offset: t.row - a } });
  }
  return out;
}

/** where you stand inside each shop when you come in (as before) */
const DOOR_IN: Record<string, [number, number]> = { zaodian: [6, 7], xiaomaibu: [5, 6], lifadian: [8, 6], chaguan: [7, 8] };

/** objects the old map had and this one draws itself */
const REPLACED = (o: Obj) =>
  o.id.startsWith('g-') ||
  o.id.startsWith('hutong-') ||
  o.kind === 'edge' ||
  SHOPS.some((s) => o.id === s.id || o.id === `s-${s.id}`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = 'content/world/maps';
  const { ground, below } = build();
  const head = `id: nanluo-main
size: ${W}x${H}
tilesets: tiles
district: gulou
crowd: 7
pigeons: 4
bikes: 2
below_keys: 1=side-roof 2=side-roof-ridge 3=side-roof-eave-w 4=side-roof-eave-e 5=side-wall-w 6=side-wall-e

# 南锣鼓巷: the street north–south, its houses' roofs along it, and its sixteen 胡同, eight each side.
# Drawn by scripts/world/gen-nanluo.ts — change that, not this file.
`;
  writeFileSync(`${dir}/nanluo-main.map.txt`, `${head}\n[ground]\n${ground.map((r) => r.join('')).join('\n')}\n[below]\n${below.map((r) => r.join('')).join('\n')}\n`);
  const old = JSON.parse(readFileSync(`${dir}/nanluo-main.objects.json`, 'utf8')) as Obj[];
  const kept = old.filter((o) => !REPLACED(o));
  writeFileSync(`${dir}/nanluo-main.objects.json`, `${JSON.stringify([...structure(), ...kept], null, 1)}\n`);
  console.log(`nanluo-main: ${W}x${H}, ${structure().length} objects drawn, ${kept.length} kept`);
}
