/**
 * `content/world/clothes.json` (prompt §12, W2): the clothes you can own and
 * the racks that sell them, checked with zod and against the rest of the
 * content by `world:check`.
 *
 *   { "racks": [{ id, npc, map, name, en, pay?, bargain?, about, hair? }],
 *     "clothes": [{ id, zh, en, slot, measure, colours: [{ id, zh, en, palette }],
 *                   price, shop, when?, story? }] }
 *
 * A garment's `id` is also its drawing (`src/world/art/hero.ts`); a colour's
 * `palette` gives the palette letters for the drawing's colour keys 1, 2, 3 …
 * in order. `shop` is a rack's id, or `start` for what you arrived in.
 */

import { z } from 'zod';
import { conditionSchema } from './content';
import { SLOTS, type Slot } from './looks';
import { PALETTE } from '../art/palette';
import type { ClothesContent, Clothing, Rack } from './wardrobe';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'ids are lower-case latin, digits, - and _');
const text = z.string().min(1);
const price = z.number().positive().refine((p) => Number.isInteger(p * 2), 'a price is whole yuan or x.5');

/** which measure word goes with which slot, as a seller counts them: 一件毛衣, 一条裤子, 一双鞋, 一顶帽子, 一副眼镜, 一个包 */
export const MEASURES_BY_SLOT: Record<Slot, readonly string[]> = {
  top: ['件'],
  bottom: ['条', '件'],
  shoes: ['双'],
  hat: ['顶', '个'],
  accessory: ['条', '副', '个'],
};

export const rackSchema: z.ZodType<Rack> = z.strictObject({
  id,
  npc: id,
  map: id,
  name: text,
  en: text,
  pay: z.enum(['scan', 'code']).optional(),
  bargain: z.boolean().optional(),
  about: text,
  hair: z.strictObject({ cut: price, dye: price }).optional(),
  when: conditionSchema.optional(),
});

export const clothingSchema: z.ZodType<Clothing> = z.strictObject({
  id,
  zh: text,
  en: text,
  slot: z.enum(SLOTS as unknown as [Slot, ...Slot[]]),
  measure: z.enum(['件', '条', '双', '顶', '副', '个']),
  colours: z
    .array(z.strictObject({ id, zh: z.string().regex(/的$/, 'a colour as a seller says it: 红的, 蓝的'), en: text, palette: z.string().min(1).max(4), when: conditionSchema.optional() }))
    .min(1),
  price,
  shop: id,
  when: conditionSchema.optional(),
  story: text.optional(),
});

export const clothesSchema: z.ZodType<ClothesContent> = z.strictObject({
  racks: z.array(rackSchema),
  clothes: z.array(clothingSchema),
});

export type ClothesChecked = { ok: true; value: ClothesContent } | { ok: false; errors: string[] };

/** The file against its schema. */
export function parseClothes(raw: unknown): ClothesChecked {
  const r = clothesSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `clothes.json: ${i.path.join('.')}: ${i.message}`) };
}

/**
 * References: every garment drawn (with enough palette letters for its
 * keys, each a real letter), in the slot its drawing is for, with a measure
 * word that fits, sold by a rack that exists (or worn from the start); every
 * rack's seller a known person on a known map. `art` is the drawings' table
 * (`GARMENT_ART`), passed in so the core does not import the art.
 */
export function checkClothes(
  c: ClothesContent,
  known: { npcs: Iterable<string>; maps?: Iterable<string> },
  art: Record<string, { slot: Slot; keys: number }>,
): string[] {
  const errors: string[] = [];
  const npcs = new Set(known.npcs);
  const maps = known.maps ? new Set(known.maps) : null;
  const racks = new Set(c.racks.map((r) => r.id));
  const seen = new Set<string>();
  c.racks.forEach((r, i) => {
    if (!npcs.has(r.npc)) errors.push(`clothes.json: racks[${i}].npc: unknown NPC "${r.npc}"`);
    if (maps && !maps.has(r.map)) errors.push(`clothes.json: racks[${i}].map: unknown map "${r.map}"`);
    if (seen.has(r.id)) errors.push(`clothes.json: racks[${i}].id: "${r.id}" twice`);
    seen.add(r.id);
  });
  // a rack (not the barber's) sells something, at least in some season
  for (const k of c.racks) if (!k.hair && !c.clothes.some((x) => x.shop === k.id)) errors.push(`clothes.json: rack ${k.id} sells nothing`);
  const ids = new Set<string>();
  c.clothes.forEach((x, i) => {
    const at = `clothes.json: clothes[${i}] (${x.id})`;
    if (ids.has(x.id)) errors.push(`${at}: the id is used twice`);
    ids.add(x.id);
    const a = art[x.id];
    if (!a) errors.push(`${at}: no drawing for it in src/world/art/hero.ts`);
    else if (a.slot !== x.slot) errors.push(`${at}: drawn as a ${a.slot}, listed as a ${x.slot}`);
    if (!MEASURES_BY_SLOT[x.slot].includes(x.measure)) errors.push(`${at}: measure ${x.measure} does not go with a ${x.slot} (${MEASURES_BY_SLOT[x.slot].join(' ')})`);
    if (x.shop !== 'start' && !racks.has(x.shop)) errors.push(`${at}: shop "${x.shop}" is not a rack`);
    const cols = new Set<string>();
    for (const k of x.colours) {
      if (cols.has(k.id)) errors.push(`${at}: colour "${k.id}" twice`);
      cols.add(k.id);
      for (const ch of k.palette) if (!PALETTE.has(ch) || ch === '.' || ch === '_') errors.push(`${at}: colour ${k.id}: "${ch}" is not a palette letter`);
      if (a && k.palette.length < a.keys) errors.push(`${at}: colour ${k.id} gives ${k.palette.length} letters, the drawing uses ${a.keys}`);
    }
  });
  return errors;
}

/** `qipao:red` → the garment and its colour, or null. */
export function clothingOf(c: Pick<ClothesContent, 'clothes'>, itemColour: string) {
  const [item, colour] = itemColour.split(':');
  const x = c.clothes.find((k) => k.id === item);
  const k = x?.colours.find((q) => q.id === colour);
  return x && k ? { item: x, colour: k } : null;
}

/** 一件红毛衣 / 一条裤子 — how the diary and the seller count one; the colour left out when it is the only one. */
export function oneZh(c: Pick<ClothesContent, 'clothes'>, itemColour: string, withColour = true): string {
  const r = clothingOf(c, itemColour);
  if (!r) return '';
  const col = withColour && r.item.colours.length > 1 ? r.colour.zh.replace(/的$/, '') : '';
  return `一${r.item.measure}${col}${r.item.zh}`;
}

/** a red sweater */
export function oneEn(c: Pick<ClothesContent, 'clothes'>, itemColour: string): string {
  const r = clothingOf(c, itemColour);
  if (!r) return '';
  const name = `${r.item.colours.length > 1 ? `${r.colour.en} ` : ''}${r.item.en}`;
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

/** The palette letters of an `item:colour` (for the composer), or undefined. */
export const paletteOf = (c: Pick<ClothesContent, 'clothes'>, itemColour: string) => clothingOf(c, itemColour)?.colour.palette;
