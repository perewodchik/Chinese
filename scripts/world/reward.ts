/**
 * Rewardness (RW1, the learner 2026-10-01: "I spent a lot of time doing this quest yet I feel like
 * it's for nothing"). For every place a player can stand, what being there gives — and for every
 * main quest step, whether a long trip ends somewhere that pays it back.
 *
 * Points for what a place holds (its scenes, cutscenes and props, from the content):
 *   cutscene 3 · book 4 · 成语 3 · place-card fact 2 · stamp 1 · item given 1 ·
 *   a talk that asks you to say something 1 (at most 3) · a new situation word 0.5 (at most 4)
 *
 * A landmark (a `sight` in places.ts, or a map with a card) under THIN points is red. A main step
 * that ends in another district than the step before (a ride: minutes, not seconds) must end
 * somewhere with a cutscene or a collectible (book, 成语, card fact, stamp). The report goes to
 * docs/world-game/review/reward.md.
 *
 *   npx tsx scripts/world/reward.ts            (writes the report, prints the red rows)
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PLACES } from '../../src/world/core/places';
import type { DistrictContent } from '../../src/world/core/types';
import { checkContent, readLibrary } from './check-content';

export const THIN = 6;

export interface PlaceReward {
  map: string;
  zh: string;
  landmark: boolean;
  points: number;
  parts: Record<string, number>;
  collectible: boolean;
  cutscene: boolean;
}

export function rewards(districts: readonly DistrictContent[]): PlaceReward[] {
  const scenes = districts.flatMap((d) => d.scenes);
  const cutscenes = districts.flatMap((d) => d.cutscenes ?? []);
  const cards = districts.flatMap((d) => d.cards ?? []);
  const stamps = districts.flatMap((d) => d.stamps);
  const maps = [...new Set(districts.flatMap((d) => d.district.maps))];
  return maps.map((map) => {
    const here = scenes.filter((s) => s.map === map);
    const acts = JSON.stringify(here);
    const count = (re: RegExp) => [...acts.matchAll(re)].length;
    const parts: Record<string, number> = {
      cutscenes: cutscenes.filter((c) => c.map === map).length * 3,
      books: count(/"do":"book"/g) * 4,
      idioms: count(/"do":"idiom"/g) * 3,
      facts: cards.filter((c) => c.map === map).reduce((n, c) => n + c.facts.length, 0) * 2,
      stamps: stamps.filter((s) => s.place === map).length,
      items: count(/"do":"give"/g),
      talks: Math.min(3, here.filter((s) => s.nodes.some((n) => n.expect?.length)).length),
      words: Math.min(4, new Set(here.flatMap((s) => (s.words ?? []).map((w) => w.w))).size * 0.5),
    };
    const points = Object.values(parts).reduce((a, b) => a + b, 0);
    const place = PLACES.find((p) => p.map === map);
    return {
      map,
      zh: place?.zh ?? map,
      landmark: place?.kind === 'sight' || cards.some((c) => c.map === map),
      points,
      parts,
      collectible: parts.books! + parts.idioms! + parts.facts! + parts.stamps! > 0,
      cutscene: parts.cutscenes! > 0,
    };
  });
}

/** main steps that end in another district than the step before, somewhere with no cutscene or collectible */
export function emptyTrips(districts: readonly DistrictContent[], places: readonly PlaceReward[]): string[] {
  const districtOf = new Map(districts.flatMap((d) => d.district.maps.map((m) => [m, d.district.id] as const)));
  const byMap = new Map(places.map((p) => [p.map, p]));
  const out: string[] = [];
  for (const q of districts.flatMap((d) => d.quests).filter((x) => x.kind === 'main')) {
    let prev: string | undefined;
    for (const st of q.steps) {
      const where = st.where;
      if (where && prev && districtOf.get(where) !== districtOf.get(prev)) {
        const p = byMap.get(where);
        if (p && !p.cutscene && !p.collectible) out.push(`${q.id}/${st.id}: a ride to ${p.zh} (${where}) ends with nothing to keep or see`);
      }
      if (where) prev = where;
    }
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const districts = checkContent('content/world', readLibrary()).districts;
  const places = rewards(districts).sort((a, b) => Number(b.landmark) - Number(a.landmark) || a.points - b.points);
  const thin = places.filter((p) => p.landmark && p.points < THIN);
  const trips = emptyTrips(districts, places);
  const row = (p: PlaceReward) =>
    `| ${p.points < THIN && p.landmark ? '🔴' : p.points < THIN ? '·' : '✓'} | ${p.zh} \`${p.map}\` | ${p.points} | ${Object.entries(p.parts)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')} |`;
  const md = `# Rewardness (RW1)

What being somewhere gives you, from the content (\`scripts/world/reward.ts\`; points: cutscene 3, book 4, 成语 3,
place-card fact 2, stamp 1, item 1, a talk that asks you to speak 1 (≤ 3), a situation word 0.5 (≤ 4)).
A landmark under ${THIN} points is red. Rebuilt by \`npx tsx scripts/world/reward.ts\`.

## Rides that end with nothing (${trips.length})
${trips.map((t) => `- ${t}`).join('\n') || '- none'}

## Landmarks under ${THIN} (${thin.length})
${thin.map((p) => `- ${p.zh} \`${p.map}\`: ${p.points}`).join('\n') || '- none'}

## Every place
| | Place | Points | From |
|---|---|---|---|
${places.map(row).join('\n')}
`;
  writeFileSync('docs/world-game/review/reward.md', md);
  console.log(`${places.length} places; ${thin.length} thin landmarks; ${trips.length} empty rides`);
  for (const p of thin) console.log(`thin: ${p.zh} ${p.map} ${p.points}`);
  for (const t of trips) console.log(`trip: ${t}`);
}
