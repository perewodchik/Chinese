/**
 * People notice (prompt §12, W6). The first time you wear something new,
 * the first friend you talk to says so, once — 王阿姨 「新衣服？真好看！」,
 * 老刘 「穿得很精神！」 — and remembers it (X2's notes). In red at 春节 each
 * neighbour smiles 「穿红的，过年好！」 and warms a heart, once a festival.
 * 兔儿爷 has his English remarks: a T-shirt in the snow, a 旗袍 under an
 * umbrella, a hat indoors.
 *
 * No stats, no penalties, nothing needed: a line before their usual one.
 * Pure; the talk engine asks `noticeAt` as a talk starts, the page asks
 * `remarkAt` on arriving somewhere.
 */

import { festivalOf, START_WEEK, weatherOf, WEEKS } from './calendar';
import { dayOf } from './clock';
import { DEFAULT_OUTFIT, itemOf, type Slot } from './looks';
import type { SaveAction } from './save';
import type { WorldSave } from './types';
import type { ClothesContent } from './wardrobe';

/** What you arrived in is not new. */
const FIRST = new Set(Object.values(DEFAULT_OUTFIT).map(itemOf));

/** A friend's own way of saying it (the rest say the slot's line). */
const OWN: Record<string, { zh: string; en: string }> = {
  'wang-ayi': { zh: '新衣服？真好看！', en: 'New clothes? They look lovely!' },
  'lao-liu': { zh: '穿得很精神！', en: 'You look sharp!' },
  'zhao-yeye': { zh: '哎，新衣服！好看，好看。', en: 'Oh, new clothes! Very nice, very nice.' },
  'li-ayi': { zh: '这个在哪儿买的？真好看！', en: 'Where did you buy that? It’s lovely!' },
};

/** Said about a particular thing, by anyone. */
const THING: Record<string, { zh: string; en: string }> = {
  qipao: { zh: '旗袍！真漂亮！', en: 'A qipao! Beautiful!' },
  suit: { zh: '穿西装？今天去上班吗？', en: 'A suit? Going to work today?' },
  zhongshan: { zh: '中山装！我年轻的时候也穿这个。', en: 'A Mao jacket! I wore one of those when I was young.' },
  panda: { zh: '熊猫帽！太可爱了！', en: 'A panda hat! So cute!' },
};

const BY_SLOT: Record<Slot, { zh: string; en: string }> = {
  top: { zh: '新衣服？很好看！', en: 'New clothes? Looks good!' },
  bottom: { zh: '新衣服？很好看！', en: 'New clothes? Looks good!' },
  shoes: { zh: '新鞋？很好看！', en: 'New shoes? Very nice!' },
  hat: { zh: '新帽子？很好看！', en: 'A new hat? Very nice!' },
  accessory: { zh: '这个很好看！', en: 'That looks nice!' },
};

export const RED_NEW_YEAR = { zh: '穿红的，过年好！', en: 'Wearing red — Happy New Year!' };

/** The year a game day falls in (for "once a festival"). */
const yearOf = (day: number) => Math.floor((START_WEEK + day - 1) / WEEKS);

export interface Notice {
  zh: string;
  en: string;
  actions: SaveAction[];
}

/**
 * What a person says about your clothes as a talk starts, and what it
 * changes (flags: `noticed:<item>` so each new thing is remarked on once,
 * `red-<year>-<npc>` for 春节), or null. Only friends notice (a heart or
 * more); strangers and sellers keep to business.
 */
export function noticeAt(s: WorldSave, npc: string, clothes: Pick<ClothesContent, 'clothes'>): Notice | null {
  const mem = s.npcs[npc];
  if (!mem || mem.hearts < 1) return null;
  const day = dayOf(s.clock);
  // red at New Year: every neighbour, once a festival
  if (festivalOf(day)?.id === 'chunjie' && Object.values(s.outfit).some((id) => id?.split(':')[1] === 'red')) {
    const flag = `red-${yearOf(day)}-${npc}`;
    if (!s.flags.includes(flag)) return { ...RED_NEW_YEAR, actions: [{ do: 'flag', flag }, { do: 'hearts', npc, delta: 1 }] };
  }
  // something new, not yet noticed by anyone
  for (const slot of ['top', 'hat', 'bottom', 'shoes', 'accessory'] as const) {
    const id = s.outfit[slot];
    if (!id) continue;
    const item = itemOf(id);
    if (FIRST.has(item) || s.flags.includes(`noticed:${item}`)) continue;
    const c = clothes.clothes.find((x) => x.id === item);
    if (!c) continue;
    const l = THING[item] ?? OWN[npc] ?? BY_SLOT[slot];
    return { ...l, actions: [{ do: 'flag', flag: `noticed:${item}` }, { do: 'remember', npc, note: `saw your new ${c.en}` }] };
  }
  return null;
}

export type RemarkKind = 'snow-tee' | 'rain-qipao' | 'hat-inside';

/** 兔儿爷's English remarks about what you wear, where you are (at most one a day of each kind — the page keeps count). */
export function remarkAt(s: WorldSave, place: 'street' | 'sight' | 'inside' | 'station', hasUmbrella: boolean): { kind: RemarkKind; text: string } | null {
  const w = weatherOf(dayOf(s.clock));
  const top = s.outfit.top ? itemOf(s.outfit.top) : '';
  const bottom = s.outfit.bottom ? itemOf(s.outfit.bottom) : '';
  const outside = place === 'street' || place === 'sight';
  if (outside && w === 'snow' && (top === 'tshirt' || top === 'hutong-tee' || bottom === 'shorts')) {
    return { kind: 'snow-tee', text: 'A T-shirt in the snow? Brr. The 羽绒服 at 百货大楼 would be warmer — or put your coat on at home.' };
  }
  if (outside && w === 'rain' && top === 'qipao' && hasUmbrella) {
    return { kind: 'rain-qipao', text: 'A 旗袍 under an umbrella in the rain — like an old film poster. Tap the umbrella in your bag to open it.' };
  }
  if (place === 'inside' && s.outfit.hat) {
    return { kind: 'hat-inside', text: 'Your hat’s still on indoors. Nobody minds here — it’s only me being old-fashioned.' };
  }
  return null;
}
