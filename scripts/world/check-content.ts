/**
 * Checks the game's source content: every district folder under
 * `content/world/` against the schemas and references (core/content.ts),
 * then every line against the word budget (core/budget.ts).
 *
 *   npx tsx scripts/world/check-content.ts [content root]
 *
 * Prints one line per problem — file, scene/node, word and level — and
 * exits 1 on any error. `npm test` runs the same check through
 * check-content.test.ts, so bad content fails the tests.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CharacterEntry, Library, SyllabusWord } from '../../src/data/types';
import { checkBudget, formatProblem, libraryLeveler, type BudgetProblem } from '../../src/world/core/budget';
import { checkReferences, DISTRICT_FILES, parseDistrict, type DistrictFiles } from '../../src/world/core/content';
import type { DistrictContent } from '../../src/world/core/types';

export interface CheckResult {
  districts: DistrictContent[];
  /** schema and reference errors, already formatted */
  errors: string[];
  budget: BudgetProblem[];
}

export function readLibrary(root = '.'): Library {
  const read = <T>(p: string): T => JSON.parse(readFileSync(join(root, p), 'utf8')) as T;
  const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
  const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
  return {
    characters: chars,
    themes: [],
    components: {},
    strokes: {},
    byChar: new Map(chars.map((c) => [c.c, c])),
    words,
    byWord: new Map(words.map((w) => [w.w, w])),
  };
}

/** A district folder is one with a `district.json`. */
export function districtDirs(contentRoot: string): string[] {
  if (!existsSync(contentRoot)) return [];
  return readdirSync(contentRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(contentRoot, d.name, 'district.json')))
    .map((d) => d.name)
    .sort();
}

export function checkContent(contentRoot: string, lib: Library): CheckResult {
  const errors: string[] = [];
  const districts: DistrictContent[] = [];
  for (const dir of districtDirs(contentRoot)) {
    const files: Record<string, unknown> = {};
    for (const name of Object.keys(DISTRICT_FILES) as (keyof typeof DISTRICT_FILES)[]) {
      const p = join(contentRoot, dir, `${name}.json`);
      if (!existsSync(p)) continue;
      try {
        files[name] = JSON.parse(readFileSync(p, 'utf8'));
      } catch (e) {
        errors.push(`${dir}/${name}.json: not valid JSON — ${(e as Error).message}`);
      }
    }
    const r = parseDistrict(files as DistrictFiles);
    if (r.ok) districts.push(r.value);
    else errors.push(...r.errors.map((e) => `${dir}/${e.replace(/^(\w+)/, '$1.json')}`));
  }
  // References across districts: an NPC or stamp from another folder is fine.
  const known = {
    npcs: districts.flatMap((d) => d.npcs.map((x) => x.id)),
    stamps: districts.flatMap((d) => d.stamps.map((x) => x.id)),
    quests: districts.flatMap((d) => d.quests.map((x) => x.id)),
    spirits: districts.flatMap((d) => d.spirits.map((x) => x.id)),
    idioms: districts.flatMap((d) => d.idioms.map((x) => x.id)),
    items: districts.flatMap((d) => d.items.map((x) => x.id)),
  };
  for (const d of districts) {
    errors.push(...checkReferences(d, known).map((e) => `${d.district.id}/${e.replace(/^(\w+)/, '$1.json')}`));
  }
  // Ids are one namespace across the whole city: a scene, a person or a quest is found by id alone.
  for (const kind of ['scenes', 'npcs', 'quests', 'spirits', 'idioms', 'stamps', 'items'] as const) {
    const seen = new Map<string, string>();
    for (const d of districts) {
      for (const x of d[kind] as ReadonlyArray<{ id: string }>) {
        const other = seen.get(x.id);
        if (other && other !== d.district.id) errors.push(`${d.district.id}/${kind}.json: id "${x.id}" is also used in ${other}/${kind}.json`);
        seen.set(x.id, d.district.id);
      }
    }
  }
  const budget = checkBudget({ leveler: libraryLeveler(lib), all: districts });
  return { districts, errors: [...new Set(errors)], budget };
}

function main() {
  const root = process.argv[2] ?? 'content/world';
  const r = checkContent(root, readLibrary());
  for (const e of r.errors) console.log(`error ${e}`);
  for (const p of r.budget) console.log(formatProblem(p));
  const bad = r.errors.length + r.budget.filter((p) => p.severity === 'error').length;
  const scenes = r.districts.reduce((n, d) => n + d.scenes.length, 0);
  console.log(`${r.districts.length} district(s), ${scenes} scene(s): ${bad ? `${bad} error(s)` : 'ok'}`);
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
