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
  const db = openDatabase(':memory:');
  const services = createServices(sqliteStores(db), { hasher: cheapHasher, clock, narrator, evaluator });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
  const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'learner', password: 'correct horse' } }));
  return { app, cookie, clock, db };
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

describe('a copy of the account’s work', () => {
  it('is everything kept, as one file to download, without the keys', async () => {
    const s = await setUp();
    await call(s.app, 'PUT', '/api/eval/key', { cookie: s.cookie, body: { provider: 'speechsuper', appKey: 'app123456', secretKey: 'secret0123456789abcd' } });
    await call(s.app, 'PUT', '/api/workspace', { cookie: s.cookie, body: { baseRevision: 0, document: { version: 11, texts: [{ id: 't1' }] } } });
    const res = await call(s.app, 'GET', '/api/account/export', { cookie: s.cookie });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition') ?? '', /attachment; filename="hanzi-workshop-learner-2026-09-11\.json"/);
    const text = await res.text();
    const body = JSON.parse(text) as { account: { username: string }; workspace: { document: { texts: unknown[] } } };
    assert.equal(body.account.username, 'learner');
    assert.deepEqual(body.workspace.document.texts, [{ id: 't1' }]);
    assert.ok(!text.includes('secret0123456789abcd'));
  });

  it('is for the signed-in learner only', async () => {
    const s = await setUp();
    assert.equal((await call(s.app, 'GET', '/api/account/export')).status, 401);
  });
});

describe('deleting the account', () => {
  it('takes the password, and leaves nothing of the account behind', async () => {
    const s = await setUp();
    await call(s.app, 'PUT', '/api/eval/key', { cookie: s.cookie, body: { provider: 'speechsuper', appKey: 'app123456', secretKey: 'secret0123456789abcd' } });
    await call(s.app, 'PUT', '/api/workspace', { cookie: s.cookie, body: { baseRevision: 0, document: { version: 11 } } });
    assert.equal((await call(s.app, 'DELETE', '/api/account', { cookie: s.cookie, body: { password: 'wrong horse' } })).status, 400);
    const gone = await call(s.app, 'DELETE', '/api/account', { cookie: s.cookie, body: { password: 'correct horse' } });
    assert.equal(gone.status, 204);
    assert.match(gone.headers.get('set-cookie') ?? '', /Max-Age=0/i);
    assert.equal((await call(s.app, 'GET', '/api/workspace', { cookie: s.cookie })).status, 401);
    const left = s.db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE '%user_id%'`)
      .all() as Array<{ name: string }>;
    for (const { name } of left) {
      if (name === 'invites') continue;
      const { n } = s.db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get() as { n: number };
      assert.equal(n, 0, `${name} still has rows`);
    }
    // The name is free again.
    assert.equal((await call(s.app, 'POST', '/api/auth/register', { body: { username: 'learner', password: 'correct horse' } })).status, 201);
  });

  it('is for the signed-in learner only', async () => {
    const s = await setUp();
    assert.equal((await call(s.app, 'DELETE', '/api/account', { body: { password: 'correct horse' } })).status, 401);
  });
});
