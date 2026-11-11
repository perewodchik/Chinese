import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminLogPage } from '../../shared/admin';
import { SERVER_COMMAND } from '../src/application/auth-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock, type TestApp } from './support';

async function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
  const owner = await signUp('kirill');
  return { app, clock, services, owner, signUp };
}

async function page(app: TestApp, cookie: string, query = '') {
  const res = await call(app, 'GET', `/api/admin/log${query}`, { cookie });
  assert.equal(res.status, 200);
  return (await res.json()) as AdminLogPage;
}

describe('the admins’ log', () => {
  it('says who gave the first admin the role, and who made an invitation on the site', async () => {
    const { app, owner } = await setUp();
    // The role was given on the request after kirill's account appeared.
    await call(app, 'GET', '/api/health');
    const made = await call(app, 'POST', '/api/admin/invites', { cookie: owner, body: { note: 'Masha', days: 7 } });
    assert.equal(made.status, 201);

    const { entries, next } = await page(app, owner);
    assert.equal(next, null);
    assert.deepEqual(
      entries.map((e) => [e.actor, e.action, e.target, e.details]),
      [
        ['kirill', 'invite-made', null, { note: 'Masha', days: 7 }],
        ['HANZI_ADMIN_USERS', 'role-granted', 'kirill', {}],
      ],
    );
    assert.ok(!JSON.stringify(entries).includes('127.0.0.1') && !('ip' in entries[0]!), 'not the address');
  });

  it('keeps what the server commands did, and names the account after it is gone', async () => {
    const { app, services, owner, signUp } = await setUp();
    await signUp('masha');
    await services.auth.setRole('masha', 'admin', SERVER_COMMAND);
    await services.auth.setStatus('masha', 'blocked', { id: null, name: 'kirill', ip: null });
    await services.auth.setStatus('masha', 'blocked', SERVER_COMMAND); // already paused: nothing to say
    await services.auth.setStatus('masha', 'active', SERVER_COMMAND);
    await services.auth.resetPassword('masha', 'a new horse battery', SERVER_COMMAND);
    await services.auth.addUser('lin', 'a fine password', SERVER_COMMAND);

    const masha = (await services.auth.listUsers()).find((u) => u.username === 'masha')!;
    await services.auth.deleteAccount({ userId: masha.id, password: 'a new horse battery' });

    const { entries } = await page(app, owner);
    assert.deepEqual(
      entries.slice(0, 6).map((e) => [e.actor, e.action, e.target]),
      [
        ['a command on the server', 'account-made', 'lin'],
        ['a command on the server', 'password-reset', 'masha'],
        ['a command on the server', 'unblocked', 'masha'],
        ['kirill', 'blocked', 'masha'],
        ['a command on the server', 'role-granted', 'masha'],
        ['HANZI_ADMIN_USERS', 'role-granted', 'kirill'],
      ],
    );
  });

  it('finds by what was done and by whom or to whom, fifty at a time', async () => {
    const { app, clock, owner } = await setUp();
    for (let i = 0; i < 55; i++) {
      if (i === 40) clock.advance(61 * 60_000); // past the hour's fifty invitations
      assert.equal((await call(app, 'POST', '/api/admin/invites', { cookie: owner, body: { note: `n${i}`, days: 7 } })).status, 201);
    }
    const first = await page(app, owner, '?action=invite-made');
    assert.equal(first.entries.length, 50);
    assert.equal(first.entries[0]!.details.note, 'n54');
    assert.ok(first.next);
    const second = await page(app, owner, `?action=invite-made&before=${first.next}`);
    assert.deepEqual(second.entries.map((e) => e.details.note), ['n4', 'n3', 'n2', 'n1', 'n0']);
    assert.equal(second.next, null);

    const byName = await page(app, owner, '?name=KIRILL&action=role-granted');
    assert.deepEqual(byName.entries.map((e) => [e.actor, e.target]), [['HANZI_ADMIN_USERS', 'kirill']], 'the target, any case');
    assert.equal((await page(app, owner, '?name=nobody')).entries.length, 0);
    // A query it cannot read is the whole log, not an error.
    assert.equal((await page(app, owner, '?before=soon')).entries.length, 50);
  });

  it('is for the accounts that run the site', async () => {
    const { app, signUp } = await setUp();
    const learner = await signUp('masha');
    assert.equal((await call(app, 'GET', '/api/admin/log', { cookie: learner })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/log')).status, 401);
  });
});
