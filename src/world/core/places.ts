/**
 * Every map of the game as a place: its name, in Chinese and English, and
 * what kind of place it is (a shop or a room is drawn as a card at its door
 * on the neighbourhood plans, core/hoods.ts). How the maps join — doors and
 * edges — comes from the build: `links` in public/world/maps/index.json,
 * walked by `walkPath`. Pure, so tests check every map has a place.
 */

export type PlaceKind = 'street' | 'sight' | 'inside' | 'station';

export interface Place {
  map: string;
  zh: string;
  en: string;
  kind: PlaceKind;
}

const P = (map: string, zh: string, en: string, kind: PlaceKind): Place => ({ map, zh, en, kind });

export const PLACES: readonly Place[] = [
  // 鼓楼 · 南锣鼓巷
  P('gulou-square', '钟鼓楼', 'The Drum and Bell Towers', 'sight'),
  P('gulou-dongdajie', '鼓楼东大街', 'Gulou East Street', 'street'),
  P('siheyuan-yard', '四合院', 'The courtyard where you live', 'street'),
  P('siheyuan-room', '我的房间', 'Your room', 'inside'),
  P('hutong-home', '帽儿胡同', "Mao'er Hutong", 'street'),
  P('nanluo-main', '南锣鼓巷', 'Nanluoguxiang', 'street'),
  P('zaodian', '早点铺', 'Breakfast shop', 'inside'),
  P('xiaomaibu', '小卖部', 'Corner shop', 'inside'),
  P('lifadian', '理发店', 'Barber', 'inside'),
  P('chaguan', '茶馆', 'Teahouse', 'inside'),
  P('subway-lane', '地安门东大街', "Di'anmen East Street", 'street'),
  P('station-nanluoguxiang', '南锣鼓巷站', 'Nanluoguxiang station', 'station'),
  P('hutong-proto', '胡同', 'A hutong (the first sketch)', 'street'),

  // 什刹海 · 后海
  P('houhai-lake', '后海', 'Houhai lake', 'sight'),
  P('yandai-xiejie', '烟袋斜街', 'Yandai Xiejie, the slanting street', 'street'),
  P('gongwangfu', '恭王府', "Prince Gong's Mansion — its garden", 'sight'),
  P('station-shichahai', '什刹海站', 'Shichahai station', 'station'),

  // 景山 · 北海
  P('beihai-north', '北海北门', 'Beihai Park, north gate', 'sight'),
  P('beihai-baita', '白塔', 'The White Dagoba on Qionghua Island', 'sight'),
  P('station-beihaibei', '北海北站', 'Beihai North station', 'station'),
  P('jingshan-park', '景山公园', 'Jingshan Park', 'sight'),
  P('jingshan-view', '万春亭', 'The view from Jingshan hill', 'sight'),
  P('jiaolou', '角楼', 'The palace corner tower', 'sight'),

  // 天安门 · 故宫
  P('yuhuayuan', '御花园', 'Imperial Garden', 'sight'),
  P('jiulongbi', '九龙壁', 'Nine Dragon Wall', 'sight'),
  P('taihedian', '太和殿', 'Hall of Supreme Harmony', 'sight'),
  P('wumen', '午门', 'Meridian Gate', 'sight'),
  P('tiananmen-square', '天安门广场', 'Tiananmen Square', 'sight'),
  P('station-tiananmendong', '天安门东站', 'Tiananmen East station', 'station'),
  P('tiananmen-proto', '天安门', 'Tiananmen (the first sketch)', 'sight'),

  // 王府井
  P('wangfujing-street', '王府井大街', 'Wangfujing Street', 'street'),
  P('station-wangfujing', '王府井站', 'Wangfujing station', 'station'),
  P('shudian', '书店', 'Bookshop', 'inside'),
  P('baihuo-1', '百货大楼', 'Department store', 'inside'),
  P('baihuo-2', '百货大楼二楼', 'Department store, upstairs', 'inside'),
  P('yaodian', '药店', 'Pharmacy', 'inside'),
  P('yinhang', '银行', 'Bank', 'inside'),

  // 前门 · 大栅栏
  P('station-qianmen', '前门站', 'Qianmen station', 'station'),
  P('qianmen-street', '前门大街', 'Qianmen Street', 'street'),
  P('xiyuan', '戏园', 'Opera house', 'inside'),
  P('ruifuxiang', '瑞蚨祥', 'Ruifuxiang silk shop', 'inside'),
  P('neiliansheng', '内联升', 'Neiliansheng shoe shop', 'inside'),

  // 天坛
  P('huiyinbi', '回音壁', 'Echo Wall', 'sight'),
  P('qiniandian', '祈年殿', 'Hall of Prayer for Good Harvests', 'sight'),
  P('huanqiu', '圜丘', 'Circular Mound Altar', 'sight'),
  P('tiantan-park', '天坛公园', 'Temple of Heaven Park', 'sight'),
  P('station-tiantandongmen', '天坛东门站', 'Tiantan East Gate station', 'station'),

  // 雍和宫 · 国子监
  P('guozijian', '国子监', 'Imperial Academy', 'sight'),
  P('kongmiao', '孔庙', 'Confucius Temple', 'sight'),
  P('yonghegong-front', '雍和宫', 'Lama Temple, the courtyards', 'sight'),
  P('yonghegong-wanfuge', '万福阁', 'Wanfu Pavilion, the Maitreya', 'inside'),
  P('ditan', '地坛', 'Ditan Park, the Temple of Earth', 'sight'),
  P('baiyunguan', '白云观', 'White Cloud Temple', 'sight'),
  P('station-muxidi', '木樨地站', 'Muxidi station', 'station'),
  P('dongyuemiao', '东岳庙', 'Dongyue Temple', 'sight'),
  P('station-chaoyangmen', '朝阳门站', 'Chaoyangmen station', 'station'),
  P('yonghegong-street', '雍和宫大街', 'Yonghegong Street', 'street'),
  P('station-yonghegong', '雍和宫站', 'Yonghegong station', 'station'),

  // 三里屯 · 国贸
  P('sanlitun-street', '三里屯', 'Sanlitun', 'street'),
  P('station-tuanjiehu', '团结湖站', 'Tuanjiehu station', 'station'),
  P('guomao-plaza', '国贸', 'Guomao (the CBD)', 'street'),
  P('station-guomao', '国贸站', 'Guomao station', 'station'),
  P('guomao-bank', '银行', 'Bank', 'inside'),
  P('bianlidian', '便利店', 'Convenience store', 'inside'),

  // 奥林匹克公园
  P('olympic-park', '奥林匹克公园', 'Olympic Park', 'sight'),
  P('station-aolinpikegongyuan', '奥林匹克公园站', 'Olympic Park station', 'station'),

  // 颐和园 (and the bus from 西直门)
  P('yiheyuan-changlang', '长廊', 'The Long Corridor', 'sight'),
  P('stop-yiheyuan', '颐和园站', 'Summer Palace bus stop', 'station'),
  P('station-xizhimen', '西直门站', 'Xizhimen station', 'station'),
  P('stop-xizhimen', '西直门', 'Xizhimen bus stop', 'station'),

  // 长城 (and the train from 北京北站)
  P('changcheng', '八达岭长城', 'Great Wall at Badaling', 'sight'),
  P('stop-badalingchangcheng', '八达岭站', 'Badaling station', 'station'),
  P('stop-beijingbeizhan', '北京北站', 'Beijing North station', 'station'),

  // 潘家园
  P('panjiayuan-market', '潘家园', 'Panjiayuan market', 'street'),
  P('station-panjiayuan', '潘家园站', 'Panjiayuan station', 'station'),
];

const byMap = new Map(PLACES.map((p) => [p.map, p]));
export const placeOf = (map: string): Place | undefined => byMap.get(map);

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
