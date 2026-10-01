/**
 * 南锣鼓巷's sixteen 胡同 as something to collect (MH2): each lane's street sign, read once, is
 * remembered; the sixteenth gives the 蜈蚣巷 stamp — the centipede street, eight legs a side
 * (facts.md `nlgx-centipede`). It is reading practice: sixteen real names, in hanzi.
 */

import { readFlag } from './flags';
import type { SaveAction } from './save';
import type { WorldSave } from './types';

/** the signs' object ids on `nanluo-main` (scripts/world/gen-nanluo.ts): west lanes w0–w7, east e0–e7, north to south */
export const HUTONG_SIGNS: readonly string[] = [...Array.from({ length: 8 }, (_, i) => `hutong-w${i}`), ...Array.from({ length: 8 }, (_, i) => `hutong-e${i}`)];

export const HUTONG_STAMP = 'hutong16';

/** the same flag any sign read leaves (`readFlag`), so a place card can count them too */
const flagOf = (sign: string) => readFlag(`nanluo-main:${sign}`);

/** how many of the sixteen names you have read */
export const hutongsRead = (s: WorldSave) => HUTONG_SIGNS.filter((id) => s.flags.includes(flagOf(id))).length;

/** Reading a lane's sign: remember it, and on the sixteenth, the stamp. Nothing for any other sign, or one read before. */
export function readHutongSign(s: WorldSave, sign: string): SaveAction[] {
  if (!HUTONG_SIGNS.includes(sign) || s.flags.includes(flagOf(sign))) return [];
  const out: SaveAction[] = [{ do: 'flag', flag: flagOf(sign) }];
  if (hutongsRead(s) + 1 === HUTONG_SIGNS.length && !s.stamps[HUTONG_STAMP]) out.push({ do: 'stamp', stamp: HUTONG_STAMP });
  return out;
}
