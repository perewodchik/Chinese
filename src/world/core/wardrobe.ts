/**
 * You, dressed your way (prompt §12): who you look like and what you wear.
 *
 * The save keeps a `look` (build, skin, face, hair — chosen in the character
 * creator and at the mirror, W3/W4), a `wardrobe` of owned clothes as
 * `item:colour` ids, the `outfit` worn now (slot → `item:colour`), three
 * saved sets, and the things ever worn (for the neighbours' "new clothes?",
 * W6). Clothes are not in the bag.
 *
 * Everything here is pure: the save's reducer calls these, the creator and
 * the wardrobe sheet only send actions. What a garment *looks* like is the
 * art's business (`src/world/art/hero.ts`); what it is called and costs is
 * content (`content/world/clothes.json`, `clothes.ts`).
 */

import type { Condition, WorldSave } from './types';
import {
  ALWAYS_WORN, cleanOutfit, DEFAULT_LOOK, DEFAULT_OUTFIT, DEFAULT_WARDROBE, HAIR_COLOURS, HAIR_STYLES, isLook, itemOf, SAVED_OUTFITS, SLOTS,
  type HairColour, type HairStyle, type HeroLook, type Outfit, type Slot,
} from './looks';

export * from './looks';

// ---------------------------------------------------------------------------
// Content: clothes and the shops that sell them (content/world/clothes.json)
// ---------------------------------------------------------------------------

export type Measure = '件' | '条' | '双' | '顶' | '副' | '个';

export interface ClothingColour {
  id: string;
  /** 红的, 蓝的 … as a seller says it */
  zh: string;
  en: string;
  /** palette letters for the garment's colour keys 1, 2, 3 … (`rR` = red with a red shade) */
  palette: string;
}

export interface Clothing {
  id: string;
  zh: string;
  en: string;
  slot: Slot;
  measure: Measure;
  colours: ClothingColour[];
  /** yuan */
  price: number;
  /** the rack that sells it (`racks[].id`); `start` for what you arrived in */
  shop: string;
  /** only sometimes (the 羽绒服 in winter, red things at 春节) */
  when?: Condition;
  /** a line about it for the item card, English */
  story?: string;
}

/** A clothes shop's rack (W5): a seller, the rack's things (by `shop`), how you pay; the 理发店 lists hair instead. */
export interface Rack {
  id: string;
  npc: string;
  map: string;
  /** as the shop writes its name: 瑞蚨祥 */
  name: string;
  en: string;
  pay?: 'scan' | 'code';
  /** 潘家园: the price is bargained (Y6's engine) */
  bargain?: boolean;
  /** the companion's "About this" — only facts we are sure of (brands.md lists the sources) */
  about: string;
  /** the barber's: haircuts and colours instead of clothes */
  hair?: { cut: number; dye: number };
}

export interface ClothesContent {
  racks: Rack[];
  clothes: Clothing[];
}

export const EMPTY_CLOTHES: ClothesContent = { racks: [], clothes: [] };

// ---------------------------------------------------------------------------
// The save's side
// ---------------------------------------------------------------------------

export type WardrobeAction =
  /** the creator's Done (W3), and the mirror's: body, face and hair — clothes stay */
  | { do: 'create'; look: HeroLook }
  /** put on something from the wardrobe; `zh`/`en` name it for the diary the first time */
  | { do: 'wear'; slot: Slot; id: string; zh?: string; en?: string }
  /** a hat or an accessory off (a top and a bottom stay on) */
  | { do: 'take_off'; slot: Slot }
  /** the outfit now into set 0–2, or set 0–2 put on */
  | { do: 'save_outfit'; index: number }
  | { do: 'put_on'; index: number }
  /** bought at a rack (W5): into the wardrobe, and on at once with `wear` (穿着走); names for the diary */
  | { do: 'buy_clothes'; id: string; slot: Slot; price: number; wear?: boolean; zh: string; en: string }
  /** sold to the recycler (the money comes with its own `earn`) */
  | { do: 'sell_clothes'; id: string }
  /** the barber's (W5): a cut or a colour */
  | { do: 'hair'; style?: HairStyle; colour?: HairColour };

type Save = WorldSave;

const addOnce = (list: string[], v: string): string[] => (list.includes(v) ? list : [...list, v]);

/** What the reducer does with a wardrobe action (unchanged save when it does not apply). */
export function applyWardrobe(s: Save, a: WardrobeAction): Save {
  switch (a.do) {
    case 'create':
      return isLook(a.look) ? { ...s, look: a.look, created: true } : s;
    case 'wear': {
      if (!s.wardrobe.includes(a.id) || s.outfit[a.slot] === a.id) return s;
      return { ...s, outfit: { ...s.outfit, [a.slot]: a.id }, worn: addOnce(s.worn, itemOf(a.id)) };
    }
    case 'take_off': {
      if (ALWAYS_WORN.includes(a.slot) || !s.outfit[a.slot]) return s;
      const outfit = { ...s.outfit };
      delete outfit[a.slot];
      return { ...s, outfit };
    }
    case 'save_outfit':
      if (a.index < 0 || a.index >= SAVED_OUTFITS) return s;
      return { ...s, outfits: s.outfits.map((o, i) => (i === a.index ? { ...s.outfit } : o)) };
    case 'put_on': {
      const set = s.outfits[a.index];
      if (!set) return s;
      // only what is still in the wardrobe; a slot that must be worn keeps what is on
      const outfit: Outfit = {};
      for (const slot of SLOTS) {
        const v = set[slot];
        if (v && s.wardrobe.includes(v)) outfit[slot] = v;
        else if (ALWAYS_WORN.includes(slot) && s.outfit[slot]) outfit[slot] = s.outfit[slot];
      }
      let worn = s.worn;
      for (const v of Object.values(outfit)) worn = addOnce(worn, itemOf(v));
      return { ...s, outfit, worn };
    }
    case 'buy_clothes': {
      const wardrobe = addOnce(s.wardrobe, a.id);
      if (!a.wear) return wardrobe === s.wardrobe ? s : { ...s, wardrobe };
      return { ...s, wardrobe, outfit: { ...s.outfit, [a.slot]: a.id }, worn: addOnce(s.worn, itemOf(a.id)) };
    }
    case 'sell_clothes': {
      // what you are wearing stays yours
      if (!s.wardrobe.includes(a.id) || Object.values(s.outfit).includes(a.id)) return s;
      return {
        ...s,
        wardrobe: s.wardrobe.filter((x) => x !== a.id),
        outfits: s.outfits.map((o) => (o && Object.values(o).includes(a.id) ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== a.id)) : o)),
      };
    }
    case 'hair': {
      const hair = { style: a.style ?? s.look.hair.style, colour: a.colour ?? s.look.hair.colour };
      if (!(HAIR_STYLES as readonly string[]).includes(hair.style) || !(HAIR_COLOURS as readonly string[]).includes(hair.colour)) return s;
      if (hair.style === s.look.hair.style && hair.colour === s.look.hair.colour) return s;
      return { ...s, look: { ...s.look, hair } };
    }
    default:
      return s;
  }
}

/** The diary's codes for a wardrobe action: `u` bought (「我买了一件红毛衣。」), `o` worn for the first time (「今天我穿了旗袍。」). */
export function wardrobeEvents(before: Save, after: Save, a: WardrobeAction): string[] {
  const clean = (t: string) => t.replace(/:/g, ' ');
  if (a.do === 'buy_clothes' && after.wardrobe.length > before.wardrobe.length) return [`u:${clean(a.zh)}:${clean(a.en)}`];
  if (a.do === 'wear' && a.zh && !before.worn.includes(itemOf(a.id)) && after.worn.includes(itemOf(a.id))) {
    return [`o:${clean(a.zh)}:${clean(a.en ?? a.zh)}`];
  }
  return [];
}

/** Merge (W2): what you own only grows; look, outfit and sets come from the later save — but a look once made is not lost to a device that never saw the creator. */
export function mergeWardrobe(a: Save, b: Save, late: Save): Pick<Save, 'look' | 'wardrobe' | 'outfit' | 'outfits' | 'created' | 'worn'> {
  const early = late === a ? b : a;
  const lookFrom = late.created || !early.created ? late : early;
  return {
    look: lookFrom.look,
    created: a.created || b.created,
    wardrobe: [...new Set([...a.wardrobe, ...b.wardrobe])].sort(),
    outfit: late.outfit,
    outfits: late.outfits,
    worn: [...new Set([...a.worn, ...b.worn])].sort(),
  };
}

/** A save's wardrobe fields read from anything (migrate.ts's `fill`). */
export function fillWardrobe(r: Record<string, unknown>): Pick<Save, 'look' | 'wardrobe' | 'outfit' | 'outfits' | 'created' | 'worn'> {
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const wardrobe = strings(r.wardrobe);
  const outfit = cleanOutfit(r.outfit);
  const sets = Array.isArray(r.outfits) ? r.outfits : [];
  return {
    look: isLook(r.look) ? r.look : DEFAULT_LOOK,
    created: r.created === true,
    wardrobe: wardrobe.length ? wardrobe : [...DEFAULT_WARDROBE],
    outfit: Object.keys(outfit).length ? outfit : { ...DEFAULT_OUTFIT },
    outfits: Array.from({ length: SAVED_OUTFITS }, (_, i) => (sets[i] && typeof sets[i] === 'object' ? cleanOutfit(sets[i]) : null)),
    worn: strings(r.worn).length ? strings(r.worn) : Object.values(DEFAULT_OUTFIT).map(itemOf),
  };
}

/** A new game's wardrobe: what the hero arrived in. */
export const newWardrobe = (): Pick<Save, 'look' | 'wardrobe' | 'outfit' | 'outfits' | 'created' | 'worn'> => ({
  look: DEFAULT_LOOK,
  created: false,
  wardrobe: [...DEFAULT_WARDROBE],
  outfit: { ...DEFAULT_OUTFIT },
  outfits: [null, null, null],
  worn: Object.values(DEFAULT_OUTFIT).map(itemOf),
});

/** How a line that needs a word for you says it: your name (or 你), 小伙子 or 姑娘. */
export function addressOf(s: Pick<Save, 'look' | 'name'>): string {
  if (s.look.address === 'name') return s.name || '你';
  return s.look.address;
}
