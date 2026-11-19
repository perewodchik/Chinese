import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminOverview } from '../../shared/admin';
import { SERVER_COMMAND } from '../src/application/auth-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

async function setUp() {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), policy: { registration: 'invite' }, storageLimitMb: 300 });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['Kirill'] });
  const owner = await services.auth.invite('', null, SERVER_COMMAND);
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
    await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: 'wrong horse' } });
    await new Promise((r) => setTimeout(r, 20));
    const later = (await (await call(app, 'GET', '/api/admin/overview', { cookie: ownerCookie })).json()) as AdminOverview;
    assert.deepEqual(later.events.slice(0, 4).map((e) => [e.kind, e.username]), [
      ['sign-in-refused', 'masha'],
      ['sign-up', 'masha'],
      ['invite', 'kirill'],
      ['sign-up', 'kirill'],
    ]);
    assert.ok(!JSON.stringify(later.events).includes('ip'), 'the address stays on the server');
  });

  it('is refused to every other account, and to nobody signed in', async () => {
    const { app, services } = await setUp();
    const { code } = await services.auth.invite('', null, SERVER_COMMAND);
    const guest = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse', invite: code } }));
    assert.equal((await call(app, 'GET', '/api/admin', { cookie: guest })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: guest })).status, 403);
    assert.equal((await call(app, 'POST', '/api/admin/invites', { cookie: guest, body: { note: '', days: 7 } })).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin')).status, 401);
  });
});

describe('taking an invitation back (A8)', () => {
  it('stops the code making an account, says who made it, and is in the log; only an admin may, and only once', async () => {
    const { app, services, ownerCookie } = await setUp();
    const made = (await (await call(app, 'POST', '/api/admin/invites', { cookie: ownerCookie, body: { note: 'Petya', days: 7 } })).json()) as { code: string };
    const overview = async () => (await (await call(app, 'GET', '/api/admin/overview', { cookie: ownerCookie })).json()) as AdminOverview;
    const invite = (await overview()).invites.find((i) => i.note === 'Petya')!;
    assert.equal(invite.createdBy, 'kirill');
    assert.equal(invite.revokedAt, null);

    const { code } = await services.auth.invite('', null, SERVER_COMMAND);
    const guest = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse', invite: code } }));
    assert.equal((await call(app, 'POST', `/api/admin/invites/${invite.id}/revoke`)).status, 401);
    assert.equal((await call(app, 'POST', `/api/admin/invites/${invite.id}/revoke`, { cookie: guest })).status, 403);

    assert.equal((await call(app, 'POST', `/api/admin/invites/${invite.id}/revoke`, { cookie: ownerCookie })).status, 204);
    assert.ok((await overview()).invites.find((i) => i.id === invite.id)!.revokedAt);
    assert.equal((await call(app, 'POST', '/api/auth/register', { body: { username: 'petya', password: 'correct horse', invite: made.code } })).status, 400);
    assert.equal((await call(app, 'POST', `/api/admin/invites/${invite.id}/revoke`, { cookie: ownerCookie })).status, 400);
    assert.equal((await call(app, 'POST', '/api/admin/invites/nothing/revoke', { cookie: ownerCookie })).status, 404);

    // One already used cannot be taken back.
    const used = (await overview()).invites.find((i) => i.usedBy === 'masha')!;
    assert.equal((await call(app, 'POST', `/api/admin/invites/${used.id}/revoke`, { cookie: ownerCookie })).status, 400);
    const log = await (await call(app, 'GET', '/api/admin/log?action=invite-revoked', { cookie: ownerCookie })).json() as { entries: Array<{ actor: string; details: unknown }> };
    assert.deepEqual(log.entries.map((e) => [e.actor, e.details]), [['kirill', { note: 'Petya' }]]);
  });
});

describe('an invitation for a group (A8)', () => {
  it('makes as many accounts as it was made for, names who came, and can be taken back with uses left', async () => {
    const { app, ownerCookie } = await setUp();
    const overview = async () => (await (await call(app, 'GET', '/api/admin/overview', { cookie: ownerCookie })).json()) as AdminOverview;
    assert.equal((await call(app, 'POST', '/api/admin/invites', { cookie: ownerCookie, body: { note: 'Class', days: 7, uses: 101 } })).status, 400);
    const made = (await (await call(app, 'POST', '/api/admin/invites', { cookie: ownerCookie, body: { note: 'Class', days: 7, uses: 3 } })).json()) as { code: string; uses: number };
    assert.equal(made.uses, 3);
    const join = (name: string) => call(app, 'POST', '/api/auth/register', { body: { username: name, password: 'correct horse', invite: made.code } });
    assert.equal((await join('masha')).status, 201);
    assert.equal((await join('petya')).status, 201);
    let group = (await overview()).invites.find((i) => i.note === 'Class')!;
    assert.deepEqual([group.uses, group.maxUses, group.people.map((p) => p.username)], [2, 3, ['masha', 'petya']]);

    // Taken back with a use left: the third cannot come, the two who did stay.
    assert.equal((await call(app, 'POST', `/api/admin/invites/${group.id}/revoke`, { cookie: ownerCookie })).status, 204);
    assert.equal((await join('vasya')).status, 400);
    group = (await overview()).invites.find((i) => i.note === 'Class')!;
    assert.deepEqual([group.uses, group.people.length, Boolean(group.revokedAt)], [2, 2, true]);
    const card = (await (await call(app, 'GET', `/api/admin/accounts/${(await overview()).accounts.find((a) => a.username === 'petya')!.id}`, { cookie: ownerCookie })).json()) as { invite: { note: string } | null };
    assert.equal(card.invite?.note, 'Class');
    const log = (await (await call(app, 'GET', '/api/admin/log?action=invite-made', { cookie: ownerCookie })).json()) as { entries: Array<{ details: { uses?: number } }> };
    assert.equal(log.entries[0]!.details.uses, 3);
  });

  it('gives its last use to one sign-up only', async () => {
    const { app, ownerCookie } = await setUp();
    const made = (await (await call(app, 'POST', '/api/admin/invites', { cookie: ownerCookie, body: { note: 'Two', days: 7, uses: 2 } })).json()) as { code: string };
    const tries = await Promise.all(['a1', 'a2', 'a3'].map((n) => call(app, 'POST', '/api/auth/register', { body: { username: `user${n}`, password: 'correct horse', invite: made.code } })));
    assert.deepEqual(tries.map((r) => r.status).sort(), [201, 201, 400]);
  });
});
