/**
 * Every map of the game as a place on the city map (the 🗺 panel): its name,
 * what kind of place it is, and where it is drawn. Positions are in the city
 * map's own units — a 160 × 100 drawing, north up — laid out by hand: true
 * to Beijing in direction and order (the lane east of the hutong, the shops
 * along the lane, the palace north of the square), but the old city is drawn
 * far bigger than the suburbs, so the places inside it have room.
 *
 * How the maps join (doors and edges) comes from the build: `links` in
 * public/world/maps/index.json. Pure, so tests check every map has a place.
 */

export type PlaceKind = 'street' | 'sight' | 'inside' | 'station';

export interface Place {
  map: string;
  zh: string;
  en: string;
  kind: PlaceKind;
  at: readonly [number, number];
  /** which side the name sits on; below by default */
  label?: 'r' | 'l' | 't' | 'b';
  /** far from the rest of its district (a station across town): left out of the district's frame */
  apart?: boolean;
}

const P = (map: string, zh: string, en: string, kind: PlaceKind, at: readonly [number, number], more: Partial<Place> = {}): Place => ({
  map,
  zh,
  en,
  kind,
  at,
  ...more,
});

export const PLACES: readonly Place[] = [
  // 鼓楼 · 南锣鼓巷
  P('gulou-square', '鼓楼', 'Drum Tower square', 'sight', [81.6, 21.6], { label: 't' }),
  P('siheyuan-yard', '四合院', 'The courtyard where you live', 'street', [84.6, 23.4], { label: 'r' }),
  P('siheyuan-room', '我的房间', 'Your room', 'inside', [82.8, 23.6], { label: 'l' }),
  P('hutong-home', '帽儿胡同', "Mao'er Hutong", 'street', [84.2, 25.6], { label: 'l' }),
  P('nanluo-main', '南锣鼓巷', 'Nanluoguxiang', 'street', [87, 27.2], { label: 'l' }),
  P('zaodian', '早点铺', 'Breakfast shop', 'inside', [89, 24.6], { label: 'r' }),
  P('xiaomaibu', '小卖部', 'Corner shop', 'inside', [89, 26.4], { label: 'r' }),
  P('lifadian', '理发店', 'Barber', 'inside', [89, 28.2], { label: 'r' }),
  P('chaguan', '茶馆', 'Teahouse', 'inside', [85, 28.8], { label: 'l' }),
  P('subway-lane', '平安大街', "Ping'an Avenue", 'street', [85.6, 31.2], { label: 'l' }),
  P('station-nanluoguxiang', '南锣鼓巷站', 'Nanluoguxiang station', 'station', [88.6, 32.4], { label: 'r' }),
  P('hutong-proto', '胡同', 'A hutong (the first sketch)', 'street', [84, 25.6], { apart: true }),

  // 什刹海 · 后海
  P('houhai-lake', '后海', 'Houhai lake', 'sight', [73.6, 25.6]),
  P('station-shichahai', '什刹海站', 'Shichahai station', 'station', [79.6, 28.4], { label: 'l' }),

  // 景山 · 北海
  P('beihai-north', '北海北门', 'Beihai Park, north gate', 'sight', [75.4, 31.4], { label: 'l' }),
  P('station-beihaibei', '北海北站', 'Beihai North station', 'station', [75.4, 33.6], { label: 'l' }),
  P('jingshan-park', '景山公园', 'Jingshan Park', 'sight', [81.4, 35.8], { label: 'l' }),
  P('jingshan-view', '万春亭', 'The view from Jingshan hill', 'sight', [83.6, 34.2], { label: 'r' }),
  P('jiaolou', '角楼', 'The palace corner tower', 'sight', [87.4, 37.6], { label: 'r' }),

  // 天安门 · 故宫
  P('yuhuayuan', '御花园', 'Imperial Garden', 'sight', [83, 39.4], { label: 'l' }),
  P('jiulongbi', '九龙壁', 'Nine Dragon Wall', 'sight', [85.8, 41.6], { label: 'r' }),
  P('taihedian', '太和殿', 'Hall of Supreme Harmony', 'sight', [83, 43.2], { label: 'l' }),
  P('wumen', '午门', 'Meridian Gate', 'sight', [83, 46.6], { label: 'l' }),
  P('tiananmen-square', '天安门广场', 'Tiananmen Square', 'sight', [83, 52.6]),
  P('station-tiananmendong', '天安门东站', 'Tiananmen East station', 'station', [87, 50.2], { label: 'r' }),
  P('tiananmen-proto', '天安门', 'Tiananmen (the first sketch)', 'sight', [83, 49], { apart: true }),

  // 王府井
  P('wangfujing-street', '王府井大街', 'Wangfujing Street', 'street', [91.4, 46], { label: 'l' }),
  P('station-wangfujing', '王府井站', 'Wangfujing station', 'station', [91.4, 50.2], { label: 'r' }),
  P('shudian', '书店', 'Bookshop', 'inside', [93.6, 44.2], { label: 'r' }),
  P('yaodian', '药店', 'Pharmacy', 'inside', [93.6, 46], { label: 'r' }),
  P('yinhang', '银行', 'Bank', 'inside', [93.6, 47.8], { label: 'r' }),

  // 前门 · 大栅栏
  P('station-qianmen', '前门站', 'Qianmen station', 'station', [85.2, 58], { label: 'r' }),
  P('qianmen-street', '前门大街', 'Qianmen Street', 'street', [83, 61], { label: 'r' }),
  P('xiyuan', '戏园', 'Opera house', 'inside', [80.4, 62.6], { label: 'l' }),

  // 天坛
  P('huiyinbi', '回音壁', 'Echo Wall', 'sight', [89.4, 67.6], { label: 't' }),
  P('tiantan-park', '天坛公园', 'Temple of Heaven Park', 'sight', [90.4, 71]),
  P('station-tiantandongmen', '天坛东门站', 'Tiantan East Gate station', 'station', [96.8, 69.4], { label: 'r' }),

  // 雍和宫 · 国子监
  P('guozijian', '国子监', 'Imperial Academy', 'sight', [95.6, 23.6], { label: 'l' }),
  P('yonghegong-street', '雍和宫大街', 'Yonghegong Street', 'street', [99.6, 24.6], { label: 'r' }),
  P('station-yonghegong', '雍和宫站', 'Yonghegong station', 'station', [100.6, 21], { label: 'r' }),

  // 三里屯 · 国贸
  P('sanlitun-street', '三里屯', 'Sanlitun', 'street', [113.6, 34], { label: 'l' }),
  P('station-tuanjiehu', '团结湖站', 'Tuanjiehu station', 'station', [117.4, 36.2], { label: 'r' }),
  P('guomao-plaza', '国贸', 'Guomao (the CBD)', 'street', [120, 51.6], { label: 'l' }),
  P('station-guomao', '国贸站', 'Guomao station', 'station', [122.4, 49.6], { label: 'r' }),
  P('guomao-bank', '银行', 'Bank', 'inside', [118.6, 54], { label: 'l' }),
  P('bianlidian', '便利店', 'Convenience store', 'inside', [121.8, 54], { label: 'r' }),

  // 奥林匹克公园
  P('olympic-park', '奥林匹克公园', 'Olympic Park', 'sight', [83.4, 4.6], { label: 'l' }),
  P('station-aolinpikegongyuan', '奥林匹克公园站', 'Olympic Park station', 'station', [86.4, 7.4], { label: 'r' }),

  // 颐和园 (and the bus from 西直门)
  P('yiheyuan-changlang', '长廊', 'The Long Corridor', 'sight', [19.4, 15], { label: 'l' }),
  P('stop-yiheyuan', '颐和园站', 'Summer Palace bus stop', 'station', [24, 17.4], { label: 'r' }),
  P('station-xizhimen', '西直门站', 'Xizhimen station', 'station', [62.4, 24.4], { label: 'r', apart: true }),
  P('stop-xizhimen', '西直门', 'Xizhimen bus stop', 'station', [60, 26], { label: 'l', apart: true }),

  // 长城 (and the train from 北京北站)
  P('changcheng', '八达岭长城', 'Great Wall at Badaling', 'sight', [13, 3.4], { label: 'r' }),
  P('stop-badalingchangcheng', '八达岭站', 'Badaling station', 'station', [17.4, 7], { label: 'r' }),
  P('stop-beijingbeizhan', '北京北站', 'Beijing North station', 'station', [59.6, 21.6], { label: 'l', apart: true }),

  // 潘家园
  P('panjiayuan-market', '潘家园', 'Panjiayuan market', 'street', [117.6, 82], { label: 'l' }),
  P('station-panjiayuan', '潘家园站', 'Panjiayuan station', 'station', [121, 80.4], { label: 'r' }),
];

const byMap = new Map(PLACES.map((p) => [p.map, p]));
export const placeOf = (map: string): Place | undefined => byMap.get(map);

/** the sketches the game grew from: drawn nowhere, reached from no real map */
export const SKETCHES = new Set(['hutong-proto', 'tiananmen-proto']);

export type MapLinks = Record<string, { district: string; links?: string[] }>;

/**
 * The way on foot from one map to another, through doors and edges: the
 * maps in order, both ends included; null when there is no way without a
 * ride (or either map is unknown).
 */
export function walkPath(index: MapLinks, from: string, to: string): string[] | null {
  if (!index[from] || !index[to]) return null;
  if (from === to) return [from];
  // doors are one-way in the data only by accident: walk them both ways
  const next = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!next.has(a)) next.set(a, new Set());
    next.get(a)!.add(b);
  };
  for (const [m, v] of Object.entries(index)) for (const l of v.links ?? []) if (index[l]) (add(m, l), add(l, m));
  const back = new Map<string, string>([[from, '']]);
  const queue = [from];
  while (queue.length) {
    const m = queue.shift()!;
    if (m === to) break;
    for (const n of [...(next.get(m) ?? [])].sort()) {
      if (back.has(n)) continue;
      back.set(n, m);
      queue.push(n);
    }
  }
  if (!back.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(back.get(path[0]!)!);
  return path;
}

/**
 * The part of the city map a district is drawn in: its places (not the
 * apart ones) with room around them, widened to the drawing's shape.
 */
export function districtFrame(district: string, index: MapLinks, aspect = 1.6): { x: number; y: number; w: number; h: number } | null {
  const pts = PLACES.filter((p) => !p.apart && index[p.map]?.district === district).map((p) => p.at);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 5;
  const [x0, x1, y0, y1] = [Math.min(...xs) - pad * 1.6, Math.max(...xs) + pad * 1.6, Math.min(...ys) - pad, Math.max(...ys) + pad];
  // never closer than 26 units across, so a small district still shows its neighbours
  let w = Math.max(x1 - x0, 26);
  const h = Math.max(y1 - y0, w / aspect);
  w = Math.max(w, h * aspect);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

/** Where a district's name goes on the whole-city map: the middle of its places (not the apart ones). */
export function districtCentre(district: string, index: MapLinks): readonly [number, number] | null {
  const pts = PLACES.filter((p) => !p.apart && index[p.map]?.district === district).map((p) => p.at);
  if (!pts.length) return null;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
