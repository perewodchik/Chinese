import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { stored, storedJson, tabStored } from './storage';

/**
 * R10: the browser's storage only through src/platform/storage.ts. The walk
 * through Beijing (src/world) keeps its own saves with its own notes, and is
 * left to them; the workspace's queue of unsaved changes and the reading of
 * the old one-key workspace take a Storage object, so their tests can hand
 * them one of their own.
 */
const SRC = join(import.meta.dirname, '..');
const ALLOWED = ['platform/', 'world/', 'store/sync/outbox.ts', 'store/legacy.ts'];

/** The code of a file without its comments, roughly: what a mention in a comment says is not a use. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

describe('the browser’s storage (R10)', () => {
  it('is reached only through src/platform', () => {
    const found = files(SRC)
      .filter((f) => !ALLOWED.some((a) => relative(SRC, f).startsWith(a)))
      .filter((f) => /\b(localStorage|sessionStorage)\b/.test(code(readFileSync(f, 'utf8'))))
      .map((f) => relative(SRC, f));
    assert.deepEqual(found, []);
  });
});

describe('storage that is not there (R10)', () => {
  it('reads nothing and says a write was not kept, without a throw', () => {
    // There is no localStorage under node: the same as a Safari private window that refuses it.
    assert.equal(stored.get('hanzi.x'), null);
    assert.equal(stored.set('hanzi.x', '1'), false);
    assert.doesNotThrow(() => tabStored.remove('hanzi.x'));
    assert.deepEqual(storedJson('hanzi.x', { a: 1 }), { a: 1 });
  });
});

