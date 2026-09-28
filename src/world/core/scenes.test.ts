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

  it('knows the districts', () => {
    assert.equal(DISTRICTS.length, 13);
    assert.equal(districtInfo('gulou')?.name, '鼓楼 · 南锣鼓巷');
  });
});
