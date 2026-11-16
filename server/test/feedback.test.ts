import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FeedbackItem } from '../../shared/feedback';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

async function setUp() {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock() });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
  return { app, owner: await signUp('kirill'), learner: await signUp('masha') };
}

describe('feedback sent from the site (A12)', () => {
  it('is kept as text with its page, and read and marked only by an admin', async () => {
    const { app, owner, learner } = await setUp();
    const send = (body: object, cookie?: string) => call(app, 'POST', '/api/feedback', { cookie, body });
    assert.equal((await send({ kind: 'wrong', message: 'x', page: '/read' })).status, 401);
    assert.equal((await send({ kind: 'wrong', message: '   ', page: '/read' }, learner)).status, 400);
    assert.equal((await send({ kind: 'wrong', message: 'a'.repeat(2001), page: '/read' }, learner)).status, 400);
    assert.equal((await send({ kind: 'missing', message: '<b>No</b> pinyin on the cards', page: '/cards?item=c好#x' }, learner)).status, 201);

    assert.equal((await call(app, 'GET', '/api/admin/feedback', { cookie: learner })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/feedback')).status, 401);
    const { items } = (await (await call(app, 'GET', '/api/admin/feedback', { cookie: owner })).json()) as { items: FeedbackItem[] };
    assert.deepEqual(items.map((i) => [i.kind, i.message, i.page, i.username, i.status]), [['missing', '<b>No</b> pinyin on the cards', '/cards', 'masha', 'new']]);

    assert.equal((await call(app, 'PATCH', `/api/admin/feedback/${items[0]!.id}`, { cookie: learner, body: { status: 'closed' } })).status, 403);
    assert.equal((await call(app, 'PATCH', `/api/admin/feedback/${items[0]!.id}`, { cookie: owner, body: { status: 'shouted' } })).status, 400);
    assert.equal((await call(app, 'PATCH', '/api/admin/feedback/nothing', { cookie: owner, body: { status: 'closed' } })).status, 404);
    assert.equal((await call(app, 'PATCH', `/api/admin/feedback/${items[0]!.id}`, { cookie: owner, body: { status: 'answered' } })).status, 204);
    const answered = (await (await call(app, 'GET', '/api/admin/feedback?status=answered', { cookie: owner })).json()) as { items: FeedbackItem[] };
    assert.equal(answered.items.length, 1);
    const fresh = (await (await call(app, 'GET', '/api/admin/feedback?status=new', { cookie: owner })).json()) as { items: FeedbackItem[] };
    assert.equal(fresh.items.length, 0);
  });

  it('takes ten a day from an account', async () => {
    const { app, learner } = await setUp();
    for (let i = 0; i < 10; i++) assert.equal((await call(app, 'POST', '/api/feedback', { cookie: learner, body: { kind: 'good', message: `nice ${i}`, page: '/' } })).status, 201);
    assert.equal((await call(app, 'POST', '/api/feedback', { cookie: learner, body: { kind: 'good', message: 'again', page: '/' } })).status, 429);
  });
});
