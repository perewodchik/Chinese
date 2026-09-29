/**
 * Photos, postcards and stickers (prompt X6) — the parts that are rules.
 *
 * A photo is taken of what is in the middle of the view: the people, things
 * and signs whose tiles lie inside the frame become its *subjects*
 * (`<map>:<object id>`, or `npc:<id>` for a person). The save keeps only
 * which subjects were ever photographed — enough for a quest that asks for
 * 「一张鼓楼的照片」 — while the pictures themselves stay on the device
 * (they are far too big for the world save).
 *
 * Stickers stand for a short word each, so a sticker sent in a talk is
 * understood like that word; when it fits nothing, the person simply smiles
 * at it — a sticker is never a "what did you say?".
 */

import type { MapObject } from './types';

/** A rectangle in tiles: the part of the map inside the viewfinder. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What a photo shows: people and things whose footprint touches the frame. */
export function subjectsIn(objects: readonly MapObject[], map: string, r: TileRect): string[] {
  const inside = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const out = new Set<string>();
  for (const o of objects) {
    if (o.kind === 'npc') {
      // a person is two tiles tall
      if (inside(o.tile[0], o.tile[1]) || inside(o.tile[0], o.tile[1] - 1)) out.add(`npc:${o.npc}`);
    } else if (o.kind === 'prop') {
      const [w, h] = o.blocks ?? [1, 1];
      let hit = false;
      for (let i = 0; i < Math.max(1, w) && !hit; i++) for (let j = 0; j < Math.max(1, h, 2) && !hit; j++) hit = inside(o.tile[0] + i, o.tile[1] - j);
      if (hit) out.add(`${map}:${o.id}`);
    } else if (o.kind === 'sign' || o.kind === 'spirit' || o.kind === 'door') {
      if (inside(o.tile[0], o.tile[1])) out.add(`${map}:${o.id}`);
    }
  }
  return [...out].sort();
}

/** The subjects kept in a save: every one ever photographed, at most this many. */
export const MAX_SUBJECTS = 300;

export interface StickerDef {
  id: string;
  /** what it says, as a word the talk understands */
  says: string;
  en: string;
}

export const STICKERS: readonly StickerDef[] = [
  { id: 'hello', says: '你好', en: 'hello' },
  { id: 'thanks', says: '谢谢', en: 'thank you' },
  { id: 'ok', says: '好', en: 'OK!' },
  { id: 'haha', says: '哈哈', en: 'ha ha' },
  { id: 'sorry', says: '对不起', en: 'sorry' },
  { id: 'love', says: '我喜欢', en: 'love it' },
];

/** What a person says to a sticker that means nothing to the talk (HSK 1). */
export const STICKER_REPLY = { zh: '你的这个很好玩儿！', en: 'That one of yours is fun!' };
