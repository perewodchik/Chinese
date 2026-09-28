import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { districtInfo, DISTRICTS } from './districts';
import { applyAll, newSave } from './save';
import { autoScene, sceneFor } from './scenes';
import type { Scene } from './types';

const s = (id: string, extra: Partial<Scene>): Scene => ({ id, map: 'm', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好', translate: 'hi' }], ...extra });

describe('which scene plays', () => {
  const scenes = [
    s('first', { npc: 'wang', once: true, priority: 0 }),
    s('breakfast', { npc: 'wang', when: { hours: [6, 10] }, priority: 1 }),
    s('later', { npc: 'wang', priority: 5 }),
    s('sign', { trigger: 'look' }),
    s('arrive', { trigger: 'auto' }),
  ];
  const save = { ...newSave('d', 0), clock: 8 * 60 };

  it('the first meeting, once; then by priority and time', () => {
    assert.equal(sceneFor(scenes, save, { npc: 'wang' })?.id, 'first');
    const met = applyAll(save, [{ do: 'scene_done', scene: 'first' }], { now: 1 });
    assert.equal(sceneFor(scenes, met, { npc: 'wang' })?.id, 'breakfast');
    assert.equal(sceneFor(scenes, { ...met, clock: 14 * 60 }, { npc: 'wang' })?.id, 'later');
    assert.equal(sceneFor(scenes, save, { npc: 'li' }), null);
  });

  it('signs by id, arrivals once', () => {
    assert.equal(sceneFor(scenes, save, { look: 'sign' })?.id, 'sign');
    assert.equal(autoScene(scenes, save, 'm')?.id, 'arrive');
    assert.equal(autoScene(scenes, applyAll(save, [{ do: 'scene_done', scene: 'arrive' }], { now: 1 }), 'm'), null);
  });

  it('a look scene belongs to its object on its own map, and may vary by time', () => {
    const save = newSave('d', 0);
    const looks = [
      s('lion-day', { trigger: 'look', object: 'lion', map: 'square' }),
      s('lion-night', { trigger: 'look', object: 'lion', map: 'square', when: { hours: [19, 5] }, priority: -1 }),
      s('plant', { trigger: 'look', map: 'room' }),
    ];
    assert.equal(sceneFor(looks, save, { look: 'lion', map: 'square' })?.id, 'lion-day');
    assert.equal(sceneFor(looks, { ...save, clock: 20 * 60 }, { look: 'lion', map: 'square' })?.id, 'lion-night');
    assert.equal(sceneFor(looks, save, { look: 'lion', map: 'elsewhere' }), null);
    assert.equal(sceneFor(looks, save, { look: 'plant', map: 'room' })?.id, 'plant');
  });

  it('knows the districts', () => {
    assert.equal(DISTRICTS.length, 13);
    assert.equal(districtInfo('gulou')?.name, '鼓楼 · 南锣鼓巷');
  });
});
