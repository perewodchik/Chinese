import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * R3: a feature imports from domain, store, ui, platform, api, navigation and
 * features/shared — and not from another feature. `auth` is the session every
 * signed-in page stands in (who is signed in, its messages, asking for the
 * password again), so any feature may use it. What is listed in KNOWN waits
 * for R2 (the old Speak taken apart after V9), and may only shrink.
 */
const ROOT = join(import.meta.dirname);
const ANYONE = new Set(['shared', 'auth']);
const KNOWN = new Set(['speak->pinyin', 'reader->pinyin', 'pinyin->words', 'pinyin->speak', 'pinyin->settings', 'pinyin->reader']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

describe('the borders between features (R3)', () => {
  it('has no feature reaching into another, beyond the known ones waiting for R2', () => {
    const found = new Set<string>();
    for (const feature of readdirSync(ROOT).filter((n) => statSync(join(ROOT, n)).isDirectory())) {
      for (const file of files(join(ROOT, feature))) {
        // From the feature's own folder or a folder inside it, "../x/" or "../../x/" reaches another feature.
        const depth = file.slice(join(ROOT, feature).length + 1).split('/').length - 1;
        const up = '../'.repeat(depth + 1);
        for (const m of readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)) {
          const spec = m[1]!;
          if (!spec.startsWith(up) || spec.startsWith(`${up}../`)) continue;
          const other = spec.slice(up.length).split('/')[0]!;
          if (other !== feature && !ANYONE.has(other)) found.add(`${feature}->${other}`);
        }
      }
    }
    const fresh = [...found].filter((x) => !KNOWN.has(x));
    assert.deepEqual(fresh, [], `new imports across features: ${fresh.join(', ')}`);
    const gone = [...KNOWN].filter((x) => !found.has(x));
    assert.deepEqual(gone, [], `no longer needed, take out of KNOWN: ${gone.join(', ')}`);
  });
});
