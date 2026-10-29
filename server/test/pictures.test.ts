import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pictureKey } from '../src/application/picture-service';
import { call, HOST, makeApp, sessionCookie, type TestApp } from './support';

async function signedIn(app: TestApp, username = 'kirill') {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } });
  return sessionCookie(res);
}

function put(app: TestApp, cookie: string, key: string, bytes: Uint8Array, type = 'image/jpeg') {
  return app.request(`http://${HOST}/api/pictures/${key}`, {
    method: 'PUT',
    headers: { host: HOST, 'sec-fetch-site': 'same-origin', cookie, 'content-type': type },
    body: bytes as Uint8Array<ArrayBuffer>,
  });
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe('pictures', () => {
  it('keeps a picture under its digest and gives it back to its owner, for ever', async () => {
    const { app } = makeApp();
    const cookie = await signedIn(app);
    const key = pictureKey(jpeg);
    assert.equal((await put(app, cookie, key, jpeg)).status, 200);
    // Twice is fine: the same bytes are the same picture.
    assert.equal((await put(app, cookie, key, jpeg)).status, 200);

    const res = await call(app, 'GET', `/api/pictures/${key}`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.match(res.headers.get('cache-control') ?? '', /immutable/);
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), jpeg);
  });

  it('refuses a key that is not the digest, a type that is not a picture, and nobody signed in', async () => {
    const { app } = makeApp();
    const cookie = await signedIn(app);
    assert.equal((await put(app, cookie, 'a'.repeat(64), jpeg)).status, 400);
    assert.equal((await put(app, cookie, pictureKey(jpeg), jpeg, 'text/html')).status, 400);
    assert.equal((await put(app, '', pictureKey(jpeg), jpeg)).status, 401);
    assert.equal((await call(app, 'GET', `/api/pictures/${pictureKey(jpeg)}`)).status, 401);
  });

  it('shows nobody else’s picture', async () => {
    const { app } = makeApp();
    const mine = await signedIn(app, 'kirill');
    const theirs = await signedIn(app, 'masha');
    const key = pictureKey(jpeg);
    await put(app, mine, key, jpeg);
    assert.equal((await call(app, 'GET', `/api/pictures/${key}`, { cookie: theirs })).status, 404);
    assert.equal((await call(app, 'GET', `/api/pictures/${'0'.repeat(64)}`, { cookie: mine })).status, 404);
  });
});
