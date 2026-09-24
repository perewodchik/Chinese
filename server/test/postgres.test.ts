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
    const s = { id: 's1', userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: 'iPad' };
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
        id, userId: 'u1', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null,
      });
    }
    await stores.sessions.insert({
      id: 'other', userId: 'u3', createdAt: T, lastSeenAt: T, expiresAt: T + 1000, userAgent: null,
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
    await pool.query('DELETE FROM users WHERE id = $1', ['u3']);
    assert.equal(await stores.users.findById('u3'), null);
    // ON DELETE CASCADE, which SQLite only obeys with a pragma and Postgres
    // always does — the sessions and the saved work have to go with it.
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1', ['u3']);
    assert.equal((rows[0] as { n: number }).n, 0);
  });
});
