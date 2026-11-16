import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainPrompt } from './explainText';
import { parseResponse, whyNothing } from './parse';

describe('what a paste that holds nothing says (K21)', () => {
  it('knows the prompt pasted back for the answer', () => {
    const prompt = explainPrompt({ lines: [{ zh: '我饿了。', py: '', en: '' }], title: 't', titleZh: '', basis: [] });
    assert.match(parseResponse(prompt).problems[0]!, /looks like the prompt/);
    assert.match(whyNothing('## What to send back\nOne JSON code block and nothing else', 'words'), /looks like the prompt/);
  });

  it('knows an answer cut off part-way', () => {
    assert.match(parseResponse('```json\n{"texts": [{"title": "A", "lines": [{"zh": "我').problems[0]!, /cut off/);
  });

  it('knows an answer with no JSON at all', () => {
    assert.match(parseResponse('Sure! Here is a story about a cat. 我有一只猫。').problems[0]!, /no JSON in this/);
  });

  it('otherwise says what it looked for', () => {
    assert.match(whyNothing('{"hello": 1}', 'words'), /No words found/);
  });
});
