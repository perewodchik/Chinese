/**
 * Writes the generated `.px` sources: Beijing tiles, people, 兔儿爷, props.
 *
 *   npx tsx scripts/world/art/generate.ts
 *
 * The `.px` files are the art's source of truth and can be edited by hand.
 * A file whose first line no longer says "# generated" has been edited and
 * is left alone.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOOKS, rabbit, walkFrames } from './gen/chars';
import { pxFile } from './gen/grid';
import { ITEM_SPRITES, UI_SPRITES } from './gen/items';
import { PROPS } from './gen/props';
import { TILES } from './gen/tiles';
import { KIT_TILES } from './gen/kit';
import { KIT_PROPS } from './gen/kit-props';
import { DEFAULT_WORN, heroFrames } from '../../../src/world/art/hero';
import { DEFAULT_LOOK } from '../../../src/world/core/looks';

const ROOT = 'content/world/art/sprites';

export function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  out.push(['tiles/beijing.px', pxFile('Beijing tiles, 16×16', TILES.map(([n, f]) => [n, f()]))]);
  // §13 V2: the Beijing architecture kit — roofs by rank, faces, north–south streets
  out.push(['tiles/kit.px', pxFile('the Beijing architecture kit (§13 V2), 16×16: roofs in four glazes, faces under the eaves, north–south street pieces — see scripts/world/art/gen/kit.ts', KIT_TILES.map(([n, f]) => [n, f()]))]);
  // the player: today's look from the layered drawer (W1) — the game composes the player's own look with the same code
  out.push(['chars/hero.px', pxFile('the player as they arrive: short black hair, blue jacket, red scarf (src/world/art/hero.ts)', heroFrames(DEFAULT_LOOK, DEFAULT_WORN))]);
  for (const [name, { look, variants, note }] of Object.entries(LOOKS)) {
    const extra = (variants ?? []).map(([v, swap]) => `variant: ${v} ${Object.entries(swap).map(([a, b]) => `${a}>${b}`).join(' ')}`);
    out.push([`chars/${name}.px`, pxFile(note, walkFrames(look), extra)]);
  }
  out.push([
    'chars/rabbit.px',
    pxFile('兔儿爷, the clay rabbit spirit, floating', [
      ['down-0', rabbit(1)], ['down-1', rabbit(0)],
      ['up-0', rabbit(1, 'up')], ['up-1', rabbit(0, 'up')],
      ['left-0', rabbit(1, 'left')], ['left-1', rabbit(0, 'left')],
      ['right-0', rabbit(1, 'right')], ['right-1', rabbit(0, 'right')],
    ]),
  ]);
  for (const [name, note, frames] of [...PROPS, ...KIT_PROPS]) out.push([`props/${name}.px`, pxFile(note, frames())]);
  // the menu's atlas: a picture for every thing in the bag, and the menu's own icons
  out.push(['menu/item.px', pxFile('the things in the bag, one per item id', Object.entries(ITEM_SPRITES).map(([n, f]) => [n, f()]))]);
  out.push(['menu/ui.px', pxFile("the menu's icons: tabs, pockets, wallet", Object.entries(UI_SPRITES).map(([n, f]) => [n, f()]))]);
  return out;
}

export function generate(root = ROOT): string[] {
  const written: string[] = [];
  for (const [rel, text] of sources()) {
    const p = join(root, rel);
    if (existsSync(p) && !readFileSync(p, 'utf8').startsWith('# generated')) continue;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    written.push(rel);
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(generate().join('\n'));
}
