import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { allCalls } from '../../src/world/core/ride';
import { voiceKey } from '../../src/world/core/voice';
import { clipsOf, VOICE_OUT } from './build-voices';
import { checkContent, readLibrary } from './check-content';

const districts = checkContent('content/world', readLibrary()).districts;

describe('the voices to render', () => {
  const clips = clipsOf(districts);
  const keys = new Set(clips.map((c) => c.key));

  it('every line a person says, in their voice; the hero is silent', () => {
    assert.ok(keys.has(voiceKey('wang', '你叫什么名字？')));
    assert.ok(keys.has(voiceKey('chen', '早！要什么？包子、豆浆、油条都有。')));
    assert.ok(!clips.some((c) => c.text === '这是我的新房间！'));
  });

  it('their stock replies and explanations too', () => {
    assert.ok(keys.has(voiceKey('wang', '不客气！')));
    assert.ok(keys.has(voiceKey('wang', '“灯笼”就是晚上用的红色的灯，门口有，过年也有。')));
  });

  it('the train calls in the announcer\'s voice', () => {
    assert.ok(allCalls().some((c) => c.startsWith('下一站：王府井。可以换乘')));
    assert.ok(keys.has(voiceKey('xiaoyu', '王府井到了。')));
  });

  it('the index lists only clips that exist', () => {
    if (!existsSync(`${VOICE_OUT}/index.json`)) return;
    for (const k of JSON.parse(readFileSync(`${VOICE_OUT}/index.json`, 'utf8')) as string[]) assert.ok(existsSync(`${VOICE_OUT}/${k}.mp3`), k);
  });
});
