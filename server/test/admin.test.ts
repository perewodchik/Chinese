import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminOverview } from '../../shared/admin';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

async function setUp() {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), policy: { registration: 'invite' }, storageLimitMb: 300 });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['Kirill'] });
  const owner = await services.auth.invite('', null);
  const ownerCookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse', invite: owner.code } }));
  return { app, services, ownerCookie };
}

describe('the site’s own page, for whoever runs it', () => {
  it('makes an invitation from the phone, which then makes an account', async () => {
    const { app, ownerCookie } = await setUp();
    const made = await call(app, 'POST', '/api/admin/invites', { cookie: ownerCookie, body: { note: 'Masha', days: 7 } });
    assert.equal(made.status, 201);
    const { code } = (await made.json()) as { code: string };
    assert.equal((await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse', invite: code } })).status, 201);
    const overview = (await (await call(app, 'GET', '/api/admin/overview', { cookie: ownerCookie })).json()) as AdminOverview;
    assert.deepEqual(overview.accounts.map((a) => a.username).sort(), ['kirill', 'masha']);
    assert.equal(overview.registration, 'invite');
    assert.equal(overview.storageLimitBytes, 300 * 1024 * 1024);
    assert.equal(overview.invites[0]!.note, 'Masha');
    assert.equal(overview.invites[0]!.usedBy, 'masha');
    const masha = overview.accounts.find((a) => a.username === 'masha')!;
    assert.equal(masha.devices, 1);
    assert.ok(!JSON.stringify(overview).includes(code.replace(/-/g, '')), 'no code is ever shown again');
  });

  it('is refused to every other account, and to nobody signed in', async () => {
    const { app, services } = await setUp();
    const { code } = await services.auth.invite('', null);
    const guest = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse', invite: code } }));
    assert.equal((await call(app, 'GET', '/api/admin', { cookie: guest })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: guest })).status, 403);
    assert.equal((await call(app, 'POST', '/api/admin/invites', { cookie: guest, body: { note: '', days: 7 } })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin')).status, 401);
  });
});
