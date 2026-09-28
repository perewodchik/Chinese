/**
 * Getting around Beijing: a small but true piece of the subway, two buses
 * and the train to the Great Wall (prompt §8, concept §5).
 *
 * The subway lines are real and so are the stations, in their real order,
 * and lines meet at the real transfer stations. Only the parts the game
 * needs are here: Line 2 is the whole loop; Line 10, really a loop too, is
 * only its eastern arc from 北土城 to 十里河; the others are their central
 * stretches.
 *
 * Routes: fewest changes first, then fewest stops. A change between two
 * lines at one station is a change; walking from a station to a bus stop
 * next to it is one too.
 */

export type Mode = 'subway' | 'bus' | 'train';

export interface Station {
  id: string;
  zh: string;
  en: string;
}

export interface Line {
  id: string;
  mode: Mode;
  /** 2号线, 332路, 京张高铁 */
  zh: string;
  en: string;
  color: string;
  /** in order; for a loop, the last runs on to the first */
  stops: string[];
  loop?: boolean;
  /** the direction names of a loop: running with the list, and against it */
  loopNames?: readonly [string, string];
}

const S = (id: string, zh: string, en: string): Station => ({ id, zh, en });

export const STATIONS: readonly Station[] = [
  // Line 1
  S('fuxingmen', '复兴门', 'Fuxingmen'),
  S('xidan', '西单', 'Xidan'),
  S('tiananmenxi', '天安门西', 'Tiananmen West'),
  S('tiananmendong', '天安门东', 'Tiananmen East'),
  S('wangfujing', '王府井', 'Wangfujing'),
  S('dongdan', '东单', 'Dongdan'),
  S('jianguomen', '建国门', 'Jianguomen'),
  S('yonganli', '永安里', "Yong'anli"),
  S('guomao', '国贸', 'Guomao'),
  S('dawanglu', '大望路', 'Dawanglu'),
  // Line 2
  S('xizhimen', '西直门', 'Xizhimen'),
  S('jishuitan', '积水潭', 'Jishuitan'),
  S('guloudajie', '鼓楼大街', 'Guloudajie'),
  S('andingmen', '安定门', 'Andingmen'),
  S('yonghegong', '雍和宫', 'Yonghegong Lama Temple'),
  S('dongzhimen', '东直门', 'Dongzhimen'),
  S('dongsishitiao', '东四十条', 'Dongsishitiao'),
  S('chaoyangmen', '朝阳门', 'Chaoyangmen'),
  S('beijingzhan', '北京站', 'Beijing Railway Station'),
  S('chongwenmen', '崇文门', 'Chongwenmen'),
  S('qianmen', '前门', 'Qianmen'),
  S('hepingmen', '和平门', 'Hepingmen'),
  S('xuanwumen', '宣武门', 'Xuanwumen'),
  S('changchunjie', '长椿街', 'Changchunjie'),
  S('fuchengmen', '阜成门', 'Fuchengmen'),
  S('chegongzhuang', '车公庄', 'Chegongzhuang'),
  // Line 5
  S('huixinxijienankou', '惠新西街南口', 'Huixinxijie Nankou'),
  S('hepingxiqiao', '和平西桥', 'Hepingxiqiao'),
  S('hepinglibeijie', '和平里北街', 'Hepingli Beijie'),
  S('beixinqiao', '北新桥', 'Beixinqiao'),
  S('zhangzizhonglu', '张自忠路', 'Zhangzizhonglu'),
  S('dongsi', '东四', 'Dongsi'),
  S('dengshikou', '灯市口', 'Dengshikou'),
  S('ciqikou', '磁器口', 'Ciqikou'),
  S('tiantandongmen', '天坛东门', 'Temple of Heaven East Gate'),
  S('puhuangyu', '蒲黄榆', 'Puhuangyu'),
  // Line 6
  S('pinganli', '平安里', "Ping'anli"),
  S('beihaibei', '北海北', 'Beihai North'),
  S('nanluoguxiang', '南锣鼓巷', 'Nanluoguxiang'),
  S('dongdaqiao', '东大桥', 'Dongdaqiao'),
  S('hujialou', '呼家楼', 'Hujialou'),
  S('jintailu', '金台路', 'Jintailu'),
  // Line 8
  S('aolinpikegongyuan', '奥林匹克公园', 'Olympic Park'),
  S('aotizhongxin', '奥体中心', 'Olympic Sports Center'),
  S('beitucheng', '北土城', 'Beitucheng'),
  S('anhuaqiao', '安华桥', 'Anhuaqiao'),
  S('andelibeijie', '安德里北街', 'Andeli Beijie'),
  S('shichahai', '什刹海', 'Shichahai'),
  S('zhongguomeishuguan', '中国美术馆', 'National Art Museum'),
  S('jinyuhutong', '金鱼胡同', 'Jinyu Hutong'),
  S('zhushikou', '珠市口', 'Zhushikou'),
  S('tianqiao', '天桥', 'Tianqiao'),
  // Line 10 (eastern arc)
  S('anzhenmen', '安贞门', 'Anzhenmen'),
  S('shaoyaoju', '芍药居', 'Shaoyaoju'),
  S('taiyanggong', '太阳宫', 'Taiyanggong'),
  S('sanyuanqiao', '三元桥', 'Sanyuanqiao'),
  S('liangmaqiao', '亮马桥', 'Liangmaqiao'),
  S('nongyezhanlanguan', '农业展览馆', 'Agricultural Exhibition Center'),
  S('tuanjiehu', '团结湖', 'Tuanjiehu'),
  S('jintaixizhao', '金台夕照', 'Jintaixizhao'),
  S('shuangjing', '双井', 'Shuangjing'),
  S('jinsong', '劲松', 'Jinsong'),
  S('panjiayuan', '潘家园', 'Panjiayuan'),
  S('shilihe', '十里河', 'Shilihe'),
  // Buses and the train
  S('dongwuyuan', '动物园', 'Beijing Zoo'),
  S('yiheyuan', '颐和园', 'Summer Palace'),
  S('beijingbeizhan', '北京北站', 'Beijing North Railway Station'),
  S('qinghe', '清河', 'Qinghe'),
  S('badalingchangcheng', '八达岭长城', 'Badaling Great Wall'),
];

export const LINES: readonly Line[] = [
  {
    id: 'l1', mode: 'subway', zh: '1号线', en: 'Line 1', color: '#c23a30',
    stops: ['fuxingmen', 'xidan', 'tiananmenxi', 'tiananmendong', 'wangfujing', 'dongdan', 'jianguomen', 'yonganli', 'guomao', 'dawanglu'],
  },
  {
    id: 'l2', mode: 'subway', zh: '2号线', en: 'Line 2', color: '#006098', loop: true,
    // Clockwise on the map is 外环, the outer loop; against it, 内环.
    loopNames: ['外环', '内环'],
    stops: [
      'xizhimen', 'jishuitan', 'guloudajie', 'andingmen', 'yonghegong', 'dongzhimen', 'dongsishitiao', 'chaoyangmen',
      'jianguomen', 'beijingzhan', 'chongwenmen', 'qianmen', 'hepingmen', 'xuanwumen', 'changchunjie', 'fuxingmen',
      'fuchengmen', 'chegongzhuang',
    ],
  },
  {
    id: 'l5', mode: 'subway', zh: '5号线', en: 'Line 5', color: '#a6217f',
    stops: [
      'huixinxijienankou', 'hepingxiqiao', 'hepinglibeijie', 'yonghegong', 'beixinqiao', 'zhangzizhonglu', 'dongsi',
      'dengshikou', 'dongdan', 'chongwenmen', 'ciqikou', 'tiantandongmen', 'puhuangyu',
    ],
  },
  {
    id: 'l6', mode: 'subway', zh: '6号线', en: 'Line 6', color: '#b58500',
    stops: ['chegongzhuang', 'pinganli', 'beihaibei', 'nanluoguxiang', 'dongsi', 'chaoyangmen', 'dongdaqiao', 'hujialou', 'jintailu'],
  },
  {
    id: 'l8', mode: 'subway', zh: '8号线', en: 'Line 8', color: '#009b6b',
    stops: [
      'aolinpikegongyuan', 'aotizhongxin', 'beitucheng', 'anhuaqiao', 'andelibeijie', 'guloudajie', 'shichahai',
      'nanluoguxiang', 'zhongguomeishuguan', 'jinyuhutong', 'wangfujing', 'qianmen', 'zhushikou', 'tianqiao',
    ],
  },
  {
    id: 'l10', mode: 'subway', zh: '10号线', en: 'Line 10', color: '#0092bc',
    stops: [
      'beitucheng', 'anzhenmen', 'huixinxijienankou', 'shaoyaoju', 'taiyanggong', 'sanyuanqiao', 'liangmaqiao',
      'nongyezhanlanguan', 'tuanjiehu', 'hujialou', 'jintaixizhao', 'guomao', 'shuangjing', 'jinsong', 'panjiayuan', 'shilihe',
    ],
  },
  {
    id: 'b332', mode: 'bus', zh: '332路', en: 'Bus 332', color: '#d9534f',
    stops: ['xizhimen', 'dongwuyuan', 'yiheyuan'],
  },
  {
    id: 'b34', mode: 'bus', zh: '34路', en: 'Bus 34', color: '#d9534f',
    stops: ['tiantandongmen', 'panjiayuan'],
  },
  {
    id: 'jingzhang', mode: 'train', zh: '京张高铁', en: 'Beijing–Zhangjiakou high-speed railway', color: '#555555',
    stops: ['beijingbeizhan', 'qinghe', 'badalingchangcheng'],
  },
];

/** Stations close enough to walk between: a line change on foot. */
export const WALKS: readonly (readonly [string, string])[] = [['xizhimen', 'beijingbeizhan']];

const stationById = new Map(STATIONS.map((s) => [s.id, s]));
const lineById = new Map(LINES.map((l) => [l.id, l]));

export const station = (id: string): Station => {
  const s = stationById.get(id);
  if (!s) throw new Error(`unknown station ${id}`);
  return s;
};
export const line = (id: string): Line => {
  const l = lineById.get(id);
  if (!l) throw new Error(`unknown line ${id}`);
  return l;
};

/** The lines that stop at a station. */
export function linesAt(id: string): Line[] {
  return LINES.filter((l) => l.stops.includes(id));
}

/** The subway lines to change to at a station, not counting `from`. */
export const changesAt = (id: string, from?: string) => linesAt(id).filter((l) => l.mode === 'subway' && l.id !== from);

export interface Leg {
  line: string;
  mode: Mode | 'walk';
  from: string;
  to: string;
  /** stations passed, `from` first and `to` last */
  stops: string[];
  /** 往天安门东方向, or 外环 / 内环 on a loop */
  direction: string;
}

export interface Route {
  legs: Leg[];
  changes: number;
  stops: number;
  fare: number;
}

interface Edge {
  to: string;
  line: string;
  /** +1 along the list, -1 against it */
  dir: 1 | -1;
}

function edgesFrom(id: string): Edge[] {
  const out: Edge[] = [];
  for (const l of LINES) {
    const i = l.stops.indexOf(id);
    if (i < 0) continue;
    const n = l.stops.length;
    if (i + 1 < n || l.loop) out.push({ to: l.stops[(i + 1) % n]!, line: l.id, dir: 1 });
    if (i > 0 || l.loop) out.push({ to: l.stops[(i - 1 + n) % n]!, line: l.id, dir: -1 });
  }
  for (const [a, b] of WALKS) {
    if (a === id) out.push({ to: b, line: 'walk', dir: 1 });
    if (b === id) out.push({ to: a, line: 'walk', dir: 1 });
  }
  return out;
}

const CHANGE = 1000;

/**
 * The best route: fewest changes, then fewest stops. Null when there is no
 * way, or when `from` is `to`.
 */
export function findRoute(from: string, to: string): Route | null {
  station(from);
  station(to);
  if (from === to) return null;
  // State: at a station, on a line going one way. Dijkstra, small graph.
  type St = { at: string; line: string; dir: number; cost: number; prev: St | null };
  const key = (s: { at: string; line: string; dir: number }) => `${s.at}|${s.line}|${s.dir}`;
  const best = new Map<string, number>();
  const queue: St[] = [{ at: from, line: '', dir: 0, cost: 0, prev: null }];
  let done: St | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    if (cur.at === to) {
      done = cur;
      break;
    }
    for (const e of edgesFrom(cur.at)) {
      const change = cur.line !== '' && (cur.line !== e.line || cur.dir !== e.dir);
      // Turning round on the same line is a change too (get off, cross the platform).
      const cost = cur.cost + 1 + (change ? CHANGE : 0);
      const next: St = { at: e.to, line: e.line, dir: e.dir, cost, prev: cur };
      const k = key(next);
      if ((best.get(k) ?? Infinity) <= cost) continue;
      best.set(k, cost);
      queue.push(next);
    }
  }
  if (!done) return null;
  const path: St[] = [];
  for (let s: St | null = done; s; s = s.prev) path.push(s);
  path.reverse();

  const legs: Leg[] = [];
  for (let i = 1; i < path.length; i++) {
    const s = path[i]!;
    const last = legs.at(-1);
    if (last && last.line === s.line && path[i - 1]!.line === s.line && path[i - 1]!.dir === s.dir) {
      last.stops.push(s.at);
      last.to = s.at;
      continue;
    }
    legs.push({
      line: s.line,
      mode: s.line === 'walk' ? 'walk' : line(s.line).mode,
      from: path[i - 1]!.at,
      to: s.at,
      stops: [path[i - 1]!.at, s.at],
      direction: '',
    });
  }
  for (const leg of legs) leg.direction = directionOf(leg, path);
  const stops = legs.reduce((n, l) => n + l.stops.length - 1, 0);
  return { legs, changes: legs.length - 1, stops, fare: fareOf(legs) };
}

function directionOf(leg: Leg, path: { at: string; line: string; dir: number }[]): string {
  if (leg.mode === 'walk') return '';
  const l = line(leg.line);
  const step = path.find((p) => p.line === leg.line && p.at === leg.stops[1]);
  const dir = step?.dir ?? 1;
  if (l.loop && l.loopNames) return dir === 1 ? l.loopNames[0] : l.loopNames[1];
  const end = dir === 1 ? l.stops.at(-1)! : l.stops[0]!;
  return `往${station(end).zh}方向`;
}

/**
 * Yuan. Subway by distance, as Beijing charges: 3 up to 6 km, 4 up to 12,
 * 5 up to 22, 6 up to 32, then one more per 20 km — the distance taken as
 * 1.3 km a stop over the whole ride (one ticket through changes). Buses 2,
 * the train to the Wall 20.
 */
export const KM_PER_STOP = 1.3;
export function subwayFare(stops: number): number {
  const km = stops * KM_PER_STOP;
  if (km <= 6) return 3;
  if (km <= 12) return 4;
  if (km <= 22) return 5;
  if (km <= 32) return 6;
  return 6 + Math.ceil((km - 32) / 20);
}

function fareOf(legs: Leg[]): number {
  let fare = 0;
  let subwayStops = 0;
  const flush = () => {
    if (subwayStops) fare += subwayFare(subwayStops);
    subwayStops = 0;
  };
  for (const l of legs) {
    if (l.mode === 'subway') subwayStops += l.stops.length - 1;
    else {
      flush();
      if (l.mode === 'bus') fare += 2;
      if (l.mode === 'train') fare += 20;
    }
  }
  flush();
  return fare;
}

/** The companion's directions, English with hanzi names: "Line 6 to 东四, change to Line 5 …". */
export function routeText(r: Route): string {
  const parts = r.legs.map((l, i) => {
    const to = station(l.to).zh;
    if (l.mode === 'walk') return `walk to ${to}`;
    const name = line(l.line).en;
    return i === 0 ? `${name} to ${to}` : `change to ${name} to ${to}`;
  });
  const s = parts.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

/** What the train says as it leaves a station: 「下一站：东四。可以换乘5号线。」 */
export function announcement(lineId: string, next: string, isLast = false): string {
  const l = line(lineId);
  const s = station(next).zh;
  if (l.mode === 'bus') return `下一站：${s}。`;
  const changes = changesAt(next, lineId).map((x) => x.zh);
  const head = isLast ? `下一站：${s}，终点站。` : `下一站：${s}。`;
  return changes.length ? `${head}可以换乘${changes.join('、')}。` : head;
}

/** A key for `save.rides`: after three rides on a route the announcement can be skipped. */
export const rideKey = (from: string, to: string) => `${from}>${to}`;
