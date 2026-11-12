import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CurrentSessionResponse, MadeAccessTokenResponse } from '../../shared/api';
import { SERVER_COMMAND } from '../src/application/auth-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, HOST, sessionCookie, TestClock, type TestApp } from './support';

const PASSWORD = 'correct horse';

/** One database, and a server on it that can be started again with other settings, as a redeploy does. */
function site() {
  const db = openDatabase(':memory:');
  const clock = new TestClock();
  const services = createServices(sqliteStores(db), { hasher: cheapHasher, clock });
  const serve = (adminUsers: string[] = []) => createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers });
  return { services, serve };
}

async function signUp(app: TestApp, username: string, extra: Record<string, unknown> = {}) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username, password: PASSWORD, ...extra } });
  assert.equal(res.status, 201);
  return sessionCookie(res);
}

async function roleOf(app: TestApp, cookie: string) {
  return ((await (await call(app, 'GET', '/api/auth/session', { cookie })).json()) as CurrentSessionResponse).user?.role;
}

describe('who runs the site, from the database', () => {
  it('gives the role to the names in HANZI_ADMIN_USERS once, and keeps it once the setting is gone', async () => {
    const { serve } = site();
    const first = serve(['Kirill']);
    const owner = await signUp(first, 'kirill');
    assert.equal(await roleOf(first, owner), 'admin', 'given on the request after the account appeared');
    assert.equal((await call(first, 'GET', '/api/admin/overview', { cookie: owner })).status, 200);

    // Redeployed without HANZI_ADMIN_USERS: still the one who runs the site.
    const later = serve([]);
    assert.equal(await roleOf(later, owner), 'admin');
    assert.equal((await call(later, 'GET', '/api/admin/overview', { cookie: owner })).status, 200);

    // A name put in the setting once there is an admin gives nobody anything.
    const learner = await signUp(later, 'masha');
    const again = serve(['masha']);
    await call(again, 'GET', '/api/health');
    assert.equal(await roleOf(again, learner), 'learner');
  });

  it('refuses a learner on every admin route there is, so a new one without the check fails here', async () => {
    const { serve } = site();
    const app = serve(['kirill']);
    await signUp(app, 'kirill');
    const learner = await signUp(app, 'masha');
    const routes = app.routes.filter((r) => r.path.startsWith('/api/admin') && r.method !== 'ALL');
    assert.ok(routes.length >= 3, `found ${routes.length} admin routes`);
    for (const r of routes) {
      const path = r.path.replace(/:[^/]+/g, 'x');
      const body = ['GET', 'HEAD', 'DELETE'].includes(r.method) ? undefined : {};
      const res = await call(app, r.method, path, { cookie: learner, body });
      assert.equal(res.status, 403, `${r.method} ${r.path} answered ${res.status} to a learner`);
      assert.equal((await call(app, r.method, path, { body })).status, 401, `${r.method} ${r.path} signed out`);
    }
  });

  it('believes nothing a request says about its own role', async () => {
    const { serve } = site();
    const app = serve(['kirill']);
    await signUp(app, 'kirill');
    const cookie = await signUp(app, 'masha', { role: 'admin' });
    assert.equal(await roleOf(app, cookie), 'learner');
    const res = await call(app, 'GET', '/api/admin/overview', { cookie, headers: { 'x-role': 'admin', role: 'admin' } });
    assert.equal(res.status, 403);
    const invite = await call(app, 'POST', '/api/admin/invites', { cookie, body: { note: '', days: 7, role: 'admin' } });
    assert.equal(invite.status, 403);
  });

  it('never leaves the site with nobody to run it', async () => {
    const { serve, services } = site();
    const app = serve(['kirill']);
    const owner = await signUp(app, 'kirill');
    assert.equal(await roleOf(app, owner), 'admin');
    await assert.rejects(services.auth.setRole('kirill', 'learner', SERVER_COMMAND), /last account that runs the site/);
    await assert.rejects(services.auth.setStatus('kirill', 'blocked', SERVER_COMMAND), /last account that runs the site/);

    await signUp(app, 'masha');
    await services.auth.setRole('masha', 'admin', SERVER_COMMAND);
    await assert.rejects(services.auth.setStatus('masha', 'blocked', { ...SERVER_COMMAND, id: (await services.auth.listUsers()).find((u) => u.username === 'masha')!.id }), /cannot pause itself/);
    assert.equal((await services.auth.setRole('kirill', 'learner', SERVER_COMMAND)).role, 'learner');
    assert.equal(await roleOf(app, owner), 'learner', 'read afresh on the next request');
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: owner })).status, 403);
  });
});

describe('a paused account', () => {
  it('opens nothing with a live cookie or a token, and says it is paused only to the right password', async () => {
    const { serve, services } = site();
    const app = serve(['kirill']);
    await signUp(app, 'kirill');
    const cookie = await signUp(app, 'masha');
    const made = (await (await call(app, 'POST', '/api/account/tokens', { cookie, body: { name: 'script', days: 30 } })).json()) as MadeAccessTokenResponse;

    await services.auth.setStatus('masha', 'blocked', SERVER_COMMAND);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie })).status, 401);
    assert.equal(((await (await call(app, 'GET', '/api/auth/session', { cookie })).json()) as CurrentSessionResponse).user, null);
    const byToken = await app.request(`http://${HOST}/api/workspace`, { headers: { host: HOST, authorization: `Bearer ${made.token}` } });
    assert.equal(byToken.status, 401);

    const wrong = await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: 'not it at all' } });
    assert.equal(wrong.status, 401, 'a guesser learns nothing');
    const right = await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: PASSWORD } });
    assert.equal(right.status, 403);
    assert.equal(((await right.json()) as { error: { code: string } }).error.code, 'account_blocked');
    assert.equal(right.headers.get('set-cookie'), null, 'and no session comes with it');

    await services.auth.setStatus('masha', 'active', SERVER_COMMAND);
    assert.equal((await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: PASSWORD } })).status, 200);
    const stillRevoked = await app.request(`http://${HOST}/api/workspace`, { headers: { host: HOST, authorization: `Bearer ${made.token}` } });
    assert.equal(stillRevoked.status, 401, 'opening it again does not bring its tokens back');
  });
});
