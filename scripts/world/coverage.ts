/**
 * The place audit (§13 Z0): for each map, which main steps, side quests,
 * substory episodes and books point at it.
 *
 *   npx tsx scripts/world/coverage.ts            # the table
 *   npx tsx scripts/world/coverage.ts --missing  # only maps on no main route
 *
 * `world:check` runs `coverageProblems` only with WORLD_COVERAGE=strict
 * (it fails until the chapters are deepened, S10); the story bible
 * (docs/world-game/story.md) lists the exceptions below with the reason.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stepMaps } from '../../src/world/core/journal';
import type { DistrictContent } from '../../src/world/core/types';

/** Maps allowed on no main route, and why (kept in step with story.md §2). */
export const COVERAGE_EXCEPTIONS: Readonly<Record<string, string>> = {
  'hutong-proto': 'the C4 art prototype; no district uses it',
  'tiananmen-proto': 'the C4 art prototype; no district uses it',
};

/** Stations and bus/train stops are passed through on every route; they count when their district is on one. */
export const isStop = (map: string) => /^(station|stop)-/.test(map);

/** Substory episodes are quests whose id starts `sub-` (U1–U4 write them so). */
export const isSubstory = (questId: string) => questId.startsWith('sub-');

export interface BookRef {
  id: string;
  place?: string;
}

export interface CoverageRow {
  map: string;
  district: string | undefined;
  main: string[];
  side: string[];
  substory: string[];
  books: string[];
}

export function coverage(districts: readonly DistrictContent[], books: readonly BookRef[] = [], extraMaps: readonly string[] = []): CoverageRow[] {
  const content = {
    scenes: districts.flatMap((d) => d.scenes),
    npcs: districts.flatMap((d) => d.npcs),
    shops: districts.flatMap((d) => d.shops ?? []),
  };
  const rows = new Map<string, CoverageRow>();
  const row = (map: string, district?: string) => {
    let r = rows.get(map);
    if (!r) rows.set(map, (r = { map, district, main: [], side: [], substory: [], books: [] }));
    if (district && !r.district) r.district = district;
    return r;
  };
  for (const d of districts) for (const m of d.district.maps) row(m, d.district.id);
  for (const m of extraMaps) row(m);
  for (const d of districts) {
    for (const q of d.quests) {
      for (const st of q.steps) {
        const maps = new Set(stepMaps(st, content));
        // a scene named on the step's condition also sits where its talk happens; `where` adds the place when both are given
        if (st.where && st.where !== 'anywhere') maps.add(st.where);
        for (const m of maps) {
          const r = row(m);
          const tag = `${q.id}/${st.id}`;
          if (isSubstory(q.id)) r.substory.push(tag);
          else if (q.kind === 'main') r.main.push(tag);
          else r.side.push(tag);
        }
      }
    }
  }
  for (const b of books) if (b.place) row(b.place).books.push(b.id);
  return [...rows.values()].sort((a, b) => (a.district ?? '~').localeCompare(b.district ?? '~') || a.map.localeCompare(b.map));
}

/** Maps on no main route: a stop counts when another map of its district is on one. */
export function coverageProblems(rows: readonly CoverageRow[], exceptions: Readonly<Record<string, string>> = COVERAGE_EXCEPTIONS): string[] {
  const onRoute = new Set(rows.filter((r) => r.main.length && r.district).map((r) => r.district));
  return rows
    .filter((r) => !r.main.length && !(r.map in exceptions))
    .filter((r) => !(isStop(r.map) && r.district && onRoute.has(r.district)))
    .map((r) => `map ${r.map}${r.district ? ` (${r.district})` : ' (in no district)'} is on no main route`);
}

/** Books on disk (B1): `content/world/books/<id>.json` with an optional `place`. */
export function readBooks(contentRoot: string): BookRef[] {
  const dir = join(contentRoot, 'books');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as BookRef);
}

/** Every built map id (the `.map.txt` sources). */
export function mapIds(contentRoot: string): string[] {
  const dir = join(contentRoot, 'maps');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.map.txt')).map((f) => f.replace(/\.map\.txt$/, '')) : [];
}

async function main() {
  const { checkContent, readLibrary } = await import('./check-content');
  const root = 'content/world';
  const r = checkContent(root, readLibrary());
  const rows = coverage(r.districts, readBooks(root), mapIds(root));
  const missing = new Set(coverageProblems(rows).map((p) => p.split(' ')[1]));
  const only = process.argv.includes('--missing');
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '—');
  for (const x of rows) {
    if (only && !missing.has(x.map)) continue;
    const mark = missing.has(x.map) ? '✗' : x.map in COVERAGE_EXCEPTIONS ? '·' : '✓';
    console.log(`${mark} ${x.map} [${x.district ?? 'no district'}]\n    main: ${list(x.main)}\n    side: ${list(x.side)}${x.substory.length ? `\n    substory: ${list(x.substory)}` : ''}${x.books.length ? `\n    books: ${list(x.books)}` : ''}`);
  }
  console.log(`${rows.length} maps, ${missing.size} on no main route`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
