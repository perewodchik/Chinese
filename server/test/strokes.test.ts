import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { forgetOutlines, lookUpOutlines, type Fetch } from '../src/infrastructure/stroke-outlines';

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('stroke outlines off the syllabus', () => {
  beforeEach(forgetOutlines);

  it('returns what the source has, keeps it, and leaves out what it does not', async () => {
    const asked: string[] = [];
    const get: Fetch = async (url) => {
      asked.push(decodeURIComponent(url.split('/').pop()!));
      return url.includes(encodeURIComponent('圳')) ? answer(200, { strokes: ['M 1 2 Z'], medians: [[[1, 2]]] }) : answer(404, {});
    };
    assert.deepEqual(await lookUpOutlines(['圳', '㐀'], get), { 圳: { s: ['M 1 2 Z'], m: [[[1, 2]]] } });
    await lookUpOutlines(['圳', '㐀'], get);
    assert.deepEqual(asked.sort(), ['㐀.json', '圳.json']);
  });

  it('asks again after a failure rather than remembering it', async () => {
    let calls = 0;
    const get: Fetch = async () => {
      calls += 1;
      return calls === 1 ? answer(503, {}) : answer(200, { strokes: ['M 0 0 Z'] });
    };
    assert.deepEqual(await lookUpOutlines(['鹏'], get), {});
    assert.deepEqual(await lookUpOutlines(['鹏'], get), { 鹏: { s: ['M 0 0 Z'], m: undefined } });
  });
});
