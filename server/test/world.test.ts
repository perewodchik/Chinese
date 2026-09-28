import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { WorldConflictError } from '../src/domain/errors';
import type { Stores } from '../src/composition';
import { postgresStores } from '../src/infrastructure/postgres/stores';
import { makePostgres } from './pglite';
import { call, makeApp, makeServices, sessionCookie } from './support';

async function withAccount(name = 'kirill') {
  const made = makeServices();
  const { user } = await made.services.auth.register({ username: name, password: 'correct horse', userAgent: null });
  return { ...made, user };
}

describe('WorldService (SQLite)', () => {
  it('starts empty, at revision 0', async () => {
    const { services, user } = await withAccount();
    assert.deepEqual(await services.world.get(user.id), { revision: 0, save: null, updatedAt: null });
  });

  it('saves on the revision it was built on, and refuses a stale one with what is there now', async () => {
    const { services, user } = await withAccount();
    assert.equal((await services.world.save(user.id, 0, { version: 1, from: 'ipad' })).revision, 1);
    assert.equal((await services.world.save(user.id, 1, { version: 1, from: 'ipad again' })).revision, 2);
    await assert.rejects(services.world.save(user.id, 1, { version: 1, from: 'mac' }), (err: WorldConflictError) => {
      assert.equal(err.code, 'conflict');
      assert.equal(err.current.revision, 2);
      assert.deepEqual(err.current.save, { version: 1, from: 'ipad again' });
      return true;
    });
    assert.equal(await services.world.revision(user.id), 2);
  });

  it('refuses a save from a build older than the stored save', async () => {
    const { services, user } = await withAccount();
    await services.world.save(user.id, 0, { version: 2 });
    await assert.rejects(services.world.save(user.id, 1, { version: 1 }), { code: 'outdated_app' });
    assert.equal((await services.world.save(user.id, 1, { version: 2 })).revision, 2);
  });

  it('refuses what is not a save', async () => {
    const { services, user } = await withAccount();
    await assert.rejects(services.world.save(user.id, 0, [1]), { code: 'validation' });
    await assert.rejects(services.world.save(user.id, 0, { place: 'x' }), { code: 'validation' });
    await assert.rejects(services.world.save(user.id, -1, { version: 1 }), { code: 'validation' });
  });

  it('does not touch the workspace revision, nor another account', async () => {
    const { services, user } = await withAccount('kirill');
    const other = await services.auth.register({ username: 'vlad', password: 'correct horse', userAgent: null });
    await services.world.save(user.id, 0, { version: 1 });
    assert.equal(await services.workspaces.revision(user.id), 0);
    assert.equal((await services.world.get(other.user.id)).save, null);
  });
});

describe('/api/world', () => {
  async function signedIn() {
    const made = makeApp();
    const res = await call(made.app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } });
    return { ...made, cookie: sessionCookie(res) };
  }

  it('is behind the session', async () => {
    const { app } = makeApp();
    assert.equal((await call(app, 'GET', '/api/world')).status, 401);
    assert.equal((await call(app, 'PUT', '/api/world', { body: { baseRevision: 0, save: { version: 1 } } })).status, 401);
  });

  it('saves, answers 304 while nothing changed, and 409 with the newer save', async () => {
    const { app, cookie } = await signedIn();
    const first = await call(app, 'PUT', '/api/world', { cookie, body: { baseRevision: 0, save: { version: 1, place: 'a' } } });
    assert.equal(first.status, 200);
    assert.equal(((await first.json()) as { revision: number }).revision, 1);

    const same = await call(app, 'GET', '/api/world', { cookie, headers: { 'if-none-match': '"w1"' } });
    assert.equal(same.status, 304);
    const got = await call(app, 'GET', '/api/world', { cookie });
    assert.equal(got.headers.get('etag'), '"w1"');
    assert.deepEqual(await got.json(), { revision: 1, save: { version: 1, place: 'a' }, updatedAt: Date.UTC(2026, 8, 11, 9) });

    const stale = await call(app, 'PUT', '/api/world', { cookie, body: { baseRevision: 0, save: { version: 1, place: 'b' } } });
    assert.equal(stale.status, 409);
    const body = (await stale.json()) as { error: { code: string }; current: { revision: number; save: unknown } };
    assert.equal(body.error.code, 'conflict');
    assert.deepEqual(body.current.save, { version: 1, place: 'a' });
  });

  it('refuses a save larger than the limit', async () => {
    const { app, cookie } = await signedIn();
    const big = { version: 1, junk: 'x'.repeat(600 * 1024) };
    const res = await call(app, 'PUT', '/api/world', { cookie, body: { baseRevision: 0, save: big } });
    assert.equal(res.status, 413);
  });
});

describe('world saves in Postgres', () => {
  let stores: Stores;
  let close: () => Promise<void>;
  const T = Date.UTC(2026, 8, 11, 9);

  before(async () => {
    const made = await makePostgres();
    close = made.close;
    stores = postgresStores(made.pool);
    await stores.users.insert({ id: 'u1', username: 'K', usernameKey: 'k', passwordHash: 'h', createdAt: T, updatedAt: T });
  });

  after(async () => {
    await close();
  });

  it('takes a first save once', async () => {
    assert.deepEqual(await stores.worldSaves.save('u1', 0, { version: 1, a: 1 }, T), { saved: true, revision: 1, updatedAt: T });
    const again = await stores.worldSaves.save('u1', 0, { version: 1 }, T + 1);
    assert.equal(again.saved, false);
  });

  it('lets one of two saves on the same revision win, and reads times as numbers', async () => {
    assert.equal((await stores.worldSaves.save('u1', 1, { version: 1, from: 'ipad' }, T + 2)).saved, true);
    const stale = await stores.worldSaves.save('u1', 1, { version: 1, from: 'mac' }, T + 3);
    assert.equal(stale.saved, false);
    assert.deepEqual(stale.saved === false && stale.current?.save, { version: 1, from: 'ipad' });
    const found = await stores.worldSaves.find('u1');
    assert.equal(typeof found?.updatedAt, 'number');
    assert.equal(await stores.worldSaves.revisionOf('u1'), 2);
  });

  it('keeps an older build from writing over a newer save', async () => {
    assert.equal((await stores.worldSaves.save('u1', 2, { version: 3 }, T + 4)).saved, true);
    const older = await stores.worldSaves.save('u1', 3, { version: 2 }, T + 5);
    assert.equal(older.saved, false);
  });

  it('has nothing for an account that saved nothing', async () => {
    assert.equal(await stores.worldSaves.find('nobody'), null);
    assert.equal(await stores.worldSaves.revisionOf('nobody'), 0);
  });
});
