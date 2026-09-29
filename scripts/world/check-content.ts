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
import { checkJournal } from '../../src/world/core/journal';
import type { DistrictContent } from '../../src/world/core/types';
import { checkClothes, parseClothes } from '../../src/world/core/clothes';
import { EMPTY_CLOTHES, type ClothesContent } from '../../src/world/core/wardrobe';
import { GARMENT_ART } from '../../src/world/art/hero';
import { coverage, coverageProblems, mapIds, readBooks } from './coverage';
import { checkCutscene, checkCutsceneLinks } from '../../src/world/core/cutscene';
import { gridFromLayer } from '../../src/world/core/grid';
import { loadAll } from './build-maps';

export interface CheckResult {
  districts: DistrictContent[];
  /** schema and reference errors, already formatted */
  errors: string[];
  /** `clothes.json` (§12): the clothes and the racks that sell them */
  clothes: ClothesContent;
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
  // The journal (§10 J1): kinds, blurbs, a place for every main step, real maps in `where`.
  const mapsDir = join(contentRoot, 'maps');
  const maps = new Set(existsSync(mapsDir) ? readdirSync(mapsDir).filter((f) => f.endsWith('.map.txt')).map((f) => f.replace(/\.map\.txt$/, '')) : []);
  if (maps.size) {
    const all = { quests: districts.flatMap((d) => d.quests), scenes: districts.flatMap((d) => d.scenes), npcs: districts.flatMap((d) => d.npcs), shops: districts.flatMap((d) => d.shops ?? []) };
    errors.push(...checkJournal(all, maps).map((e) => `quests.json: ${e}`));
  }
  // clothes (§12, W2): the file, its drawings, measure words, racks and their sellers
  let clothes: ClothesContent = EMPTY_CLOTHES;
  const clothesPath = join(contentRoot, 'clothes.json');
  if (existsSync(clothesPath)) {
    const r = parseClothes(JSON.parse(readFileSync(clothesPath, 'utf8')));
    if (r.ok) {
      clothes = r.value;
      errors.push(...checkClothes(clothes, { npcs: known.npcs, maps: districts.flatMap((d) => d.district.maps) }, GARMENT_ART));
      // W7: every shop's name and facts are in brands.md with a source; every colour of every garment is in the built atlas
      const root = join(contentRoot, '..', '..');
      const brands = join(root, 'docs/world-game/brands.md');
      if (existsSync(brands)) {
        const text = readFileSync(brands, 'utf8');
        for (const k of clothes.racks) if (!text.includes(`\`${k.id}\``)) errors.push(`clothes.json: rack ${k.id} (${k.name}) is not in docs/world-game/brands.md`);
      }
      const atlas = join(root, 'public/world/art/outfit.json');
      if (existsSync(atlas)) {
        const frames = (JSON.parse(readFileSync(atlas, 'utf8')) as { frames: Record<string, unknown> }).frames;
        for (const x of clothes.clothes) {
          for (const k of x.colours) {
            for (const build of ['broad', 'slim']) {
              if (!frames[`outfit/${x.id}-${k.id}-${build}`]) {
                errors.push(`clothes.json: ${x.id} in ${k.id} (${build}) is not in the outfit atlas — run npm run world:art`);
              }
            }
          }
        }
      }
    } else errors.push(...r.errors);
  }
  // §13 K1: every cutscene against its map — tiles on the map, walks on walkable ground, actors on the cast or the map
  const cutscenes = districts.flatMap((d) => (d.cutscenes ?? []).map((cs) => ({ d: d.district.id, cs })));
  if (cutscenes.length) {
    const built = new Map(loadAll(join(contentRoot, 'maps')).map((c) => [c.map.id, c]));
    const npcs = new Set(known.npcs);
    const spirits = new Set(known.spirits);
    for (const { d, cs } of cutscenes) {
      const m = built.get(cs.map);
      if (!m) {
        errors.push(`${d}/cutscenes.json: cutscene ${cs.id}: no map "${cs.map}"`);
        continue;
      }
      const grid = gridFromLayer(m.map.width, m.map.height, (x, y) => m.map.collide[y * m.map.width + x] !== 0);
      errors.push(...checkCutscene(cs, { grid, objects: m.objects, npcs, spirits }).map((e) => `${d}/cutscenes.json: ${e}`));
    }
  }
  errors.push(
    ...checkCutsceneLinks(cutscenes.map((x) => x.cs), districts.flatMap((d) => d.scenes), districts.flatMap((d) => d.quests), new Set(districts.flatMap((d) => d.district.maps))).map((e) => `cutscenes: ${e}`),
  );
  // §13 Z0: every map on some chapter's main route — strict only once the chapters are deepened (S10)
  if (process.env.WORLD_COVERAGE === 'strict') errors.push(...coverageProblems(coverage(districts, readBooks(contentRoot), mapIds(contentRoot))).map((e) => `coverage: ${e}`));
  const budget = checkBudget({ leveler: libraryLeveler(lib), all: districts });
  return { districts, errors: [...new Set(errors)], budget, clothes };
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
