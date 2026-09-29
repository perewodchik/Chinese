/**
 * Giving and using things (prompt X1). A scene written for an item on a
 * person or an object wins (`use` in scenes.ts); otherwise a present goes by
 * the person's likes and dislikes — one a day, liked presents warm
 * friendship — and anything else gets a gentle, funny "no thank you". Never
 * a dead end: the item stays in the bag unless it was accepted.
 */

import { dayOf } from './clock';
import type { SaveAction } from './save';
import type { Item, NpcCard, WorldSave } from './types';

export type GiftKind = 'like' | 'neutral' | 'dislike' | 'today' | 'not-a-gift';

export interface GiftResult {
  kind: GiftKind;
  zh: string;
  en: string;
  actions: SaveAction[];
}

/** The lines are HSK 1 (checked by a test against the lists). */
export const GIFT_LINES: Record<GiftKind, { zh: string; en: string }> = {
  like: { zh: '谢谢！我很喜欢！', en: 'Thank you! I love it!' },
  neutral: { zh: '谢谢你！', en: 'Thank you!' },
  dislike: { zh: '谢谢……我不喜欢这个。', en: 'Thanks… I don’t really like this one.' },
  today: { zh: '今天你给我了。明天再来吧！', en: 'You already gave me something today. Come back tomorrow!' },
  'not-a-gift': { zh: '这个给我？我不要，谢谢。', en: 'This, for me? No thank you!' },
};

/** Using something on a thing that has no scene for it. */
export const NOTHING_HAPPENS = { zh: '不是这个。', en: 'Not this one — nothing happens.' };

/** What a person keeps in mind after a present (their notes are English, for a live talk later). */
export const likedNote = (item: Pick<Item, 'en'>) => `liked the ${item.en} you gave`;
export const dislikedNote = (item: Pick<Item, 'en'>) => `did not like the ${item.en} you gave`;

export function giveTo(card: NpcCard, item: Item, save: WorldSave): GiftResult {
  const line = (kind: GiftKind, actions: SaveAction[] = []): GiftResult => ({ kind, ...GIFT_LINES[kind], actions });
  if (!item.gift) return line('not-a-gift');
  const mem = save.npcs[card.id];
  if (mem && mem.gift === dayOf(save.clock)) return line('today');
  const kind: GiftKind = card.likes?.includes(item.id) ? 'like' : card.dislikes?.includes(item.id) ? 'dislike' : 'neutral';
  const actions: SaveAction[] = [{ do: 'meet', npc: card.id }, { do: 'take', item: item.id }, { do: 'gifted', npc: card.id, item: item.id }];
  if (kind === 'like') actions.push({ do: 'hearts', npc: card.id, delta: 1 }, { do: 'remember', npc: card.id, note: likedNote(item) });
  // remembered either way, so the bag's card can say who liked what (Y5)
  if (kind === 'dislike') actions.push({ do: 'remember', npc: card.id, note: dislikedNote(item) });
  return line(kind, actions);
}
