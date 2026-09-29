import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { castMap } from './cast';
import { holds } from './flags';
import { readSave } from './migrate';
import { merge } from './merge';
import { catNameFrom, catProps, fits, ROOM_MAP, roomProps } from './room';
import { applyAll, newSave } from './save';

const ctx = { now: 1 };
const withItems = (...ids: string[]) => applyAll(newSave('d', 0), ids.map((item) => ({ do: 'give' as const, item })), ctx);

describe('your room (X5)', () => {
  it('a decoration goes on a spot that suits it, out of the bag; the one there before comes back', () => {
    assert.ok(fits('jianzhi', 'spot-window'));
    assert.ok(!fits('jianzhi', 'spot-floor-l'));
    assert.ok(fits('denglong', 'spot-floor-l'));
    assert.ok(!fits('huapen', 'spot-wall-l'));
    let s = withItems('jianzhi', 'shufa');
    s = applyAll(s, [{ do: 'place', spot: 'spot-wall-l', item: 'jianzhi' }], ctx);
    assert.equal(s.room['spot-wall-l'], 'jianzhi');
    assert.equal(s.bag.items.jianzhi, undefined);
    assert.ok(s.flags.includes('decor-jianzhi') && s.flags.includes('room-decorated'));
    s = applyAll(s, [{ do: 'place', spot: 'spot-wall-l', item: 'shufa' }], ctx);
    assert.equal(s.room['spot-wall-l'], 'shufa');
    assert.equal(s.bag.items.jianzhi, 1);
    // not in the bag, or the wrong spot: nothing happens
    assert.equal(applyAll(s, [{ do: 'place', spot: 'spot-window', item: 'lianpu' }], ctx), s);
    assert.equal(applyAll(s, [{ do: 'place', spot: 'spot-floor-l', item: 'jianzhi' }], ctx), s);
  });

  it('what is in place is drawn in the room, and only there', () => {
    const s = applyAll(withItems('denglong'), [{ do: 'place', spot: 'spot-floor-r', item: 'denglong' }], ctx);
    assert.deepEqual(roomProps(s).map((p) => p.kind === 'prop' && [p.frame, p.tile, p.night]), [['lantern/unlit', [8, 6], 'lantern/lit-0']]);
    assert.ok(castMap([], ROOM_MAP, [], s).some((o) => o.id === 'decor-spot-floor-r'));
    assert.ok(!castMap([], 'siheyuan-yard', [], s).some((o) => o.id === 'decor-spot-floor-r'));
  });
});

describe('the hutong cat (X5)', () => {
  it('trusts you after three different days of food, then takes a name', () => {
    let s = newSave('d', 0);
    s = applyAll(s, [{ do: 'feed_cat' }, { do: 'feed_cat' }], ctx);
    assert.equal(s.cat.fed, 1);
    assert.ok(holds({ cat: 'fed-today' }, s));
    for (let d = 0; d < 2; d++) s = applyAll({ ...s, clock: s.clock + 24 * 60 }, [{ do: 'feed_cat' }], ctx);
    assert.ok(holds({ cat: 'trusts' }, s));
    assert.ok(!holds({ cat: 'named' }, s));
    s = applyAll(s, [{ do: 'cat_name', name: '小花' }], ctx);
    assert.ok(holds({ cat: 'named' }, s) && s.flags.includes('cat-named'));
  });

  it('hears its name in 它叫小花 / 叫它咪咪 / just 小白', () => {
    assert.equal(catNameFrom('它叫小花。'), '小花');
    assert.equal(catNameFrom('叫它咪咪吧'), '咪咪');
    assert.equal(catNameFrom('小白'), '小白');
    assert.equal(catNameFrom('I do not know'), null);
  });

  it('waits in the lane until named, then sleeps in the courtyard', () => {
    const s = newSave('d', 0);
    assert.equal(catProps(s, 'hutong-home').length, 1);
    assert.equal(catProps(s, 'siheyuan-yard').length, 0);
    const named = { ...s, cat: { fed: 3, day: 3, name: '小花' } };
    assert.equal(catProps(named, 'hutong-home').length, 0);
    assert.deepEqual(catProps(named, 'siheyuan-yard').map((p) => p.kind === 'prop' && p.frame), ['cat/sleep']);
  });

  it('a version 4 save gains an empty room and a cat not met; the merge keeps its name and its days', () => {
    const r = readSave({ ...newSave('d', 0), version: 4, room: undefined, cat: undefined });
    assert.ok(r.ok && Object.keys(r.save.room).length === 0 && r.save.cat.fed === 0);
    const a = { ...newSave('a', 0), updatedAt: 9, cat: { fed: 1, day: 4, name: '' } };
    const b = { ...newSave('b', 0), updatedAt: 5, cat: { fed: 3, day: 3, name: '小花' } };
    assert.deepEqual(merge(a, b).cat, { fed: 3, day: 4, name: '小花' });
  });
});
