import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pictureKey } from '../src/application/picture-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const MB = 1024 * 1024;

async function setUp(storageLimitMb: number | null) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), storageLimitMb });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
  const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
  return { app, cookie, services };
}

/** A picture of `size` bytes, different for each `seed`, put the way the page puts one. */
async function putPicture(app: Awaited<ReturnType<typeof setUp>>['app'], cookie: string, size: number, seed: number) {
  const bytes = new Uint8Array(size).fill(seed);
  bytes[0] = 0xff;
  return app.request(`/api/pictures/${pictureKey(bytes)}`, {
    method: 'PUT',
    body: bytes,
    headers: { cookie, 'content-type': 'image/jpeg', host: 'hanzi.test', origin: 'http://hanzi.test', 'sec-fetch-site': 'same-origin' },
  });
}

describe('the room one account takes', () => {
  it('counts what the account keeps, and says how much it may', async () => {
    const { app, cookie } = await setUp(3);
    await call(app, 'PUT', '/api/workspace', { cookie, body: { baseRevision: 0, document: { version: 11, note: 'x'.repeat(1000) } } });
    assert.equal((await putPicture(app, cookie, MB, 1)).status, 200);
    const use = (await (await call(app, 'GET', '/api/account/storage', { cookie })).json()) as { usedBytes: number; limitBytes: number };
    assert.ok(use.usedBytes > MB && use.usedBytes < MB + 5000, String(use.usedBytes));
    assert.equal(use.limitBytes, 3 * MB);
  });

  it('refuses a picture that would take it past the ceiling, saying how full it is', async () => {
    const { app, cookie } = await setUp(3);
    assert.equal((await putPicture(app, cookie, 2 * MB - 10, 1)).status, 200);
    const refused = await putPicture(app, cookie, 2 * MB - 10, 2);
    assert.equal(refused.status, 413);
    assert.match(((await refused.json()) as { error: { message: string } }).error.message, /^Your account is full: 2 MB of 3 MB/);
  });

  it('has no ceiling where none is set', async () => {
    const { app, cookie } = await setUp(null);
    assert.equal((await putPicture(app, cookie, 2 * MB - 10, 1)).status, 200);
    assert.equal((await putPicture(app, cookie, 2 * MB - 10, 2)).status, 200);
    assert.equal(((await (await call(app, 'GET', '/api/account/storage', { cookie })).json()) as { limitBytes: unknown }).limitBytes, null);
  });
});
