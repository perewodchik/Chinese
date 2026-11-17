import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SiteUsage } from '../../shared/usage';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

describe('the site’s use of the services (A10)', () => {
  it('sums today and the month a service, names who used most, and is only for an admin', async () => {
    const clock = new TestClock();
    const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
    const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
    const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
    const owner = await signUp('kirill');
    const learner = await signUp('masha');
    const ids = new Map((await services.auth.accounts()).map((a) => [a.username, a.id]));
    await services.usage.record(ids.get('masha')!, 'minimax', 300);
    await services.usage.record(ids.get('masha')!, 'minimax', 200);
    await services.usage.record(ids.get('kirill')!, 'speechsuper', 4);
    clock.advance(86_400_000);
    await services.usage.record(ids.get('masha')!, 'minimax', 50);

    const body = (await (await call(app, 'GET', '/api/admin/costs', { cookie: owner })).json()) as SiteUsage;
    const minimax = body.lines.find((l) => l.service === 'minimax')!;
    assert.deepEqual([minimax.today, minimax.month], [{ calls: 1, units: 50 }, { calls: 3, units: 550 }]);
    assert.deepEqual(body.top[0], { username: 'masha', service: 'minimax', calls: 3, units: 550 });
    assert.equal((await call(app, 'GET', '/api/admin/costs', { cookie: learner })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/costs')).status, 401);
  });
});
