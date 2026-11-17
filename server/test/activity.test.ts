import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Dashboard } from '../../shared/activity';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const DAY = 86_400_000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
  const report = (cookie: string, body: object) => call(app, 'POST', '/api/activity', { cookie, body: { minutes: 0, textsRead: 0, answers: 0, spoken: 0, videos: 0, ...body } });
  const dashboard = async (cookie: string) => (await (await call(app, 'GET', '/api/admin/dashboard', { cookie })).json()) as Dashboard;
  return { app, clock, services, signUp, report, dashboard };
}

describe('the site in numbers (A7)', () => {
  it('keeps a day’s counts, only ever growing, and only for today', async () => {
    const { clock, services, signUp, report } = await setUp();
    const masha = await signUp('masha');
    const today = dayOf(clock.now());
    assert.equal((await report(masha, { day: today, minutes: 12, answers: 30 })).status, 204);
    assert.equal((await report(masha, { day: today, minutes: 5, answers: 40 })).status, 204);
    const rows = await services.activity['deps'].activity.since(today);
    assert.deepEqual([rows[0]!.minutes, rows[0]!.answers], [12, 40]);
    assert.equal((await report(masha, { day: '2020-01-01', minutes: 1 })).status, 400);
    assert.equal((await report(masha, { day: today, minutes: 1, note: 'x' })).status, 400);
    assert.equal((await call((await setUp()).app, 'POST', '/api/activity', { body: { day: today, minutes: 1, textsRead: 0, answers: 0, spoken: 0, videos: 0 } })).status, 401);
  });

  it('says who was here, who came back, what they use, and how each week’s newcomers stayed', async () => {
    const { clock, signUp, report, dashboard, app } = await setUp();
    const owner = await signUp('kirill');
    const old = await signUp('masha');
    clock.advance(10 * DAY);
    const fresh = await signUp('petya');
    await report(old, { day: dayOf(clock.now()), textsRead: 2, minutes: 20 });
    await report(fresh, { day: dayOf(clock.now()), answers: 15 });
    const d = await dashboard(owner);
    assert.deepEqual(d.active, { day: 2, week: 2, month: 2 });
    assert.deepEqual(d.joined, { week: 1, month: 3 });
    assert.equal(d.returned, 1);
    assert.deepEqual(d.uses, { reading: 1, cards: 1, speaking: 0, videos: 0 });
    assert.equal(d.cohorts.length, 6);
    assert.equal(d.cohorts[1]!.joined, 2);
    assert.equal(d.cohorts[1]!.week1, 1);
    assert.equal(d.cohorts[0]!.week1, null, 'a week not over yet is not counted');
    assert.equal((await call(app, 'GET', '/api/admin/dashboard', { cookie: old })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/dashboard')).status, 401);
  });
});
