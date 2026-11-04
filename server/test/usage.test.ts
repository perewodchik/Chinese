import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UsageResponse } from '../../shared/usage';
import type { Narrator } from '../src/application/ports';
import type { Evaluator } from '../src/application/speech-eval-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const KEY = 'sk-api-good-key-0123456789';
const narrator: Narrator = {
  async voices() {
    return [{ id: 'Chinese (Mandarin)_News_Anchor', name: 'News Anchor (Female)', description: 'A news anchor' }];
  },
  async design() {
    return { voiceId: 'designed-1', trial: new Uint8Array(300) };
  },
  async readText() {
    return { audio: new Uint8Array(8000), segments: [] };
  },
  async read() {
    return new Uint8Array(500);
  },
};
const evaluator: Evaluator = {
  async evaluate() {
    return { total: 90 } as never;
  },
};

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock, narrator, evaluator });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
  const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'learner', password: 'correct horse' } }));
  return { app, cookie, clock };
}
const usage = async (s: Awaited<ReturnType<typeof setUp>>) => (await (await call(s.app, 'GET', '/api/account/usage', { cookie: s.cookie })).json()) as UsageResponse;

describe('what the learner’s own keys were spent on', () => {
  it('is nothing at all for an account with no keys', async () => {
    const s = await setUp();
    assert.deepEqual((await usage(s)).lines, []);
  });

  it('counts a scored phrase in seconds of speech, and trying the keys as a call', async () => {
    const s = await setUp();
    assert.equal((await call(s.app, 'PUT', '/api/eval/key', { cookie: s.cookie, body: { provider: 'speechsuper', appKey: 'app123456', secretKey: 'secret0123456789abcd' } })).status, 200);
    // Two seconds of 16 kHz, 16-bit speech.
    const audio = Buffer.alloc(64_000).toString('base64');
    const scored = await call(s.app, 'POST', '/api/eval', { cookie: s.cookie, body: { text: '你好', audio } });
    assert.equal(scored.status, 200, await scored.clone().text());
    const line = (await usage(s)).lines.find((l) => l.service === 'speechsuper')!;
    assert.equal(line.keySet, true);
    assert.deepEqual(line.today, { calls: 2, units: 2 });
    assert.deepEqual(line.month, line.today);
    assert.equal(line.days.length, 30);
  });

  it('counts MiniMax in characters read, and a reading kept from before as nothing', async () => {
    const s = await setUp();
    await call(s.app, 'PUT', '/api/narration/key', { cookie: s.cookie, body: { key: KEY } });
    const made = await (await call(s.app, 'POST', '/api/narration/narrators', { cookie: s.cookie, body: { name: 'Anchor', voice: 'Chinese (Mandarin)_News_Anchor' } })).json();
    const id = (made as { narrator: { id: string } }).narrator.id;
    const read = { narrator: id, lines: ['你好。'], generate: true };
    assert.equal((await call(s.app, 'POST', '/api/narration/texts', { cookie: s.cookie, body: read })).status, 200);
    const once = (await usage(s)).lines.find((l) => l.service === 'minimax')!;
    assert.equal(once.today.calls, 1);
    assert.ok(once.today.units >= 3);
    await call(s.app, 'POST', '/api/narration/texts', { cookie: s.cookie, body: read });
    assert.deepEqual((await usage(s)).lines.find((l) => l.service === 'minimax')!.today, once.today);
  });

  it('starts a new day at midnight UTC, and keeps the month together', async () => {
    const s = await setUp();
    await call(s.app, 'PUT', '/api/eval/key', { cookie: s.cookie, body: { provider: 'speechsuper', appKey: 'app123456', secretKey: 'secret0123456789abcd' } });
    s.clock.advance(86_400_000);
    const line = (await usage(s)).lines.find((l) => l.service === 'speechsuper')!;
    assert.deepEqual(line.today, { calls: 0, units: 0 });
    assert.equal(line.days.at(-2)!.calls, 1);
  });

  it('is for signed-in learners only', async () => {
    const s = await setUp();
    assert.equal((await call(s.app, 'GET', '/api/account/usage')).status, 401);
  });
});
