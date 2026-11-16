import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminLogPage, AdminOverview } from '../../shared/admin';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock, type TestApp } from './support';

const PASSWORD = 'correct horse';
const NEW = 'a brand new horse';

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: PASSWORD } }));
  const owner = await signUp('kirill');
  const learner = await signUp('masha');
  const other = await signUp('petya');
  const ov = (await (await call(app, 'GET', '/api/admin/overview', { cookie: owner })).json()) as AdminOverview;
  const id = (name: string) => ov.accounts.find((a) => a.username === name)!.id;
  return { app, clock, owner, learner, other, id };
}

const link = async (app: TestApp, cookie: string, id: string) => (await (await call(app, 'POST', `/api/admin/accounts/${id}/reset-link`, { cookie })).json()) as { code: string; expiresAt: number };
const reset = (app: TestApp, code: string, newPassword = NEW) => call(app, 'POST', '/api/auth/reset', { body: { code, newPassword } });
const login = (app: TestApp, username: string, password: string) => call(app, 'POST', '/api/auth/login', { body: { username, password } });

describe('a reset link made by an admin (A6)', () => {
  it('is made only by an admin, for someone else, and is in the log', async () => {
    const { app, owner, learner, id } = await setUp();
    assert.equal((await call(app, 'POST', `/api/admin/accounts/${id('petya')}/reset-link`)).status, 401);
    assert.equal((await call(app, 'POST', `/api/admin/accounts/${id('petya')}/reset-link`, { cookie: learner })).status, 403);
    assert.equal((await call(app, 'POST', `/api/admin/accounts/${id('kirill')}/reset-link`, { cookie: owner })).status, 400);
    assert.equal((await call(app, 'POST', '/api/admin/accounts/nobody/reset-link', { cookie: owner })).status, 404);
    const made = await link(app, owner, id('masha'));
    assert.match(made.code, /^[A-Z0-9]{24}$/);
    const log = (await (await call(app, 'GET', '/api/admin/log?action=reset-link', { cookie: owner })).json()) as AdminLogPage;
    assert.deepEqual(log.entries.map((e) => [e.actor, e.target]), [['kirill', 'masha']]);
  });

  it('sets a new password once, signs every old browser out and this one in; a weak password costs nothing', async () => {
    const { app, owner, learner, id } = await setUp();
    const { code } = await link(app, owner, id('masha'));
    assert.equal((await reset(app, code, 'short')).status, 400);
    const done = await reset(app, code);
    assert.equal(done.status, 200);
    assert.ok(sessionCookie(done));
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: learner })).status, 401);
    assert.equal((await login(app, 'masha', NEW)).status, 200);
    assert.equal((await login(app, 'masha', PASSWORD)).status, 401);
    // Used up.
    assert.equal((await reset(app, code, 'another fine horse')).status, 400);
  });

  it('lasts a day, and a newer link for the account makes the older one stop working', async () => {
    const { app, clock, owner, id } = await setUp();
    const first = await link(app, owner, id('masha'));
    const second = await link(app, owner, id('masha'));
    assert.equal((await reset(app, first.code)).status, 400);
    clock.advance(24 * 60 * 60_000 + 1);
    assert.equal((await reset(app, second.code)).status, 400);
  });

  it('opens only the account it was made for', async () => {
    const { app, owner, id } = await setUp();
    const { code } = await link(app, owner, id('masha'));
    assert.equal((await reset(app, code)).status, 200);
    assert.equal((await login(app, 'petya', PASSWORD)).status, 200);
    assert.equal((await login(app, 'masha', NEW)).status, 200);
  });
});
