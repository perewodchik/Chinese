/**
 * The diary 日记 (prompt X3): every game day writes itself, in simple
 * Chinese, from what you did.
 *
 * The save keeps a short list of events per day (`diary`), each a compact
 * code written by `save.ts` as actions land — `m:wang-ayi` (met someone),
 * `s:shishizi` (a spirit found), `t:wangfujing` (rode somewhere new) … — and
 * `diaryLines` turns a day's codes into sentences from fixed templates. The
 * templates are held to the word budget like any scene (`DIARY_SCENE`,
 * checked by a test); what fills them are names.
 */

import { festivalOf } from './calendar';
import { priceZh } from './shop';
import { dayOf } from './clock';
import { districtInfo } from './districts';
import { STATIONS } from './travel';
import type { DistrictContent, Scene, WorldSave } from './types';

/** the days kept, and the events a day keeps */
export const DIARY_DAYS = 60;
export const DIARY_PER_DAY = 16;

/** What a template says; `{x}` is what the event names, `{y}` a second name. */
export const TEMPLATES: Record<string, { zh: string; en: string }> = {
  h: { zh: '今天是{x}。', en: 'Today is {x}.' },
  d: { zh: '今天我第一次去了{x}。', en: 'Today I went to {x} for the first time.' },
  m: { zh: '我认识了{x}。', en: 'I met {x}.' },
  n: { zh: '我告诉{x}，我叫{y}。', en: 'I told {x} my name is {y}.' },
  f: { zh: '{x}和我是好朋友了。', en: '{x} and I are good friends now.' },
  g: { zh: '我给了{x}{y}。', en: 'I gave {x} {y}.' },
  x: { zh: '我有了{x}。', en: 'I got {x}.' },
  t: { zh: '我坐车到了{x}。', en: 'I rode to {x}.' },
  s: { zh: '我找到了{x}！它现在是我的朋友。', en: 'I found {x}! It is my friend now.' },
  i: { zh: '我听到了一个成语：{x}。这个成语很有意思。', en: 'I heard a 成语: {x}. An interesting one.' },
  r: { zh: '我的房间里有了{x}。', en: 'My room has {x} now.' },
  c: { zh: '我的猫叫{x}。', en: 'My cat is called {x}.' },
  k: { zh: '我给小猫吃了东西。', en: 'I fed the little cat.' },
  e: { zh: '我吃了{x}。', en: 'I ate {x}.' },
  b: { zh: '我花了{y}买{x}。', en: 'I spent {y} on {x}.' },
  $: { zh: '我挣了{x}，是我自己挣的！', en: 'I earned {x} — earned it myself!' },
  w: { zh: '我喝了{x}。', en: 'I drank {x}.' },
  p: { zh: '今天我拍了照片。照片拍得很好！', en: 'Today I took photos. They came out well!' },
  z: { zh: '晚上我在家睡觉了。', en: 'In the evening I slept at home.' },
};
export const EMPTY_DAY = { zh: '今天没有什么事。', en: 'Nothing much happened today.' };

/** The templates as a scene, so the budget checker reads them (placeholders left out). */
export const DIARY_SCENE: Scene = {
  id: 'diary',
  map: '',
  trigger: 'look',
  start: 'd',
  words: [
    { w: '成语', explain: '四个字的老话。', en: 'a four-character idiom' },
    { w: '照片', explain: '用手机拍的画。', en: 'photo' },
    { w: '拍', explain: '用手机做照片。', en: 'to take (a photo)' },
    { w: '挣', explain: '做事，有了钱。', en: 'to earn' },
  ],
  nodes: [...Object.entries(TEMPLATES), ['empty', EMPTY_DAY] as const].map(([id, t]) => ({
    id,
    say: t.zh.replace(/\{[xy]\}/g, ''),
    translate: t.en,
  })),
};

/** The codes one action adds to the day, given the save before and after it. */
export function eventsOf(before: WorldSave, after: WorldSave, a: { do: string }, npc?: string): string[] {
  const x = a as unknown as Record<string, unknown> & { do: string };
  switch (x.do) {
    case 'district':
      return before.districts.includes(String(x.district)) ? [] : [`d:${x.district}`];
    case 'meet':
      return before.npcs[String(x.npc)] ? [] : [`m:${x.npc}`];
    case 'spirit':
      return [`s:${x.spirit}`];
    case 'idiom':
      return [`i:${x.idiom}`];
    case 'station':
      return [`t:${x.station}`];
    case 'give':
      return [`x:${x.item}`];
    case 'gifted':
      return x.item ? [`g:${x.npc}:${x.item}`] : [];
    case 'name':
      return npc ? [`n:${npc}:${after.name}`] : [];
    case 'sleep':
      return ['z'];
    case 'place':
      return [`r:${x.item}`];
    case 'feed_cat':
      return ['k'];
    case 'eat':
      return [`e:${x.item}`];
    case 'buy':
      return [`b:${x.item}:${x.price}`];
    case 'earn':
      return [`$:${x.amount}`];
    case 'photo':
      return ['p'];
    case 'cat_name':
      return [`c:${after.cat.name}`];
    case 'hearts':
    case 'talked': {
      const id = String(x.npc);
      const was = before.npcs[id]?.hearts ?? 0;
      const now = after.npcs[id]?.hearts ?? 0;
      return was < 3 && now >= 3 ? [`f:${id}`] : [];
    }
    default:
      return [];
  }
}

/** The save with today's new codes added (each once a day), old days dropped. */
export function logDay(s: WorldSave, codes: readonly string[], clock = s.clock): WorldSave {
  if (!codes.length) return s;
  const day = String(dayOf(clock));
  const cur = s.diary[day] ?? [];
  const add = codes.filter((c, i) => !cur.includes(c) && codes.indexOf(c) === i);
  if (!add.length || cur.length >= DIARY_PER_DAY) return s;
  const diary = { ...s.diary, [day]: [...cur, ...add].slice(0, DIARY_PER_DAY) };
  const keep = Object.keys(diary).map(Number).sort((p, q) => q - p).slice(0, DIARY_DAYS);
  return { ...s, diary: Object.fromEntries(keep.map((d) => [String(d), diary[String(d)]!])) };
}

export interface DiaryLine {
  zh: string;
  en: string;
}

export interface Names {
  /** is it a drink (Y4: 喝 rather than 吃) */
  drink?: (id: string) => boolean;
  npc: (id: string) => string | undefined;
  item: (id: string) => { zh: string; en: string } | undefined;
  spirit: (id: string) => { zh: string; en: string } | undefined;
}

/** Names from the loaded content. */
export function contentNames(all: readonly Pick<DistrictContent, 'npcs' | 'items' | 'spirits'>[]): Names {
  const npcs = new Map(all.flatMap((d) => d.npcs).map((n) => [n.id, n.name]));
  const items = new Map(all.flatMap((d) => d.items).map((i) => [i.id, { zh: i.name, en: i.en }]));
  const drinks = new Set(all.flatMap((d) => d.items).filter((i) => i.kind === 'drink').map((i) => i.id));
  const spirits = new Map(all.flatMap((d) => d.spirits).map((s) => [s.id, { zh: s.hanzi, en: s.en }]));
  return { npc: (id) => npcs.get(id), item: (id) => items.get(id), spirit: (id) => spirits.get(id), drink: (id) => drinks.has(id) };
}

/** 六块钱, 三块五, 五毛 — how much, as the diary says it */
const moneyZh = (p: number) => {
  const z = priceZh(p);
  return z.endsWith('块') ? `${z}钱` : z;
};

const stations = new Map(STATIONS.map((s) => [s.id, s]));

/** One day's codes as sentences (a festival first, when the day is given); codes naming something unknown are left out. */
export function diaryLines(codes: readonly string[], names: Names, day?: number): DiaryLine[] {
  const out: DiaryLine[] = [];
  const fest = day === undefined ? null : festivalOf(day);
  if (fest) out.push({ zh: TEMPLATES.h!.zh.replace('{x}', fest.zh), en: TEMPLATES.h!.en.replace('{x}', fest.en) });
  const fill = (key: string, x: { zh: string; en: string }, y?: { zh: string; en: string }) => {
    const t = TEMPLATES[key]!;
    out.push({
      zh: t.zh.replace('{x}', x.zh).replace('{y}', y?.zh ?? ''),
      en: t.en.replace('{x}', x.en).replace('{y}', y?.en ?? ''),
    });
  };
  const person = (id: string) => {
    const zh = names.npc(id);
    return zh ? { zh, en: zh } : undefined;
  };
  for (const c of codes) {
    const [k = '', a = '', b = ''] = c.split(':');
    if (k === 'd') {
      const d = districtInfo(a);
      if (d) fill(k, { zh: d.name.split(' · ').join('和'), en: d.en });
    } else if (k === 'm' || k === 'f') {
      const p = person(a);
      if (p) fill(k, p);
    } else if (k === 'n') {
      const p = person(a);
      if (p && b) fill(k, p, { zh: b, en: b });
    } else if (k === 'g') {
      const p = person(a);
      const it = names.item(b);
      if (p && it) fill(k, p, it);
    } else if (k === 'x') {
      const it = names.item(a);
      if (it) fill(k, it);
    } else if (k === 't') {
      const st = stations.get(a);
      if (st) fill(k, { zh: st.zh, en: st.en });
    } else if (k === 's') {
      const sp = names.spirit(a);
      if (sp) fill(k, sp);
    } else if (k === 'i') {
      fill(k, { zh: a, en: a });
    } else if (k === 'e') {
      const it = names.item(a);
      // a drink is drunk, the rest is eaten
      if (it) fill(names.drink?.(a) ? 'w' : 'e', it);
    } else if (k === 'b') {
      const it = names.item(a);
      const p = Number(b);
      if (it && p > 0) fill(k, it, { zh: moneyZh(p), en: `${p} 元` });
    } else if (k === '$') {
      const p = Number(a);
      if (p > 0) fill(k, { zh: moneyZh(p), en: `${p} 元` });
    } else if (k === 'r') {
      const it = names.item(a);
      if (it) fill(k, it);
    } else if (k === 'c') {
      if (a) fill(k, { zh: a, en: a });
    } else if (k === 'k' || k === 'p') {
      out.push({ ...TEMPLATES[k]! });
    } else if (k === 'z') {
      out.push({ ...TEMPLATES.z! });
    }
  }
  return out.length ? out : [EMPTY_DAY];
}

/** The days written so far, newest first. */
export function diaryDays(s: WorldSave): { day: number; codes: string[] }[] {
  return Object.entries(s.diary)
    .map(([d, codes]) => ({ day: Number(d), codes }))
    .filter((d) => d.codes.length)
    .sort((p, q) => q.day - p.day);
}
