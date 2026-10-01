import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { HUTONG_SIGNS, HUTONG_STAMP, hutongsRead, readHutongSign } from './hutongs';
import { applyAll, newSave } from './save';

describe('the sixteen 胡同 of 南锣鼓巷 (MH2)', () => {
  it('every sign it counts is on the map', () => {
    const objs = JSON.parse(readFileSync('content/world/maps/nanluo-main.objects.json', 'utf8')) as Array<{ kind: string; id: string; text?: string }>;
    for (const id of HUTONG_SIGNS) assert.match(objs.find((o) => o.kind === 'sign' && o.id === id)?.text ?? '', /胡同$/, id);
    assert.equal(HUTONG_SIGNS.length, 16);
  });

  it('remembers each name once, and gives the stamp on the sixteenth', () => {
    let s = newSave('t', 0);
    for (const [i, id] of HUTONG_SIGNS.entries()) {
      const acts = readHutongSign(s, id);
      assert.equal(acts.some((a) => a.do === 'stamp'), i === 15, id);
      s = applyAll(s, acts, { now: 1 });
      assert.deepEqual(readHutongSign(s, id), [], 'a second read changes nothing');
    }
    assert.equal(hutongsRead(s), 16);
    assert.ok(s.stamps[HUTONG_STAMP]);
  });

  it('ignores every other sign', () => {
    assert.deepEqual(readHutongSign(newSave('t', 0), 's-chaguan'), []);
  });
});
