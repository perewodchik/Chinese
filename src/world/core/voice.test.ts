import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NpcCard } from './types';
import { voiceKey, voiceOf } from './voice';

const card = (id: string, voice?: string): NpcCard => ({ id, name: 'x', role: '', look: { sprite: 'uncle' }, ...(voice ? { voice } : {}), character: '', knows: [], wants: [], actions: [], routine: [], explains: {} });

describe('voices', () => {
  it('a card names its voice; the hero and signs are silent; 兔儿爷 has his own', () => {
    const cards = [card('wang-ayi', 'wang'), card('nobody'), card('odd', 'auntie-warm')];
    assert.equal(voiceOf('wang-ayi', cards), 'wang');
    assert.equal(voiceOf('nobody', cards), null);
    assert.equal(voiceOf('odd', cards), null);
    assert.equal(voiceOf('hero', cards), null);
    assert.equal(voiceOf('companion', cards), 'zhiyuan');
  });

  it('a stable key per voice and text', () => {
    assert.equal(voiceKey('wang', '你好！'), voiceKey('wang', '你好！'));
    assert.notEqual(voiceKey('wang', '你好！'), voiceKey('chen', '你好！'));
    assert.notEqual(voiceKey('wang', '你好！'), voiceKey('wang', '你好'));
    assert.match(voiceKey('wang', '你好！'), /^[0-9a-f]{16}$/);
  });
});
