import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newSave } from '../save';
import type { Scene } from '../types';
import { LIVE_DIALOGUE_ENABLED, LiveDialogue } from './live';
import type { DialogueSource, DialogueState, Turn } from './source';

const turn = (zh: string, key = false): Turn => ({
  kind: 'match',
  say: { speaker: 'x', zh, en: '', node: 'n', ...(key ? { key: true } : {}) },
  actions: [{ do: 'flag', flag: 'f' }],
  state: { scene: 's', node: 'n', misses: 0, hint: 0, ended: false },
});

describe('the live dialogue hook', () => {
  it('is off, and until it is on it is exactly the script', () => {
    assert.equal(LIVE_DIALOGUE_ENABLED, false);
    const script: DialogueSource = {
      start: () => turn('你好！'),
      reply: () => turn('好的。'),
      proceed: () => turn('再见！', true),
    };
    const live = new LiveDialogue(script);
    const scene = { id: 's' } as Scene;
    const state = {} as DialogueState;
    assert.deepEqual(live.start(scene, newSave('d', 0)), script.start(scene, newSave('d', 0)));
    assert.deepEqual(live.reply(state, { text: '好', via: 'keyboard' }), script.reply(state, { text: '好', via: 'keyboard' }));
    assert.deepEqual(live.proceed(state), script.proceed(state));
  });
});
