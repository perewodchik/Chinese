import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminAccountPage, AdminOverview } from '../../shared/admin';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => {
    clock.advance(60_000);
    return sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
  };
  const owner = await signUp('kirill');
  const masha = await signUp('masha');
  await signUp('petya');
  await signUp('mark');
  return { app, clock, services, owner, masha };
}

const page = async (app: Awaited<ReturnType<typeof setUp>>['app'], cookie: string, q = '') =>
  (await (await call(app, 'GET', `/api/admin/accounts${q}`, { cookie })).json()) as AdminAccountPage;

describe('the accounts on the admin page, in one query (A4, SEC14)', () => {
  it('gives each account its browsers, room and month the way the account page counts them', async () => {
    const { app, services, owner, masha } = await setUp();
    await call(app, 'PUT', '/api/workspace', { cookie: masha, body: { baseRevision: 0, document: { version: 11, note: 'x'.repeat(5000) } } });
    const mashaId = (await services.auth.accounts()).find((a) => a.username === 'masha')!.id;
    await services.usage.record(mashaId, 'minimax', 120);
    await services.usage.record(mashaId, 'speechsuper', 3);
    const row = (await page(app, owner, '?q=mash')).accounts[0]!;
    assert.equal(row.username, 'masha');
    assert.equal(row.devices, 1);
    assert.equal(row.storageBytes, (await services.storage.use(mashaId)).usedBytes);
    assert.ok(row.storageBytes > 5000);
    assert.deepEqual([row.scoredThisMonth, row.charactersReadThisMonth], [1, 120]);
  });

  it('searches by name, sorts, and pages', async () => {
    const { app, owner } = await setUp();
    assert.deepEqual((await page(app, owner, '?q=ma')).accounts.map((a) => a.username).sort(), ['mark', 'masha']);
    assert.deepEqual((await page(app, owner, '?q=%25')).accounts, []);
    assert.deepEqual((await page(app, owner, '?sort=joined')).accounts.map((a) => a.username), ['mark', 'petya', 'masha', 'kirill']);
    const all = await page(app, owner);
    assert.deepEqual([all.total, all.page, all.pages], [4, 0, 1]);
    assert.deepEqual((await page(app, owner, '?page=1')).accounts, []);
    const overview = (await (await call(app, 'GET', '/api/admin/overview', { cookie: owner })).json()) as AdminOverview;
    assert.equal(overview.accountsTotal, 4);
  });

  it('is only for an admin', async () => {
    const { app, masha } = await setUp();
    assert.equal((await call(app, 'GET', '/api/admin/accounts', { cookie: masha })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/accounts')).status, 401);
  });
});
