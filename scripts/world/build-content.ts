/**
 * Compiles the district folders under `content/world/` (checked by
 * check-content.ts) into one file per district in `public/world/content/`,
 * plus `index.json` listing them — what the game loads (prompt §6.2).
 * Manual readings (`pinyin` on a node) travel with their lines; every
 * other reading is made in the page from the app's dictionary.
 *
 *   npx tsx scripts/world/build-content.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DistrictContent } from '../../src/world/core/types';
import { formatProblem } from '../../src/world/core/budget';
import { cutsceneLines } from '../../src/world/core/cutscene';
import { checkContent, readLibrary } from './check-content';

export const CONTENT_OUT = 'public/world/content';

/** A district as the game loads it: the content, and the manual readings by line. */
export function compileDistrict(d: DistrictContent): DistrictContent & { pinyin: Record<string, string> } {
  const pinyin: Record<string, string> = {};
  for (const s of d.scenes) for (const n of s.nodes) if (n.pinyin) pinyin[n.say] = n.pinyin;
  for (const cs of d.cutscenes ?? []) for (const l of cutsceneLines(cs)) if (l.zh && l.pinyin) pinyin[l.zh] = l.pinyin;
  return { ...d, pinyin };
}

export function buildContent(root = 'content/world', out = CONTENT_OUT): string[] {
  const r = checkContent(root, readLibrary());
  const bad = [...r.errors, ...r.budget.filter((p) => p.severity === 'error').map(formatProblem)];
  if (bad.length) throw new Error(`content has errors — run npm run world:check\n${bad.join('\n')}`);
  mkdirSync(out, { recursive: true });
  const ids: string[] = [];
  for (const d of r.districts) {
    writeFileSync(join(out, `${d.district.id}.json`), JSON.stringify(compileDistrict(d)) + '\n');
    ids.push(d.district.id);
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(ids) + '\n');
  // the clothes and their racks (§12), one file beside the districts
  writeFileSync(join(out, 'clothes.json'), JSON.stringify(r.clothes) + '\n');
  return ids;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log(buildContent().join('\n'));
}
