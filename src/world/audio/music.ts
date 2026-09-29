/**
 * The game's music: what plays where, and the notes themselves — a pure
 * answer, so `band.ts` only plays it. Everything is Chinese pentatonic
 * (宫 商 角 徵 羽, do re mi sol la), in the instruments of a small folk band:
 * 古筝 plucked, 笛子 blown, 琵琶 trembling, 笙 holding a chord, 编钟-like
 * bells, the 梆子 woodblock and the 锣鼓 of a festival.
 *
 * The mood follows the game: a cosy 古筝 at home, a skipping tune in the
 * lanes, a brisk one on the busy streets, slow bells in the palace, a flute
 * in the parks, the Great Wall wide and open, a lullaby at night, 锣鼓 and
 * 《新年好》 at 春节, a moon tune at 中秋. Rain thins it, snow adds bells.
 * Sometimes a real folk song comes round — 《茉莉花》 in the lanes and
 * gardens — and the rest is composed as it plays, from a motif repeated and
 * answered, so it is never the same twice and never a jarring loop.
 */

import type { PartOfDay } from '../core/types';
import type { MapLife } from '../core/maptext';
import type { FestivalId, Weather } from '../core/calendar';

export type Lead = 'zheng' | 'dizi' | 'pipa' | 'bells' | 'box';
export type Perc = 'none' | 'block' | 'luogu' | 'drum';
export type Voice = Lead | 'sheng' | 'bass' | 'wood' | 'tang' | 'cymbal' | 'gong';

export interface Mood {
  /** the same id plays on; a new one crossfades */
  id: string;
  /** MIDI note of 宫 (do) */
  key: number;
  /** the mode's home note: 0 宫 (bright), 1 商, 3 徵 (open), 4 羽 (gentle) */
  home: number;
  bpm: number;
  lead: Lead;
  /** who answers the lead in the B phrase */
  answer: Lead | null;
  /** 笙 holds the chord */
  pad: boolean;
  /** 古筝 rolls a low chord each bar */
  bass: boolean;
  perc: Perc;
  /** 0–1: how many short notes the tune uses */
  busy: number;
  /** 0–1: overall loudness of this mood */
  level: number;
  /** bars of quiet between songs */
  rest: number;
  /** a folk song that may come round instead of a composed one */
  tune: TuneId | null;
}

export type Place = 'home' | 'lane' | 'bustle' | 'palace' | 'garden' | 'wall' | 'shop' | 'teahouse' | 'station';

const PLACES: Record<string, Place> = {
  'siheyuan-room': 'home',
  'siheyuan-yard': 'home',
  'hutong-home': 'home',
  'nanluo-main': 'lane',
  'hutong-proto': 'lane',
  'gulou-square': 'lane',
  'subway-lane': 'lane',
  'yonghegong-street': 'lane',
  'qianmen-street': 'bustle',
  'wangfujing-street': 'bustle',
  'sanlitun-street': 'bustle',
  'panjiayuan-market': 'bustle',
  'guomao-plaza': 'bustle',
  'tiananmen-square': 'palace',
  'tiananmen-proto': 'palace',
  taihedian: 'palace',
  wumen: 'palace',
  jiulongbi: 'palace',
  jiaolou: 'palace',
  guozijian: 'palace',
  huiyinbi: 'palace',
  yuhuayuan: 'garden',
  'tiantan-park': 'garden',
  'jingshan-park': 'garden',
  'jingshan-view': 'garden',
  'beihai-north': 'garden',
  'houhai-lake': 'garden',
  'yiheyuan-changlang': 'garden',
  'olympic-park': 'garden',
  changcheng: 'wall',
  chaguan: 'teahouse',
  xiyuan: 'teahouse',
};

/** What kind of place a map is: listed, else guessed from its name and how busy it is. */
export function placeOf(mapId: string, life: MapLife): Place {
  const known = PLACES[mapId];
  if (known) return known;
  if (mapId.startsWith('station-') || mapId.startsWith('stop-')) return 'station';
  if (life.crowd === 0 && life.pigeons === 0 && life.bikes === 0) return 'shop';
  return life.crowd >= 6 ? 'bustle' : 'lane';
}

// C4 = 60. Keys sit where the instruments sound sweet, never too high.
const BASE: Record<Place, Omit<Mood, 'id'>> = {
  home: { key: 60, home: 0, bpm: 76, lead: 'zheng', answer: 'dizi', pad: true, bass: true, perc: 'none', busy: 0.35, level: 0.8, rest: 2, tune: 'molihua' },
  lane: { key: 62, home: 0, bpm: 96, lead: 'dizi', answer: 'zheng', pad: false, bass: true, perc: 'block', busy: 0.55, level: 0.75, rest: 1, tune: 'molihua' },
  bustle: { key: 64, home: 0, bpm: 112, lead: 'pipa', answer: 'dizi', pad: false, bass: true, perc: 'block', busy: 0.75, level: 0.75, rest: 1, tune: null },
  palace: { key: 57, home: 3, bpm: 66, lead: 'bells', answer: 'dizi', pad: true, bass: true, perc: 'drum', busy: 0.2, level: 0.75, rest: 2, tune: null },
  garden: { key: 62, home: 4, bpm: 80, lead: 'dizi', answer: 'zheng', pad: true, bass: true, perc: 'none', busy: 0.35, level: 0.7, rest: 2, tune: 'molihua' },
  wall: { key: 55, home: 3, bpm: 70, lead: 'dizi', answer: 'bells', pad: true, bass: true, perc: 'drum', busy: 0.25, level: 0.8, rest: 2, tune: null },
  shop: { key: 67, home: 0, bpm: 90, lead: 'zheng', answer: null, pad: false, bass: false, perc: 'none', busy: 0.45, level: 0.5, rest: 2, tune: null },
  teahouse: { key: 62, home: 1, bpm: 84, lead: 'pipa', answer: 'zheng', pad: false, bass: true, perc: 'block', busy: 0.5, level: 0.65, rest: 1, tune: 'molihua' },
  station: { key: 64, home: 0, bpm: 100, lead: 'box', answer: null, pad: true, bass: false, perc: 'none', busy: 0.4, level: 0.45, rest: 2, tune: null },
};

export interface Where {
  mapId: string;
  life: MapLife;
  time: PartOfDay;
  weather: Weather;
  festival: FestivalId | null;
}

const indoors = (p: Place) => p === 'home' || p === 'shop' || p === 'teahouse' || p === 'station';

/** The music for where you are, at this hour, in this weather, on this day. */
export function moodFor(w: Where): Mood {
  const place = placeOf(w.mapId, w.life);
  let m: Omit<Mood, 'id'> = { ...BASE[place] };
  let id: string = place;

  // Festivals fill the streets (indoors keeps its own, a little brighter).
  if (w.festival && !indoors(place) && w.time !== 'night') {
    if (w.festival === 'chunjie' || w.festival === 'yuanxiao' || w.festival === 'guoqing') {
      m = { key: 62, home: 0, bpm: 120, lead: 'dizi', answer: 'pipa', pad: false, bass: true, perc: 'luogu', busy: 0.7, level: 0.85, rest: 1, tune: w.festival === 'guoqing' ? null : 'xinnianhao' };
      id = 'festival';
    } else if (w.festival === 'duanwu') {
      m = { ...m, perc: 'drum', bpm: Math.max(m.bpm, 100), busy: Math.max(m.busy, 0.5) };
      id = `${place}+duanwu`;
    } else {
      // 中秋, 七夕: a moon tune
      m = { key: 60, home: 4, bpm: 70, lead: 'dizi', answer: 'bells', pad: true, bass: true, perc: 'none', busy: 0.3, level: 0.7, rest: 2, tune: null };
      id = 'moon';
    }
  }

  if (w.time === 'night') {
    // a lullaby: the music box outdoors, 古筝 indoors; no drums, no hurry
    m = {
      ...m,
      key: 60,
      home: place === 'palace' || place === 'wall' ? 3 : 0,
      bpm: 64,
      lead: indoors(place) ? 'zheng' : 'box',
      answer: indoors(place) ? null : 'zheng',
      pad: true,
      bass: true,
      perc: 'none',
      busy: 0.2,
      level: m.level * 0.7,
      rest: 3,
      tune: null,
    };
    id = `night:${indoors(place) ? 'in' : 'out'}`;
  } else if (w.time === 'evening') {
    m = { ...m, bpm: Math.round(m.bpm * 0.9), busy: m.busy * 0.85, level: m.level * 0.9 };
    id += ':evening';
  } else if (w.time === 'morning' && m.perc === 'block') {
    m = { ...m, bpm: Math.round(m.bpm * 0.95) };
  }

  if (!indoors(place)) {
    if (w.weather === 'rain') {
      // rain on the 古筝: fewer notes, no drums
      m = { ...m, lead: m.lead === 'box' ? 'box' : 'zheng', perc: 'none', busy: m.busy * 0.6, bpm: Math.round(m.bpm * 0.9), level: m.level * 0.85, rest: m.rest + 1 };
      id += ':rain';
    } else if (w.weather === 'snow') {
      m = { ...m, answer: 'bells', perc: m.perc === 'luogu' ? 'luogu' : 'none', busy: m.busy * 0.8 };
      id += ':snow';
    }
  }
  return { id, ...m };
}

// ------------------------------------------------------------ the notes

export interface Note {
  /** start, in beats from the start of the phrase */
  at: number;
  /** length, in beats */
  len: number;
  voice: Voice;
  /** MIDI note; 0 for a drum */
  midi: number;
  /** 0–1 */
  vel: number;
}

export interface Phrase {
  notes: Note[];
  /** length in beats */
  beats: number;
}

/** do re mi sol la */
export const PENTA = [0, 2, 4, 7, 9] as const;

/** A step of the pentatonic scale (any integer, 5 = do an octave up) as a MIDI note. */
export function stepMidi(key: number, step: number): number {
  const oct = Math.floor(step / 5);
  return key + 12 * oct + PENTA[((step % 5) + 5) % 5]!;
}

export type TuneId = 'molihua' | 'xinnianhao';

/**
 * Folk songs, old enough to belong to everyone, as [semitones from do, eighths].
 * 《茉莉花》 (江苏民歌): 好一朵美丽的茉莉花 ×2, 芬芳美丽满枝桠, 又香又白人人夸.
 * 《新年好》: sung by every class at 春节.
 */
export const TUNES: Record<TuneId, { tempo: number; bar: number; lines: [number, number][][] }> = {
  molihua: {
    tempo: 0.8,
    bar: 4,
    lines: [
      [[4, 2], [4, 1], [7, 1], [9, 1], [12, 1], [12, 1], [9, 1], [7, 2], [7, 1], [9, 1], [7, 4]],
      [[4, 2], [4, 1], [7, 1], [9, 1], [12, 1], [12, 1], [9, 1], [7, 2], [7, 1], [9, 1], [7, 4]],
      [[7, 2], [7, 2], [7, 2], [4, 1], [7, 1], [9, 2], [9, 2], [7, 4]],
      [[4, 2], [2, 1], [4, 1], [7, 2], [4, 1], [2, 1], [0, 2], [0, 1], [2, 1], [0, 4]],
    ],
  },
  xinnianhao: {
    tempo: 0.85,
    /** in three */
    bar: 3,
    lines: [
      [[0, 1], [0, 1], [0, 2], [-5, 2], [4, 1], [4, 1], [4, 2], [0, 2]],
      [[0, 1], [4, 1], [7, 2], [7, 2], [5, 1], [4, 1], [2, 4]],
      [[2, 1], [4, 1], [5, 2], [5, 2], [4, 1], [2, 1], [4, 2], [0, 2]],
      [[0, 1], [4, 1], [2, 2], [-5, 2], [-1, 1], [2, 1], [0, 4]],
    ],
  },
};

/** One-bar rhythms in eighths, from long notes to busy ones. */
const CELLS: number[][] = [
  [8],
  [4, 4],
  [6, 2],
  [4, 2, 2],
  [2, 2, 4],
  [3, 1, 4],
  [2, 2, 2, 2],
  [3, 1, 2, 2],
  [2, 1, 1, 4],
  [1, 1, 2, 2, 2],
  [2, 1, 1, 2, 2],
  [1, 1, 1, 1, 2, 2],
];

function pick<T>(xs: readonly T[], rand: () => number): T {
  return xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))]!;
}

/** A rhythm cell for this busyness: calm moods keep to the long ones. */
function cell(busy: number, rand: () => number): number[] {
  const top = Math.max(2, Math.round(2 + busy * (CELLS.length - 2)));
  return pick(CELLS.slice(0, top), rand);
}

/** A walking tune: mostly steps, now and then a leap, kept in a singable range around home. */
function walk(from: number, n: number, home: number, rand: () => number): number[] {
  const out: number[] = [];
  let at = from;
  for (let i = 0; i < n; i++) {
    const r = rand();
    const move = r < 0.2 ? 0 : r < 0.45 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : rand() < 0.5 ? 3 : -3;
    at += move;
    if (at < home - 2) at = home - 2 + (home - 2 - at);
    if (at > home + 6) at = home + 6 - (at - home - 6);
    out.push(at);
  }
  return out;
}

export interface Motif {
  rhythm: number[][];
  steps: number[];
}

/** Two bars that the song is built from. */
export function motif(m: Mood, rand: () => number): Motif {
  const rhythm = [cell(m.busy, rand), cell(m.busy, rand)];
  const n = rhythm[0]!.length + rhythm[1]!.length;
  return { rhythm, steps: walk(m.home + (rand() < 0.5 ? 2 : 5), n, m.home, rand) };
}

/**
 * Four bars of 4/4: the motif, then an answer that comes home — to the
 * tonic (`cadence` 'home') or hanging on the fifth ('open').
 */
export function phrase(m: Mood, mo: Motif, rand: () => number, opts: { lead: Lead; cadence: 'home' | 'open'; vary: number }): Phrase {
  const notes: Note[] = [];
  let at = 0;
  let steps = mo.steps.slice();
  // a varied repeat: the second half of the motif walks elsewhere
  if (opts.vary > 0) {
    const keep = Math.floor(steps.length * (1 - opts.vary));
    steps = steps.slice(0, keep).concat(walk(steps[keep - 1] ?? m.home, steps.length - keep, m.home, rand));
  }
  const bars = [...mo.rhythm, cell(m.busy * 0.8, rand), [...pick([[6, 2], [4, 4], [2, 2, 4], [8]], rand)]];
  const tail = walk(steps[steps.length - 1] ?? m.home, bars[2]!.length + bars[3]!.length, m.home, rand);
  const all = steps.concat(tail);
  // land: the last note home (or on the open fifth), the one before a step away
  const end = opts.cadence === 'home' ? m.home + (all[all.length - 2]! >= m.home + 3 ? 5 : 0) : m.home + 3;
  all[all.length - 1] = end;
  if (all.length > 1) all[all.length - 2] = end + (rand() < 0.5 ? 1 : -1);
  let i = 0;
  for (const bar of bars) {
    for (const eighths of bar) {
      const beats = eighths / 2;
      notes.push({ at, len: beats, voice: opts.lead, midi: stepMidi(m.key, all[i]!), vel: at % 2 === 0 ? 0.85 : 0.7 });
      at += beats;
      i++;
    }
  }
  return { notes, beats: 16 };
}

/** The band under a phrase of `beats`: 古筝 rolling the chord, 笙 holding it, and the drums. */
export function backing(m: Mood, beats: number, cadence: 'home' | 'open', rand: () => number, festive = false, bar = 4): Note[] {
  const out: Note[] = [];
  const bars = Math.round(beats / bar);
  for (let b = 0; b < bars; b++) {
    const at = b * bar;
    // home, then the fifth, and home again (or open at the end)
    const root = b === bars - 1 ? (cadence === 'home' ? m.home : m.home + 3) : b % 2 === 0 ? m.home : m.home + (rand() < 0.5 ? 3 : -2);
    const low = m.key - 12;
    if (m.bass) {
      const roll = [root - 5, root - 2, root];
      roll.forEach((s, k) => out.push({ at: at + k * 0.5, len: bar - 1, voice: 'bass', midi: stepMidi(low, s + 5), vel: k === 0 ? 0.7 : 0.45 }));
      if (m.busy > 0.4 && bar === 4) out.push({ at: at + 2, len: 2, voice: 'bass', midi: stepMidi(low, root + 5), vel: 0.4 });
    }
    if (m.pad && b % 2 === 0) {
      for (const s of [root, root + 3, root + 5]) out.push({ at, len: bar * 2, voice: 'sheng', midi: stepMidi(m.key - 12, s), vel: 0.35 });
    }
    out.push(...drums(m.perc, at, b, bars, festive).filter((n) => n.at < at + bar));
  }
  return out;
}

function drums(perc: Perc, at: number, bar: number, bars: number, festive: boolean): Note[] {
  const out: Note[] = [];
  const hit = (dt: number, voice: Voice, vel: number) => out.push({ at: at + dt, len: 0.5, voice, midi: 0, vel });
  if (perc === 'block') {
    // 梆子: on the beat, the first strongest, a little skip before the fourth
    hit(0, 'wood', 0.8);
    hit(1, 'wood', 0.45);
    hit(2, 'wood', 0.6);
    hit(3, 'wood', 0.45);
    if (bar % 2 === 1) hit(3.5, 'wood', 0.35);
  } else if (perc === 'drum') {
    hit(0, 'tang', 0.7);
    if (bar % 2 === 1) hit(2.5, 'tang', 0.4);
    if (bar === bars - 1) hit(3, 'tang', 0.5);
  } else if (perc === 'luogu') {
    // 锣鼓: drum on the beats, cymbal on the offbeats, the small gong answering
    for (const dt of [0, 1, 2, 3]) hit(dt, 'tang', dt === 0 ? 0.8 : 0.5);
    for (const dt of [0.5, 1.5, 2.5, 3.5]) hit(dt, 'cymbal', 0.35);
    hit(bar % 2 === 0 ? 0 : 2, 'gong', festive ? 0.6 : 0.45);
    if (bar === bars - 1) {
      hit(3.25, 'tang', 0.6);
      hit(3.5, 'tang', 0.7);
      hit(3.75, 'tang', 0.8);
    }
  }
  return out;
}

/** A folk song, one line per phrase, in this mood's key and band. */
export function tunePhrases(id: TuneId, m: Mood, lead: Lead): Phrase[] {
  return TUNES[id].lines.map((line) => {
    const notes: Note[] = [];
    let at = 0;
    for (const [semi, eighths] of line) {
      notes.push({ at, len: eighths / 2, voice: lead, midi: m.key + semi, vel: at % 2 === 0 ? 0.85 : 0.7 });
      at += eighths / 2;
    }
    return { notes, beats: at };
  });
}

/**
 * A whole song: motif, varied repeat, the answer (by the second voice),
 * the motif coming home — or, now and then, the mood's folk song. The band
 * plays under each phrase; quiet bars after.
 */
export function song(m: Mood, rand: () => number, n: number): { phrases: Phrase[]; tempo: number } {
  const tune = m.tune && (n === 1 || rand() < 0.3) ? m.tune : null;
  if (tune) {
    const lead = m.lead === 'box' || m.lead === 'bells' ? 'zheng' : m.lead;
    const lines = tunePhrases(tune, m, lead);
    const phrases = lines.map((p, i) => ({
      notes: [...p.notes, ...backing(m, p.beats, i === lines.length - 1 ? 'home' : 'open', rand, tune === 'xinnianhao', TUNES[tune].bar)],
      beats: p.beats,
    }));
    return { phrases: withRest(phrases, m), tempo: TUNES[tune].tempo };
  }
  const mo = motif(m, rand);
  const second = m.answer ?? m.lead;
  const plan: { lead: Lead; cadence: 'home' | 'open'; vary: number }[] = [
    { lead: m.lead, cadence: 'open', vary: 0 },
    { lead: m.lead, cadence: 'home', vary: 0.4 },
    { lead: second, cadence: 'open', vary: 0.9 },
    { lead: m.lead, cadence: 'home', vary: 0 },
  ];
  const phrases = plan.map((p) => {
    const ph = phrase(m, mo, rand, p);
    return { notes: [...ph.notes, ...backing(m, ph.beats, p.cadence, rand, m.perc === 'luogu')], beats: ph.beats };
  });
  return { phrases: withRest(phrases, m), tempo: 1 };
}

function withRest(phrases: Phrase[], m: Mood): Phrase[] {
  if (m.rest <= 0) return phrases;
  // the last chord rings into the quiet; a soft pad note keeps it from feeling dead
  return [...phrases, { notes: [], beats: m.rest * 4 }];
}
