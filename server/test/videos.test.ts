import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTimedText } from '../src/infrastructure/youtube';

describe('YouTube timed text', () => {
  it('reads cues, entities and line breaks, and drops empty ones', () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8" ?><transcript>' +
      '<text start="2.766" dur="1.3">我是佩奇\nwǒ shì pèi qí\nI am Peppa</text>' +
      '<text start="5" dur="2">It&amp;#39;s &quot;fine&quot;</text>' +
      '<text start="8" dur="1"> </text></transcript>';
    assert.deepEqual(parseTimedText(xml), [
      { at: 2.766, end: 4.066, text: '我是佩奇\nwǒ shì pèi qí\nI am Peppa' },
      { at: 5, end: 7, text: 'It\'s "fine"' },
    ]);
  });
});

describe('a video looked up once is kept for everyone', () => {
  it('answers from what was kept, without asking YouTube or counting a lookup', async () => {
    const { makeApp, call, sessionCookie } = await import('./support');
    const { app, services } = makeApp();
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
    const id = 'dQw4w9WgXcQ';
    const kept = { id, title: '小猫', seconds: 60, lines: [] };
    await services.lookups.put(`youtube:video:${id}`, JSON.stringify(kept), services.clock.now());
    const real = globalThis.fetch;
    let asked = 0;
    globalThis.fetch = (async () => {
      asked++;
      throw new Error('YouTube must not be asked');
    }) as typeof fetch;
    try {
      for (let i = 0; i < 70; i++) {
        const res = await call(app, 'GET', `/api/videos/youtube/${id}`, { cookie });
        assert.equal(res.status, 200);
      }
      assert.deepEqual(await (await call(app, 'GET', `/api/videos/youtube/${id}`, { cookie })).json(), kept);
      assert.equal(asked, 0);
    } finally {
      globalThis.fetch = real;
    }
  });
});
