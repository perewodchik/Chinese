import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goalMaps } from './goal';
import { newSave } from './save';
import type { Quest, Scene } from './types';

const scene = (id: string, map: string): Scene => ({ id, map, trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好', translate: 'Hi' }] });

describe('the task on the map', () => {
  it('is where the step still waits: the scene not yet played, the station not yet reached', () => {
    const q: Quest = { id: 'q', title: 'Q', chapter: 1, steps: [{ id: 's', now: 'Go', done: { all: [{ scene: 'tea' }, { station: 'wangfujing' }, { flag: 'x' }] } }] };
    let s = newSave('t', 0);
    s = { ...s, quests: { q: { step: 's', index: 0, done: false } } } as typeof s;
    assert.deepEqual(goalMaps(s, [q], [scene('tea', 'chaguan')], []).sort(), ['chaguan', 'station-wangfujing']);
    s = { ...s, scenes: ['tea'] };
    assert.deepEqual(goalMaps(s, [q], [scene('tea', 'chaguan')], []), ['station-wangfujing']);
  });

  it('is nowhere without a quest', () => {
    assert.deepEqual(goalMaps(newSave('t', 0), [], [], []), []);
  });
});
