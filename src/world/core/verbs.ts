/**
 * What you can do with a thing (prompt Y4), as the Chinese verbs on its bag
 * row: 吃 a bun, 喝 soy milk, 给 a present, 用 a torch, 放 a decoration, 打 an
 * umbrella, 玩 a toy, 看 a story thing. An item may list its own `verbs`;
 * otherwise its kind decides.
 */

import type { Item, ItemVerb } from './types';

export const VERB_ZH: Record<ItemVerb, { zh: string; en: string }> = {
  eat: { zh: '吃', en: 'eat' },
  drink: { zh: '喝', en: 'drink' },
  give: { zh: '给', en: 'give' },
  use: { zh: '用', en: 'use' },
  put: { zh: '放', en: 'put up' },
  look: { zh: '看', en: 'look at' },
  open: { zh: '打', en: 'open (an umbrella)' },
  play: { zh: '玩', en: 'play with' },
};

export function verbsOf(it: Item): ItemVerb[] {
  if (it.verbs?.length) return it.verbs;
  switch (it.kind) {
    case 'food':
      return ['eat', 'give'];
    case 'drink':
      return ['drink', 'give'];
    case 'gift':
      return ['give'];
    case 'decor':
      return ['put', 'give'];
    case 'toy':
      return ['play', 'give'];
    case 'key':
      return ['use', 'look'];
    default:
      return it.gift ? ['use', 'give'] : ['use'];
  }
}

/** The verbs that hand the item on to someone or something (X1's tap-a-target). */
export const TARGET_VERBS: ReadonlySet<ItemVerb> = new Set(['give', 'use', 'put', 'open', 'play']);

/** Does a thing in the bag make something with another thing in the bag? */
export function combos(it: Item, bag: Record<string, number>): { with: string; makes: string }[] {
  return (it.combine ?? []).filter((c) => (bag[c.with] ?? 0) > 0);
}
