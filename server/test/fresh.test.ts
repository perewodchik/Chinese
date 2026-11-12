import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminOverview } from '../../shared/admin';
import type { CurrentSessionResponse } from '../../shared/api';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock, type TestApp } from './support';

const PASSWORD = 'correct horse';
const MINUTE = 60_000;
const DAY = 86_400_000;

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: PASSWORD } }));
  const learner = await signUp('masha');
  const owner = await signUp('kirill');
  // The role is given on the request after the account appears; a fresh sign-in then carries it.
  await call(app, 'GET', '/api/health');
  const id = ((await (await call(app, 'GET', '/api/admin/overview', { cookie: owner })).json()) as AdminOverview).accounts.find((a) => a.username === 'masha')!.id;
  return { app, clock, owner, learner, id };
}

const invite = (app: TestApp, cookie: string) => call(app, 'POST', '/api/admin/invites', { cookie, body: { note: '', days: 7 } });
const reauth = (app: TestApp, cookie: string, password = PASSWORD) => call(app, 'POST', '/api/auth/reauth', { cookie, body: { password } });
const signedIn = async (app: TestApp, cookie: string) => ((await (await call(app, 'GET', '/api/auth/session', { cookie })).json()) as CurrentSessionResponse).user !== null;

describe('an admin’s action asks for the password again', () => {
  it('changes things for a quarter of an hour after the password, then asks, then goes on', async () => {
    const { app, clock, owner, id } = await setUp();
    assert.equal((await invite(app, owner)).status, 201);
    clock.advance(16 * MINUTE);

    const asked = await invite(app, owner);
    assert.equal(asked.status, 403);
    assert.equal(((await asked.json()) as { error: { code: string } }).error.code, 'reauth_required');
    for (const path of [`/api/admin/accounts/${id}/block`, `/api/admin/accounts/${id}/unblock`, `/api/admin/accounts/${id}/sign-out`]) {
      const res = await call(app, 'POST', path, { cookie: owner, body: { reason: 'x' } });
      assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'reauth_required', path);
    }
    // Reading is not asked for it.
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: owner })).status, 200);
    assert.equal((await call(app, 'GET', '/api/admin/log', { cookie: owner })).status, 200);

    const wrong = await reauth(app, owner, 'not the password');
    assert.equal(wrong.status, 400);
    assert.equal((await invite(app, owner)).status, 403, 'a wrong password changes nothing');

    assert.equal((await reauth(app, owner)).status, 204);
    assert.equal((await invite(app, owner)).status, 201);
  });

  it('counts wrong passwords, so a stolen cookie is no way to guess one', async () => {
    const { app, owner } = await setUp();
    for (let i = 0; i < 10; i++) assert.equal((await reauth(app, owner, `guess ${i}`)).status, 400);
    assert.equal((await reauth(app, owner)).status, 429);
  });

  it('is not for a token, or for nobody', async () => {
    const { app } = await setUp();
    assert.equal((await call(app, 'POST', '/api/auth/reauth', { body: { password: PASSWORD } })).status, 401);
  });
});

describe('how long a session lives', () => {
  it('keeps an admin signed in for as long as the site is used, as anyone', async () => {
    const { app, clock, owner, learner } = await setUp();
    // Used every twenty days for a year: the thirty-day expiry keeps moving on.
    for (let day = 0; day < 365; day += 20) {
      clock.advance(20 * DAY);
      assert.ok(await signedIn(app, owner), `admin, day ${day + 20}`);
      assert.ok(await signedIn(app, learner), `learner, day ${day + 20}`);
    }
  });

  it('ends a session left unused for thirty days', async () => {
    const { app, clock, owner } = await setUp();
    clock.advance(31 * DAY);
    assert.equal(await signedIn(app, owner), false);
  });
});
