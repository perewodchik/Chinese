import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildChars, ROUNDS } from './content';

describe('build a character', () => {
  it('builds full games from two-part characters of the band', () => {
    for (const band of [1, 2] as const) {
      const rounds = buildChars(testContext(band, 'b'));
      assert.equal(rounds.length, ROUNDS);
      for (const r of rounds) {
        assert.equal(r.tray.length, 5);
        assert.ok(r.parts.every((p) => r.tray.includes(p)));
        assert.ok(r.char.hsk <= 3);
      }
    }
  });

  it('knows 好 is 女 beside 子', () => {
    const ctx = testContext(1, 'hao');
    const hao = ctx.lib.byChar.get('好')!;
    assert.deepEqual(hao.parts, ['女', '子']);
    assert.ok(hao.ids?.startsWith('⿰'));
  });
});
