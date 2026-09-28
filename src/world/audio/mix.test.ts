import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mixFor, nextIn } from './mix';

const lane = { crowd: 6, pigeons: 4, bikes: 2 };

describe('the street sounds', () => {
  it('a busy lane by day: people, pigeon whistles, bells', () => {
    const m = mixFor('nanluo-main', lane, 'day');
    assert.ok(m.crowd > 0.3);
    assert.ok(m.pigeonsEvery > 0 && m.bellsEvery > 0);
    assert.equal(m.station, false);
  });

  it('at night the pigeons sleep and the bells stop; the murmur drops', () => {
    const m = mixFor('nanluo-main', lane, 'night');
    assert.equal(m.pigeonsEvery, 0);
    assert.equal(m.bellsEvery, 0);
    assert.ok(m.crowd < mixFor('nanluo-main', lane, 'day').crowd);
  });

  it('a room is nearly quiet; a station has its own sound', () => {
    assert.ok(mixFor('zaodian', { crowd: 0, pigeons: 0, bikes: 0 }, 'day').crowd < 0.1);
    assert.equal(mixFor('station-nanluoguxiang', { crowd: 3, pigeons: 0, bikes: 0 }, 'day').station, true);
  });

  it('never the same interval twice, within ±40 %', () => {
    assert.equal(nextIn(30, () => 0), 18);
    assert.equal(nextIn(30, () => 1), 42);
  });
});
