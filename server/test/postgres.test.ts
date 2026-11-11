import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type pg from 'pg';
import { postgresStores } from '../src/infrastructure/postgres/stores';
import type { Stores } from '../src/composition';
import { makePostgres } from './pglite';

/**
 * The Postgres side of the storage, against a real Postgres.
 *
 * Everything above this line is shared with the SQLite server and already
 * covered; what is only exercised here is the SQL itself — the dialect, the
 * unique constraint, the compare-and-swap that decides who wins a save. It is
 * the code that runs on Vercel and nowhere else, so it is the code that would
 * otherwise first be tried in production.
 */

const T = Date.UTC(2026, 8, 11, 9);
const user = (id: string, key = id) => ({
  id,
  username: key.toUpperCase(),
  usernameKey: key,
  passwordHash: `hash-of-${id}`,
  createdAt: T,
  updatedAt: T,
  role: 'learner' as const,
  status: 'active' as const,
  flags: {},
});

describe('Postgres storage', () => {
  let pool: pg.Pool;
  let close: () => Promise<void>;
  let stores: Stores;

  before(async () => {
    const made = await makePostgres();
    pool = made.pool;
    close = made.close;
    stores = postgresStores(pool);
  });

  after(async () => {
    await close();
  });

  it('keeps a user, and reads back the times as numbers', async () => {
    assert.equal(await stores.users.insert(user('u1', 'kirill')), true);
    const found = await stores.users.findByUsernameKey('kirill');
    assert.equal(found?.id, 'u1');
    assert.equal(found?.passwordHash, 'hash-of-u1');
    // A BIGINT arrives as a string unless it is asked to arrive as a number,
    // and a time that is a string compares wrongly against every deadline.
    assert.equal(typeof found?.createdAt, 'number');
    assert.equal(found?.createdAt, T);
  });

  it('refuses a second user with the same name, without throwing', async () => {
    assert.equal(await stores.users.insert(user('u2', 'kirill')), false);
    assert.equal(await stores.users.findById('u2'), null);
  });

  it('changes a password and lists in the order accounts were made', async () => {
    await stores.users.insert({ ...user('u3', 'other'), createdAt: T + 1 });
    await stores.users.updatePassword('u1', 'newer', T + 5);
    const again = await stores.users.findById('u1');
    assert.equal(again?.passwordHash, 'newer');
    assert.equal(again?.updatedAt, T + 5);
    assert.deepEqual((await stores.users.list()).map((u) => u.id), ['u1', 'u3']);
  });

  it('keeps a session, touches it, and forgets one', async () => {
    const s = { id: 's1', userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: 'iPad', verifiedAt: T };
    await stores.sessions.insert(s);
    assert.equal((await stores.sessions.findById('s1'))?.userAgent, 'iPad');
    await stores.sessions.touch('s1', T + 10, T + 2000);
    assert.equal((await stores.sessions.findById('s1'))?.expiresAt, T + 2000);
    await stores.sessions.delete('s1');
    assert.equal(await stores.sessions.findById('s1'), null);
  });

  it('signs every other browser out, and sweeps what has expired', async () => {
    for (const id of ['a', 'b', 'c']) {
      await stores.sessions.insert({
        id, userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null, verifiedAt: T,
      });
    }
    await stores.sessions.insert({
      id: 'other', userId: 'u3', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null, verifiedAt: T,
    });
    assert.equal(await stores.sessions.deleteForUser('u1', 'b'), 2);
    assert.equal((await stores.sessions.findById('b'))?.id, 'b');
    assert.equal((await stores.sessions.findById('other'))?.id, 'other');
    assert.equal(await stores.sessions.deleteExpired(T + 5000), 2);
  });

  it('takes a first workspace once, and refuses a second first save', async () => {
    const first = await stores.workspaces.save('u1', 0, { version: 6, hello: 'world' }, T);
    assert.deepEqual(first, { saved: true, revision: 1, updatedAt: T });
    assert.equal(await stores.workspaces.revisionOf('u1'), 1);

    const again = await stores.workspaces.save('u1', 0, { version: 6 }, T + 1);
    assert.equal(again.saved, false);
    assert.equal(again.saved === false && again.current?.revision, 1);
  });

  it('lets one of two saves built on the same revision win', async () => {
    const mine = await stores.workspaces.save('u1', 1, { version: 6, from: 'pc' }, T + 2);
    assert.deepEqual(mine, { saved: true, revision: 2, updatedAt: T + 2 });

    const stale = await stores.workspaces.save('u1', 1, { version: 6, from: 'ipad' }, T + 3);
    assert.equal(stale.saved, false);
    assert.equal(stale.saved === false && stale.current?.revision, 2);
    assert.deepEqual(stale.saved === false && stale.current?.document, { version: 6, from: 'pc' });
  });

  it('will not let a build older than the stored document write over it', async () => {
    const newer = await stores.workspaces.save('u1', 2, { version: 7, from: 'new build' }, T + 4);
    assert.deepEqual(newer, { saved: true, revision: 3, updatedAt: T + 4 });

    const older = await stores.workspaces.save('u1', 3, { version: 6, from: 'old tab' }, T + 5);
    assert.equal(older.saved, false);
    assert.equal(older.saved === false && older.current?.revision, 3);
    assert.deepEqual(older.saved === false && older.current?.document, { version: 7, from: 'new build' });
  });

  it('has nothing for an account that has saved nothing', async () => {
    assert.equal(await stores.workspaces.revisionOf('u3'), 0);
    assert.equal(await stores.workspaces.find('u3'), null);
  });

  it('takes a workspace away with the account that owned it', async () => {
    await stores.users.delete('u3');
    assert.equal(await stores.users.findById('u3'), null);
    // ON DELETE CASCADE, which SQLite only obeys with a pragma and Postgres
    // always does — the sessions and the saved work have to go with it.
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1', ['u3']);
    assert.equal((rows[0] as { n: number }).n, 0);
  });

  it('keeps a recording as bytes, once, and says which keys it has', async () => {
    const wang = { id: 'wang', name: 'Teacher Wang', gender: 'female' as const };
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x01]);
    await stores.recordings.save({ key: 'k1', voice: wang, text: '天空是蓝色的。', mp3, createdAt: T });
    // A second recording under the same key leaves the first as it was.
    await stores.recordings.save({ key: 'k1', voice: wang, text: '天空是蓝色的。', mp3: new Uint8Array([1]), createdAt: T + 1 });
    assert.deepEqual(await stores.recordings.find('k1'), mp3);
    assert.equal(await stores.recordings.find('k2'), null);
    assert.deepEqual([...(await stores.recordings.have(['k1', 'k2']))], ['k1']);
    assert.deepEqual([...(await stores.recordings.have([]))], []);
    assert.deepEqual(await stores.recordings.voices(), [wang]);
  });
  it('keeps a picture as bytes, once, with its owner', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x02]);
    await stores.pictures.save({ key: 'p1', userId: 'u1', mime: 'image/jpeg', bytes, createdAt: T });
    await stores.pictures.save({ key: 'p1', userId: 'u1', mime: 'image/png', bytes: new Uint8Array([1]), createdAt: T + 1 });
    assert.deepEqual(await stores.pictures.find('p1'), { key: 'p1', userId: 'u1', mime: 'image/jpeg', bytes, createdAt: T });
    assert.equal(await stores.pictures.find('p2'), null);
  });

  it('adds a day’s use of a service to its row, and reads the counts back as numbers', async () => {
    await stores.usage.add('u1', '2026-09-11', 'minimax', 1, 40);
    await stores.usage.add('u1', '2026-09-11', 'minimax', 1, 2);
    await stores.usage.add('u1', '2026-09-10', 'speechsuper', 1, 3);
    assert.deepEqual(await stores.usage.since('u1', '2026-09-11'), [{ day: '2026-09-11', service: 'minimax', calls: 2, units: 42 }]);
    assert.equal((await stores.usage.since('u1', '2026-09-01')).length, 2);
  });

  it('lets an invitation be claimed once and only before it runs out, and given back', async () => {
    await stores.invites.insert({ digest: 'd1', note: 'Masha', createdAt: T, expiresAt: T + 1000, usedBy: null, usedAt: null });
    assert.equal(await stores.invites.claim('d1', 'u1', T + 2000), false);
    assert.equal(await stores.invites.claim('d1', 'u1', T + 10), true);
    assert.equal(await stores.invites.claim('d1', 'u2', T + 20), false);
    await stores.invites.release('d1', 'u2');
    assert.equal((await stores.invites.list())[0]!.usedBy, 'u1');
    await stores.invites.release('d1', 'u1');
    assert.deepEqual((await stores.invites.list())[0], { digest: 'd1', note: 'Masha', createdAt: T, expiresAt: T + 1000, usedBy: null, usedAt: null });
  });

  it('counts attempts per key per window in one statement, and forgets a key or an old window', async () => {
    assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
    assert.equal(await stores.limits.hit('auth.perName:x', T), 2);
    assert.equal(await stores.limits.hit('auth.perName:x', T + 60_000), 1);
    await stores.limits.reset('auth.perName:x');
    assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
    await stores.limits.sweep(T + 1);
    assert.equal(await stores.limits.hit('auth.perName:x', T), 1);
  });

  it('keeps an answer the same for everyone, and gives it back only while it is fresh enough', async () => {
    await stores.lookups.put('youtube:video:x', '{"a":1}', T);
    await stores.lookups.put('youtube:video:x', '{"a":2}', T + 10);
    assert.equal(await stores.lookups.get('youtube:video:x', T), '{"a":2}');
    assert.equal(await stores.lookups.get('youtube:video:x', T + 11), null);
    assert.equal(await stores.lookups.get('youtube:video:y', 0), null);
  });

  it('lists a user’s sessions still good, the one used last first', async () => {
    await stores.users.insert(user('u9'));
    await stores.sessions.insert({ id: 's9a', userId: 'u9', createdAt: T, lastSeenAt: T + 5, expiresAt: T + 1000, userAgent: 'iPad', verifiedAt: T });
    await stores.sessions.insert({ id: 's9b', userId: 'u9', createdAt: T, lastSeenAt: T + 9, expiresAt: T + 1000, userAgent: 'iPhone', verifiedAt: T });
    await stores.sessions.insert({ id: 's9c', userId: 'u9', createdAt: T, lastSeenAt: T + 1, expiresAt: T + 10, userAgent: 'old', verifiedAt: T });
    assert.deepEqual((await stores.sessions.listForUser('u9', T + 100)).map((s) => s.id), ['s9b', 's9a']);
  });

  it('keeps recovery codes as digests, each used once, and replaces them all at once', async () => {
    await stores.recoveryCodes.replace('u9', ['a', 'b'], T);
    assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 2, createdAt: T });
    assert.equal(await stores.recoveryCodes.use('u9', 'a', T + 1), true);
    assert.equal(await stores.recoveryCodes.use('u9', 'a', T + 2), false);
    assert.equal(await stores.recoveryCodes.use('u1', 'b', T + 2), false);
    assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 1, createdAt: T });
    await stores.recoveryCodes.replace('u9', ['c'], T + 5);
    assert.equal(await stores.recoveryCodes.use('u9', 'b', T + 6), false);
    assert.deepEqual(await stores.recoveryCodes.status('u9'), { left: 1, createdAt: T + 5 });
  });

  it('sums what an account keeps across its tables, in bytes', async () => {
    await stores.users.insert(user('u7'));
    const before = await stores.storage.usedBy('u7');
    await stores.pictures.save({ key: 'p7', userId: 'u7', mime: 'image/jpeg', bytes: new Uint8Array(1000), createdAt: T });
    await stores.workspaces.save('u7', 0, { note: '你好' }, T);
    const after = await stores.storage.usedBy('u7');
    assert.equal(before, 0);
    assert.ok(after >= 1000 + JSON.stringify({ note: '你好' }).length, String(after));
    assert.equal(await stores.storage.usedBy('nobody'), 0);
  });

  it('keeps what happened to accounts, the latest first, and forgets what is old', async () => {
    await stores.audit.add({ at: T, kind: 'sign-up', username: 'masha', ip: '203.0.113.7', userAgent: null });
    await stores.audit.add({ at: T + 5, kind: 'sign-in-refused', username: 'masha', ip: '203.0.113.7', userAgent: 'iPhone' });
    assert.deepEqual((await stores.audit.recent(10)).map((e) => e.kind), ['sign-in-refused', 'sign-up']);
    await stores.audit.sweep(T + 1);
    assert.deepEqual((await stores.audit.recent(10)).map((e) => [e.kind, e.at]), [['sign-in-refused', T + 5]]);
  });

  it('keeps an access token as its digest, lists the live ones, and revokes one or all', async () => {
    const token = (id: string, at: number) => ({ id, userId: 'u1', name: `script ${id}`, digest: `d-${id}`, scopes: ['texts:write'], createdAt: at, lastUsedAt: null, expiresAt: at + 1000, revokedAt: null });
    await stores.apiTokens.insert(token('t1', T));
    await stores.apiTokens.insert(token('t2', T + 1));
    const found = await stores.apiTokens.findByDigest('d-t1');
    assert.deepEqual(found, token('t1', T));
    await stores.apiTokens.touch('t1', T + 50);
    assert.equal((await stores.apiTokens.findByDigest('d-t1'))?.lastUsedAt, T + 50);
    assert.deepEqual((await stores.apiTokens.listForUser('u1')).map((t) => t.id), ['t2', 't1']);
    assert.equal(await stores.apiTokens.revoke('u2', 't1', T + 60), false, 'not another account’s to revoke');
    assert.equal(await stores.apiTokens.revoke('u1', 't1', T + 60), true);
    assert.equal(await stores.apiTokens.revoke('u1', 't1', T + 61), false);
    assert.equal((await stores.apiTokens.findByDigest('d-t1'))?.revokedAt, T + 60);
    assert.equal(await stores.apiTokens.revokeForUser('u1', T + 70), 1);
    assert.deepEqual(await stores.apiTokens.listForUser('u1'), []);
  });

  it('keeps a role, a status and flags, and counts the accounts with a role', async () => {
    await stores.users.insert({ ...user('u-roles', 'zhang'), flags: { tutor: true } });
    const made = await stores.users.findById('u-roles');
    assert.equal(made?.role, 'learner');
    assert.equal(made?.status, 'active');
    assert.deepEqual(made?.flags, { tutor: true });
    const before = await stores.users.countByRole('admin');
    await stores.users.setRole('u-roles', 'admin', T + 1);
    await stores.users.setStatus('u-roles', 'blocked', T + 2);
    const changed = await stores.users.findById('u-roles');
    assert.equal(changed?.role, 'admin');
    assert.equal(changed?.status, 'blocked');
    assert.equal(await stores.users.countByRole('admin'), before + 1);
    assert.equal(typeof (await stores.users.countByRole('admin')), 'number');
  });

  it('keeps the admins’ log newest first, finds by action and by either name, and pages by id', async () => {
    const line = (at: number, action: string, target: string | null) => ({ at, actorId: null, actorName: 'Kirill', action, targetId: null, targetName: target, details: { note: `at ${at}` }, ip: '203.0.113.7' });
    await stores.adminLog.add(line(T, 'invite-made', null));
    await stores.adminLog.add(line(T + 1, 'blocked', 'Masha'));
    await stores.adminLog.add(line(T + 2, 'invite-made', null));
    const all = await stores.adminLog.list({ limit: 10 });
    assert.deepEqual(all.map((e) => e.at), [T + 2, T + 1, T]);
    assert.equal(typeof all[0]!.id, 'number');
    assert.deepEqual(all[0]!.details, { note: `at ${T + 2}` });
    assert.deepEqual((await stores.adminLog.list({ action: 'invite-made', limit: 10 })).map((e) => e.at), [T + 2, T]);
    assert.deepEqual((await stores.adminLog.list({ name: 'masha', limit: 10 })).map((e) => e.action), ['blocked']);
    assert.deepEqual((await stores.adminLog.list({ name: 'KIRILL', before: all[0]!.id, limit: 1 })).map((e) => e.at), [T + 1]);
    await stores.adminLog.sweep(T + 1);
    assert.equal((await stores.adminLog.list({ limit: 10 })).length, 2);
  });
});
