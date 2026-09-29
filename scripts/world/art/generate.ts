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
import { PROPS } from './gen/props';
import { TILES } from './gen/tiles';
import { DEFAULT_WORN, heroFrames } from '../../../src/world/art/hero';
import { DEFAULT_LOOK } from '../../../src/world/core/looks';

const ROOT = 'content/world/art/sprites';

export function sources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  out.push(['tiles/beijing.px', pxFile('Beijing tiles, 16×16', TILES.map(([n, f]) => [n, f()]))]);
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
  for (const [name, note, frames] of PROPS) out.push([`props/${name}.px`, pxFile(note, frames())]);
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
