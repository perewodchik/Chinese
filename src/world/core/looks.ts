/**
 * What you look like (prompt §12, W1): the character creator's catalogue —
 * two builds, five skin tones, faces, hair — the clothing slots, and today's
 * hero as the default. Pure data and checks; the art draws each of these
 * (`src/world/art/hero.ts`), the save keeps a choice (`wardrobe.ts`).
 */

export type Slot = 'hat' | 'top' | 'bottom' | 'shoes' | 'accessory';
export const SLOTS: readonly Slot[] = ['hat', 'top', 'bottom', 'shoes', 'accessory'];
/** a top and a bottom are always worn (and shoes: nobody walks Beijing barefoot) */
export const ALWAYS_WORN: readonly Slot[] = ['top', 'bottom', 'shoes'];

// The creator's catalogue: not bought, chosen. The art draws each of these.
export const BUILDS = ['broad', 'slim'] as const;
export type Build = (typeof BUILDS)[number];
/** five skin tones, lightest first */
export const SKINS = 5;
export const EYES = ['dot', 'round', 'smile', 'narrow'] as const;
export const BROWS = ['none', 'thin', 'thick'] as const;
export const MOUTHS = ['line', 'smile'] as const;
export const HAIR_STYLES = ['short', 'buzz', 'side', 'long', 'ponytail', 'buns', 'bob', 'curly', 'fringe', 'bald'] as const;
export const HAIR_COLOURS = ['black', 'dark', 'brown', 'chestnut', 'red', 'blonde', 'grey', 'white'] as const;
/** how people address you when a line needs it: by your name, 小伙子 or 姑娘 */
export const ADDRESSES = ['name', '小伙子', '姑娘'] as const;

export type Eyes = (typeof EYES)[number];
export type Brows = (typeof BROWS)[number];
export type Mouth = (typeof MOUTHS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColour = (typeof HAIR_COLOURS)[number];
export type Address = (typeof ADDRESSES)[number];

export interface HeroLook {
  build: Build;
  /** 0 … SKINS − 1 */
  skin: number;
  face: { eyes: Eyes; brows: Brows; mouth: Mouth };
  hair: { style: HairStyle; colour: HairColour };
  address: Address;
}

/** slot → `item:colour` */
export type Outfit = Partial<Record<Slot, string>>;

/** The names the creator shows under its swatches and tiles (Chinese first, English under). */
export const LOOK_NAMES = {
  build: { broad: ['宽', 'broader'], slim: ['瘦', 'slimmer'] },
  eyes: { dot: ['小眼睛', 'small'], round: ['大眼睛', 'round'], smile: ['笑眼', 'smiling'], narrow: ['细眼睛', 'narrow'] },
  brows: { none: ['淡眉', 'faint'], thin: ['细眉', 'thin'], thick: ['浓眉', 'thick'] },
  mouth: { line: ['小嘴', 'small'], smile: ['笑', 'smiling'] },
  hair: {
    short: ['短发', 'short'], buzz: ['寸头', 'buzz cut'], side: ['分头', 'side part'], long: ['长发', 'long'], ponytail: ['马尾', 'ponytail'],
    buns: ['丸子头', 'two buns'], bob: ['短发齐耳', 'bob'], curly: ['卷发', 'curly'], fringe: ['刘海', 'fringe'], bald: ['光头', 'bald'],
  },
  colour: {
    black: ['黑色', 'black'], dark: ['深棕色', 'dark brown'], brown: ['棕色', 'brown'], chestnut: ['金棕色', 'golden brown'],
    red: ['红色', 'red'], blonde: ['金色', 'blonde'], grey: ['灰色', 'grey'], white: ['白色', 'white'],
  },
  address: { name: ['我的名字', 'my name'], 小伙子: ['小伙子', 'young man'], 姑娘: ['姑娘', 'young woman'] },
} as const satisfies Record<string, Record<string, readonly [string, string]>>;

/** Today's hero (before §12): short black hair, the blue jacket, red scarf, dark trousers, white shoes. */
export const DEFAULT_LOOK: HeroLook = {
  build: 'broad',
  skin: 1,
  face: { eyes: 'dot', brows: 'none', mouth: 'line' },
  hair: { style: 'short', colour: 'black' },
  address: 'name',
};
export const DEFAULT_OUTFIT: Outfit = { top: 'jacket:blue', bottom: 'trousers:dark', shoes: 'sneakers:white', accessory: 'scarf:red' };
export const DEFAULT_WARDROBE: readonly string[] = Object.values(DEFAULT_OUTFIT);
export const SAVED_OUTFITS = 3;

/** `jacket:blue` → `jacket` */
export const itemOf = (id: string) => id.split(':')[0]!;
export const colourOfId = (id: string) => id.split(':')[1] ?? '';

export const isLook = (x: unknown): x is HeroLook => {
  if (typeof x !== 'object' || x === null) return false;
  const l = x as Record<string, unknown>;
  const face = l.face as Record<string, unknown> | undefined;
  const hair = l.hair as Record<string, unknown> | undefined;
  return (
    (BUILDS as readonly unknown[]).includes(l.build) &&
    typeof l.skin === 'number' && Number.isInteger(l.skin) && l.skin >= 0 && l.skin < SKINS &&
    !!face && (EYES as readonly unknown[]).includes(face.eyes) && (BROWS as readonly unknown[]).includes(face.brows) && (MOUTHS as readonly unknown[]).includes(face.mouth) &&
    !!hair && (HAIR_STYLES as readonly unknown[]).includes(hair.style) && (HAIR_COLOURS as readonly unknown[]).includes(hair.colour) &&
    (ADDRESSES as readonly unknown[]).includes(l.address)
  );
};

/** An outfit read from anywhere: known slots, `item:colour` strings. */
export function cleanOutfit(x: unknown): Outfit {
  const out: Outfit = {};
  if (typeof x !== 'object' || x === null) return out;
  for (const slot of SLOTS) {
    const v = (x as Record<string, unknown>)[slot];
    if (typeof v === 'string' && v.includes(':')) out[slot] = v;
  }
  return out;
}

/** 🎲 Surprise me: any look (the address stays yours to choose). */
export function randomLook(rand: () => number, keep: HeroLook): HeroLook {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length) % xs.length]!;
  return {
    build: pick(BUILDS),
    skin: Math.floor(rand() * SKINS) % SKINS,
    face: { eyes: pick(EYES), brows: pick(BROWS), mouth: pick(MOUTHS) },
    hair: { style: pick(HAIR_STYLES), colour: pick(HAIR_COLOURS) },
    address: keep.address,
  };
}

/** A short stable key for a look and an outfit, for the composed texture's name. */
export function lookKey(look: HeroLook, outfit: Outfit, palettes: (id: string) => string): string {
  const parts = [look.build, look.skin, look.face.eyes, look.face.brows, look.face.mouth, look.hair.style, look.hair.colour, ...SLOTS.map((s) => (outfit[s] ? `${outfit[s]}=${palettes(outfit[s]!)}` : '-'))];
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
