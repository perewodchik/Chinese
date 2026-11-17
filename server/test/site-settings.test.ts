import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminLogPage } from '../../shared/admin';
import type { SiteInfo, SiteSettingsView } from '../../shared/site';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock, storageLimitMb: 300 });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } });
  const owner = sessionCookie(await signUp('kirill'));
  const learner = sessionCookie(await signUp('masha'));
  const put = (body: object, cookie = owner) => call(app, 'PUT', '/api/admin/settings', { cookie, body });
  return { app, clock, services, owner, learner, signUp, put };
}

describe('the site’s own settings (A11)', () => {
  it('starts from the environment, and an admin’s change wins at once, in the log', async () => {
    const { app, owner, signUp, put } = await setUp();
    const first = (await (await call(app, 'GET', '/api/admin/settings', { cookie: owner })).json()) as SiteSettingsView;
    assert.deepEqual(first.settings, { registration: 'open', storageLimitMb: 300, announcement: '' });
    const changed = (await (await put({ registration: 'closed', storageLimitMb: 500, announcement: '  Works tonight,\\n back by ten. ' })).json()) as SiteSettingsView;
    assert.deepEqual(changed.settings, { registration: 'closed', storageLimitMb: 500, announcement: 'Works tonight,\\n back by ten.'.replace(/\\s+/g, ' ') });
    assert.equal(changed.changed.registration?.by, 'kirill');
    assert.equal((await signUp('petya')).status, 403);
    assert.deepEqual(await (await call(app, 'GET', '/api/auth/options')).json(), { registration: 'closed' });
    const log = (await (await call(app, 'GET', '/api/admin/log?action=setting-changed', { cookie: owner })).json()) as AdminLogPage;
    assert.equal(log.entries.length, 3);
  });

  it('shows the announcement to anyone signed in, and nobody else', async () => {
    const { app, learner, put } = await setUp();
    await put({ announcement: 'New texts on Friday' });
    assert.deepEqual((await (await call(app, 'GET', '/api/site', { cookie: learner })).json()) as SiteInfo, { announcement: 'New texts on Friday' });
    assert.equal((await call(app, 'GET', '/api/site')).status, 401);
  });

  it('applies the room it sets to every account', async () => {
    const { services, put } = await setUp();
    await put({ storageLimitMb: null });
    assert.equal(await services.storage.limitBytes(), null);
    await put({ storageLimitMb: 50 });
    assert.equal(await services.storage.limitBytes(), 50 * 1024 * 1024);
  });

  it('refuses what is not a setting, and anyone but an admin', async () => {
    const { app, learner, put } = await setUp();
    assert.equal((await put({ storageLimitMb: 3 })).status, 400);
    assert.equal((await put({ registration: 'everyone' })).status, 400);
    assert.equal((await put({ announcement: 'x'.repeat(201) })).status, 400);
    assert.equal((await put({ other: 1 })).status, 400);
    assert.equal((await put({ registration: 'closed' }, learner)).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/settings', { cookie: learner })).status, 403);
    assert.equal((await call(app, 'PUT', '/api/admin/settings', { body: { registration: 'closed' } })).status, 401);
  });
});
