import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminLogPage, AdminOverview } from '../../shared/admin';
import type { MadeAccessTokenResponse } from '../../shared/api';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, HOST, sessionCookie, TestClock, type TestApp } from './support';

const PASSWORD = 'correct horse';

async function setUp() {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock() });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: PASSWORD } }));
  const owner = await signUp('kirill');
  const learner = await signUp('masha');
  const overview = async () => (await (await call(app, 'GET', '/api/admin/overview', { cookie: owner })).json()) as AdminOverview;
  const idOf = async (name: string) => (await overview()).accounts.find((a) => a.username === name)!.id;
  return { app, services, owner, learner, overview, idOf };
}

const login = (app: TestApp, username: string) => call(app, 'POST', '/api/auth/login', { body: { username, password: PASSWORD } });
const byToken = (app: TestApp, token: string) => app.request(`http://${HOST}/api/workspace`, { headers: { host: HOST, authorization: `Bearer ${token}` } });

describe('pausing an account from the site’s page', () => {
  it('pauses with a reason: signed out everywhere, tokens stopped, the reason in the log', async () => {
    const { app, owner, learner, overview, idOf } = await setUp();
    const { token } = (await (await call(app, 'POST', '/api/account/tokens', { cookie: learner, body: { name: 'script', days: 30 } })).json()) as MadeAccessTokenResponse;
    const id = await idOf('masha');

    const res = await call(app, 'POST', `/api/admin/accounts/${id}/block`, { cookie: owner, body: { reason: 'Shared the account with a class' } });
    assert.equal(res.status, 204);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: learner })).status, 401);
    assert.equal((await byToken(app, token)).status, 401);
    assert.equal((await login(app, 'masha')).status, 403);
    assert.equal((await overview()).accounts.find((a) => a.id === id)?.status, 'blocked');

    const log = (await (await call(app, 'GET', '/api/admin/log?action=blocked', { cookie: owner })).json()) as AdminLogPage;
    assert.deepEqual(log.entries.map((e) => [e.actor, e.target, e.details]), [['kirill', 'masha', { reason: 'Shared the account with a class' }]]);

    assert.equal((await call(app, 'POST', `/api/admin/accounts/${id}/unblock`, { cookie: owner })).status, 204);
    assert.equal((await login(app, 'masha')).status, 200);
    assert.equal((await overview()).accounts.find((a) => a.id === id)?.status, 'active');
  });

  it('asks why, and will not pause the admin asking or an account that is not there', async () => {
    const { app, owner, idOf } = await setUp();
    const id = await idOf('masha');
    const blank = await call(app, 'POST', `/api/admin/accounts/${id}/block`, { cookie: owner, body: { reason: '   ' } });
    assert.equal(blank.status, 400);
    assert.equal((await call(app, 'POST', `/api/admin/accounts/${id}/block`, { cookie: owner, body: {} })).status, 400);
    const self = await call(app, 'POST', `/api/admin/accounts/${await idOf('kirill')}/block`, { cookie: owner, body: { reason: 'a slip' } });
    assert.equal(self.status, 400);
    assert.match(((await self.json()) as { error: { message: string } }).error.message, /cannot pause itself/);
    assert.equal((await call(app, 'POST', '/api/admin/accounts/nobody/block', { cookie: owner, body: { reason: 'x' } })).status, 404);
    assert.equal((await call(app, 'POST', '/api/admin/accounts/nobody/unblock', { cookie: owner })).status, 404);
  });

  it('signs an account out everywhere, with its tokens, and lets it sign in again', async () => {
    const { app, owner, learner, idOf } = await setUp();
    const second = sessionCookie(await login(app, 'masha'));
    const { token } = (await (await call(app, 'POST', '/api/account/tokens', { cookie: learner, body: { name: 'script', days: 30 } })).json()) as MadeAccessTokenResponse;

    const res = await call(app, 'POST', `/api/admin/accounts/${await idOf('masha')}/sign-out`, { cookie: owner });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { sessions: 2, tokens: 1 });
    for (const cookie of [learner, second]) assert.equal((await call(app, 'GET', '/api/workspace', { cookie })).status, 401);
    assert.equal((await byToken(app, token)).status, 401);
    assert.equal((await login(app, 'masha')).status, 200, 'not paused, only signed out');

    const self = await call(app, 'POST', `/api/admin/accounts/${await idOf('kirill')}/sign-out`, { cookie: owner });
    assert.equal(self.status, 400);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: owner })).status, 200);
  });

  it('is not for a learner, even on their own account', async () => {
    const { app, learner, idOf } = await setUp();
    const own = await idOf('masha');
    const admin = await idOf('kirill');
    for (const path of [`/api/admin/accounts/${admin}/block`, `/api/admin/accounts/${own}/unblock`, `/api/admin/accounts/${admin}/sign-out`]) {
      assert.equal((await call(app, 'POST', path, { cookie: learner, body: { reason: 'x' } })).status, 403, path);
    }
  });
});
