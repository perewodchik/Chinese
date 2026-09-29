/**
 * The city as a metro diagram (prompt §9⅞ M4): the game's lines from
 * travel.ts, laid out by hand on a grid, north up, the way a real metro map
 * is drawn — lines run across, down or at 45°, bends are rounded, stations
 * sit on the lines, and every name has its own side.
 *
 * Rules for the next person who adds a station or a line:
 * - positions are grid units; neighbours on a line are 1–2.5 apart, and
 *   two neighbours on one line are either level, above one another or at
 *   exactly 45° — anything else needs a bend point (`[x, y]` in `ROUTES`);
 * - Line 2 is the old city's rounded rectangle (x 0–12, y 0–10), Line 1 is
 *   the long street across it at y = 7, Line 6 the one at y = 3;
 * - a name goes on the side with nothing in the way (`side`: n, s, e, w,
 *   ne, nw, se, sw); `metro.test.ts` fails if two names touch each other or
 *   a station at the size the iPad shows them.
 */

import { LINES, STATIONS } from './travel';

export type Side = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** station → [x, y, where its name goes] */
export const AT: Record<string, readonly [number, number, Side]> = {
  // Line 2, clockwise from the north-west corner
  xizhimen: [0, 0, 'nw'],
  jishuitan: [2, 0, 'n'],
  guloudajie: [4.5, 0, 'ne'],
  andingmen: [6.5, 0, 'n'],
  yonghegong: [9, 0, 'ne'],
  dongzhimen: [12, 0, 'ne'],
  dongsishitiao: [12, 1.5, 'e'],
  chaoyangmen: [12, 3, 'ne'],
  jianguomen: [12, 7, 'ne'],
  beijingzhan: [10.5, 10, 's'],
  chongwenmen: [9, 10, 'ne'],
  qianmen: [6, 10, 'nw'],
  hepingmen: [3.5, 10, 's'],
  xuanwumen: [1.5, 10, 's'],
  changchunjie: [0, 8.5, 'w'],
  fuxingmen: [0, 7, 'w'],
  fuchengmen: [0, 5, 'w'],
  chegongzhuang: [0, 3, 'w'],
  // Line 1
  xidan: [2, 7, 's'],
  tiananmenxi: [3.8, 7, 's'],
  tiananmendong: [5.6, 7, 's'],
  wangfujing: [7.5, 7, 'se'],
  dongdan: [9, 7, 'se'],
  yonganli: [14.5, 7, 's'],
  guomao: [17, 7, 'se'],
  dawanglu: [19, 7, 's'],
  // Line 5
  huixinxijienankou: [9, -4, 'nw'],
  hepingxiqiao: [9, -3, 'e'],
  hepinglibeijie: [9, -1.8, 'e'],
  beixinqiao: [9, 1, 'e'],
  zhangzizhonglu: [9, 2, 'e'],
  dongsi: [9, 3, 'se'],
  dengshikou: [9, 5, 'e'],
  ciqikou: [9, 11.5, 'e'],
  tiantandongmen: [9, 13, 'e'],
  puhuangyu: [9, 14.5, 'e'],
  // Line 6
  pinganli: [1.5, 3, 'n'],
  beihaibei: [3, 3, 'n'],
  nanluoguxiang: [5.5, 3, 'ne'],
  dongdaqiao: [14.5, 3, 'n'],
  hujialou: [17, 3, 'ne'],
  jintailu: [19.5, 3, 'n'],
  // Line 8
  aolinpikegongyuan: [4.5, -8, 'e'],
  aotizhongxin: [4.5, -6.5, 'e'],
  beitucheng: [4.5, -4, 'w'],
  anhuaqiao: [4.5, -3, 'w'],
  andelibeijie: [4.5, -1.8, 'w'],
  shichahai: [4.5, 1.5, 'w'],
  zhongguomeishuguan: [6.5, 4.5, 'e'],
  jinyuhutong: [6.5, 5.8, 'e'],
  zhushikou: [6, 11.5, 'w'],
  tianqiao: [6, 13, 'w'],
  // Line 10, the eastern arc
  anzhenmen: [6.5, -4, 's'],
  shaoyaoju: [11, -4, 's'],
  taiyanggong: [13, -4, 'n'],
  sanyuanqiao: [15, -4, 'n'],
  liangmaqiao: [17, -2.5, 'e'],
  nongyezhanlanguan: [17, -1, 'e'],
  tuanjiehu: [17, 1.5, 'e'],
  jintaixizhao: [17, 5, 'e'],
  shuangjing: [17, 9, 'e'],
  jinsong: [17, 10.5, 'e'],
  panjiayuan: [17, 12, 'e'],
  shilihe: [17, 13.5, 'e'],
  // buses and the train to the Wall
  dongwuyuan: [-3, 1, 's'],
  yiheyuan: [-8, -4, 'n'],
  beijingbeizhan: [-1.2, -1.2, 'w'],
  qinghe: [-4, -6, 'e'],
  badalingchangcheng: [-8, -10, 's'],
};

/** each line's way through its stations; `[x, y]` is a bend with no station */
export const ROUTES: Record<string, ReadonlyArray<string | readonly [number, number]>> = {
  l1: [[-1.5, 7], 'fuxingmen', 'xidan', 'tiananmenxi', 'tiananmendong', 'wangfujing', 'dongdan', 'jianguomen', 'yonganli', 'guomao', 'dawanglu', [20.5, 7]],
  l2: [
    'xizhimen', 'jishuitan', 'guloudajie', 'andingmen', 'yonghegong', 'dongzhimen', 'dongsishitiao', 'chaoyangmen', 'jianguomen', [12, 10],
    'beijingzhan', 'chongwenmen', 'qianmen', 'hepingmen', 'xuanwumen', [0, 10], 'changchunjie', 'fuxingmen', 'fuchengmen', 'chegongzhuang', 'xizhimen',
  ],
  l5: ['huixinxijienankou', 'hepingxiqiao', 'hepinglibeijie', 'yonghegong', 'beixinqiao', 'zhangzizhonglu', 'dongsi', 'dengshikou', 'dongdan', 'chongwenmen', 'ciqikou', 'tiantandongmen', 'puhuangyu'],
  l6: [[-1.5, 3], 'chegongzhuang', 'pinganli', 'beihaibei', 'nanluoguxiang', 'dongsi', 'chaoyangmen', 'dongdaqiao', 'hujialou', 'jintailu'],
  l8: [
    'aolinpikegongyuan', 'aotizhongxin', 'beitucheng', 'anhuaqiao', 'andelibeijie', 'guloudajie', 'shichahai', [4.5, 2], 'nanluoguxiang', [6.5, 4],
    'zhongguomeishuguan', 'jinyuhutong', 'wangfujing', [7.5, 8.5], 'qianmen', 'zhushikou', 'tianqiao',
  ],
  l10: [
    'beitucheng', 'anzhenmen', 'huixinxijienankou', 'shaoyaoju', 'taiyanggong', 'sanyuanqiao', [17, -4], 'liangmaqiao', 'nongyezhanlanguan', 'tuanjiehu',
    'hujialou', 'jintaixizhao', 'guomao', 'shuangjing', 'jinsong', 'panjiayuan', 'shilihe',
  ],
  b332: ['xizhimen', [-1, 1], 'dongwuyuan', 'yiheyuan'],
  b34: ['tiantandongmen', 'panjiayuan'],
  jingzhang: ['beijingbeizhan', [-4, -4], 'qinghe', 'badalingchangcheng'],
};

/** stations close enough to walk between, drawn as a dotted link */
export const WALK_LINKS: ReadonlyArray<readonly [string, string]> = [['xizhimen', 'beijingbeizhan']];

export type Pt = readonly [number, number];

const pt = (s: string | Pt): Pt => (typeof s === 'string' ? [AT[s]![0], AT[s]![1]] : s);

/**
 * The points a line is drawn through: between two stops that are not level,
 * above one another or at 45°, a bend is put in — the diagonal first, then
 * the straight rest.
 */
export function linePoints(id: string): Pt[] {
  const r = ROUTES[id] ?? [];
  const out: Pt[] = [];
  for (const s of r) {
    const p = pt(s);
    const q = out[out.length - 1];
    if (q) {
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > 1e-9 && ay > 1e-9 && Math.abs(ax - ay) > 1e-9) {
        const d = Math.min(ax, ay);
        out.push([q[0] + Math.sign(dx) * d, q[1] + Math.sign(dy) * d]);
      }
    }
    out.push(p);
  }
  return out;
}

/** An SVG path through the points with bends rounded to radius `r` (grid units, times `g` for the drawing). */
export function roundedPath(points: readonly Pt[], r: number, g = 1): string {
  if (points.length < 2) return '';
  const P = points.map(([x, y]) => [x * g, y * g] as const);
  const R = r * g;
  let d = `M${P[0]![0]} ${P[0]![1]}`;
  for (let i = 1; i < P.length - 1; i++) {
    const [a, b, c] = [P[i - 1]!, P[i]!, P[i + 1]!];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(R, l1 / 2, l2 / 2);
    const u1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1];
    const u2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    if (Math.abs(u1[0]! - u2[0]!) < 1e-9 && Math.abs(u1[1]! - u2[1]!) < 1e-9) {
      d += ` L${b[0]} ${b[1]}`;
      continue;
    }
    d += ` L${b[0] - u1[0]! * k} ${b[1] - u1[1]! * k} Q${b[0]} ${b[1]} ${b[0] + u2[0]! * k} ${b[1] + u2[1]! * k}`;
  }
  const z = P[P.length - 1]!;
  return `${d} L${z[0]} ${z[1]}`;
}

/** the lines at a station (an interchange has more than one) */
export const linesThrough = (station: string) => Object.keys(ROUTES).filter((l) => ROUTES[l]!.includes(station));

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** how far a name sits from its station, in grid units */
const GAP = 0.32;

/** Where a station's name is drawn: its box (grid units) for a font `fs` grid units high, and the text anchor. */
export function labelBox(station: string, fs: number): Box & { anchor: 'start' | 'middle' | 'end' } {
  const [x, y, side] = AT[station]!;
  const name = STATIONS.find((s) => s.id === station)?.zh ?? station;
  const w = [...name].length * fs;
  const h = fs;
  const d = GAP;
  const dd = GAP * 0.8;
  switch (side) {
    case 'n':
      return { x: x - w / 2, y: y - d - h, w, h, anchor: 'middle' };
    case 's':
      return { x: x - w / 2, y: y + d, w, h, anchor: 'middle' };
    case 'e':
      return { x: x + d, y: y - h / 2, w, h, anchor: 'start' };
    case 'w':
      return { x: x - d - w, y: y - h / 2, w, h, anchor: 'end' };
    case 'ne':
      return { x: x + dd, y: y - dd - h, w, h, anchor: 'start' };
    case 'nw':
      return { x: x - dd - w, y: y - dd - h, w, h, anchor: 'end' };
    case 'se':
      return { x: x + dd, y: y + dd, w, h, anchor: 'start' };
    case 'sw':
      return { x: x - dd - w, y: y + dd, w, h, anchor: 'end' };
  }
}

/** every station a line of the game stops at has a place on the diagram */
export const allStations = () => [...new Set(LINES.flatMap((l) => l.stops))];

/** The diagram's extent in grid units. */
export function extent(): Box {
  const xs = Object.values(AT).map((a) => a[0]);
  const ys = Object.values(AT).map((a) => a[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
