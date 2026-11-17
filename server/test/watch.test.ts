import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminOverview } from '../../shared/admin';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, HOST, sessionCookie, TestClock } from './support';

const PASSWORD = 'correct horse';

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const owner = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: PASSWORD } }));
  const learner = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: PASSWORD } }));
  const overview = async () => (await (await call(app, 'GET', '/api/admin/overview', { cookie: owner })).json()) as AdminOverview;
  const settle = () => new Promise((r) => setTimeout(r, 20));
  return { app, clock, services, owner, learner, overview, settle };
}

const signInFrom = (app: Awaited<ReturnType<typeof setUp>>['app'], username: string, password: string, agent: string) =>
  app.request(`http://${HOST}/api/auth/login`, { method: 'POST', headers: { host: HOST, origin: `http://${HOST}`, 'content-type': 'application/json', 'user-agent': agent }, body: JSON.stringify({ username, password }) });

describe('what the admin page says is worth a look (SEC15)', () => {
  it('counts the day’s refused sign-ins, and names an admin signed in from a new browser', async () => {
    const { app, overview, settle } = await setUp();
    await signInFrom(app, 'masha', 'wrong horse', 'Safari');
    await signInFrom(app, 'masha', 'wrong horse', 'Safari');
    await signInFrom(app, 'kirill', PASSWORD, 'Mozilla/5.0 (iPad) Safari');
    await signInFrom(app, 'kirill', PASSWORD, 'Mozilla/5.0 (iPad) Safari');
    await settle();
    let w = (await overview()).watch;
    assert.equal(w.refusedToday, 2);
    // The first browser on record is where the account began.
    assert.deepEqual(w.newAdminDevices, []);
    await signInFrom(app, 'kirill', PASSWORD, 'Mozilla/5.0 (Windows) Chrome');
    await settle();
    w = (await overview()).watch;
    assert.deepEqual(w.newAdminDevices.map((d) => [d.username, d.userAgent]), [['kirill', 'Mozilla/5.0 (Windows) Chrome']]);
  });

  it('writes a copy taken and a limit reached in the accounts’ log, the limit once', async () => {
    const { app, learner, overview, settle } = await setUp();
    await call(app, 'GET', '/api/account/export', { cookie: learner });
    for (let i = 0; i < 13; i++) await call(app, 'POST', '/api/feedback', { cookie: learner, body: { kind: 'good', message: `n${i}`, page: '/' } });
    await settle();
    const o = await overview();
    const events = o.events.map((e) => [e.kind, e.username]);
    assert.ok(events.some(([k, u]) => k === 'exported' && u === 'masha'));
    // Three refusals, one line: once in ten minutes for the same address and name.
    assert.equal(events.filter(([k, u]) => k === 'rate-limited' && u === 'masha').length, 1);
    assert.equal(o.watch.limitedToday, 1);
  });
});
