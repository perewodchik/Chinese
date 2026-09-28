/**
 * Writes the golden saves (prompt X0): the solver's save at the moment each
 * chapter begins, to `content/world/test-saves/chapter-<n>.json`. The test
 * in solver.test.ts loads each through the migration and plays the rest of
 * the game from it — so a change that breaks an old save shows up.
 *
 *   npx tsx scripts/world/golden-saves.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { solve } from './solver';

export const GOLDEN = 'content/world/test-saves';

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  mkdirSync(GOLDEN, { recursive: true });
  const run = solve();
  for (const [chapter, save] of run.chapters) {
    writeFileSync(`${GOLDEN}/chapter-${chapter}.json`, JSON.stringify({ ...save, updatedAt: 1, deviceId: 'golden' }, null, 1) + '\n');
  }
  console.log([...run.chapters.keys()].join(' '));
}
