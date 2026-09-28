/**
 * The map probe (prompt X0): opens `/play/world?map=<id>` for every built
 * map in WebKit (the engine of Safari and the iPad) at 375, 768 and 1024
 * wide, and reports per map: did the game start, did the canvas draw, the
 * frame rate. Needs the dev server with the test database:
 *
 *   preview config `hanzi-workshop-mac-world` (port 5179, HANZI_DB=.data/world-test.db)
 *   swiftc -O scripts/webkit-probe.swift -o .cache/webkit-probe
 *   npx tsx scripts/world/map-probe.ts http://localhost:5179
 *
 * Unattended builder sessions cannot start the server, so this has not been
 * run yet (see STATUS.md).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5179';
const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as Record<string, unknown>;
const bad: string[] = [];
for (const map of Object.keys(index)) {
  for (const width of [375, 768, 1024]) {
    let out = '';
    try {
      out = execFileSync('.cache/webkit-probe', [`${base}/play/world?map=${map}&time=day`, String(width), 'scripts/world/map-probe.js'], { encoding: 'utf8', timeout: 60_000 }).trim();
    } catch (e) {
      out = `FAIL ${(e as Error).message.split('\n')[0]}`;
    }
    console.log(`${map} @${width}: ${out}`);
    if (!out.startsWith('{')) bad.push(`${map} @${width}`);
  }
}
if (bad.length) {
  console.log(`\n${bad.length} failed:\n${bad.join('\n')}`);
  process.exit(1);
}
