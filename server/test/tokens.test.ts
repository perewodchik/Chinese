import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AccessTokensResponse, MadeAccessTokenResponse } from '../../shared/api';
import { pictureKey } from '../src/application/picture-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, HOST, sessionCookie, TestClock, type TestApp } from './support';

const DAY = 86_400_000;

function setUp() {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock, policy: { adminTwoStep: 'optional' } });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  return { app, clock, services };
}

async function signUp(app: TestApp, username: string) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } });
  assert.equal(res.status, 201);
  return sessionCookie(res);
}

async function makeToken(app: TestApp, cookie: string, body: Record<string, unknown> = { name: 'add-text skill', days: 90 }) {
  const res = await call(app, 'POST', '/api/account/tokens', { cookie, body });
  assert.equal(res.status, 201);
  return (await res.json()) as MadeAccessTokenResponse;
}

/** A request the way a script sends one: a bearer token, no cookie, no browser headers. */
function script(app: TestApp, method: string, path: string, token: string, body?: unknown, type = 'application/json') {
  return app.request(`http://${HOST}${path}`, {
    method,
    headers: { host: HOST, authorization: `Bearer ${token}`, ...(body !== undefined && { 'content-type': type }) },
    body: body === undefined ? undefined : body instanceof Uint8Array ? (body as Uint8Array<ArrayBuffer>) : JSON.stringify(body),
  });
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe('access tokens for scripts', () => {
  it('shows a token once, and keeps only what lists it', async () => {
    const { app } = setUp();
    const cookie = await signUp(app, 'kirill');
    const { token, made } = await makeToken(app, cookie);
    assert.match(token, /^hzw_[A-Za-z0-9]{32}$/);
    assert.deepEqual(made.scopes, ['texts:write']);
    assert.equal(made.lastUsedAt, null);

    const listed = (await (await call(app, 'GET', '/api/account/tokens', { cookie })).json()) as AccessTokensResponse;
    assert.deepEqual(listed.tokens, [made]);
    assert.ok(!JSON.stringify(listed).includes(token.slice(4)), 'the token itself is never sent again');
  });

  it('reads and saves the workspace and keeps a picture, as the add-text skill does', async () => {
    const { app, clock } = setUp();
    const cookie = await signUp(app, 'kirill');
    const { token, made } = await makeToken(app, cookie);

    const read = await script(app, 'GET', '/api/workspace', token);
    assert.equal(read.status, 200);
    const saved = await script(app, 'PUT', '/api/workspace', token, { baseRevision: 0, document: { version: 5, texts: [] } });
    assert.equal(saved.status, 200);
    const key = pictureKey(jpeg);
    assert.equal((await script(app, 'PUT', `/api/pictures/${key}`, token, jpeg, 'image/jpeg')).status, 200);
    assert.equal((await script(app, 'GET', `/api/pictures/${key}`, token)).status, 200);

    // The same account's browser sees what the script saved.
    const fromBrowser = await call(app, 'GET', '/api/workspace', { cookie });
    assert.deepEqual(((await fromBrowser.json()) as { document: unknown }).document, { version: 5, texts: [] });

    clock.advance(5 * 60_000);
    await script(app, 'GET', '/api/workspace', token);
    const listed = (await (await call(app, 'GET', '/api/account/tokens', { cookie })).json()) as AccessTokensResponse;
    assert.equal(listed.tokens[0]?.lastUsedAt, clock.now(), 'the list says when it was last used');
    assert.equal(listed.tokens[0]?.id, made.id);
  });

  it('cannot change the password, delete the account, open the admin pages or touch tokens', async () => {
    const { app } = setUp();
    // kirill runs the site, so a cookie of his would open /api/admin; his token must not.
    const cookie = await signUp(app, 'kirill');
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie })).status, 200);
    const { token, made } = await makeToken(app, cookie);

    const refused: Array<[string, string, unknown?]> = [
      ['POST', '/api/auth/password', { currentPassword: 'correct horse', newPassword: 'a new horse battery' }],
      ['GET', '/api/admin/overview'],
      ['POST', '/api/admin/invites', { note: '', days: 7 }],
      ['GET', '/api/auth/sessions'],
      ['DELETE', '/api/account', { password: 'correct horse' }],
      ['GET', '/api/account/export'],
      ['GET', '/api/account/tokens'],
      ['POST', '/api/account/tokens', { name: 'another', days: 90 }],
      ['DELETE', `/api/account/tokens/${made.id}`],
      ['GET', '/api/eval'],
      ['GET', '/api/narration'],
      ['GET', '/api/world'],
    ];
    for (const [method, path, body] of refused) {
      const res = await script(app, method, path, token, body);
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'forbidden', `${method} ${path}`);
    }
    // And the account is as it was: the password still works.
    assert.equal((await call(app, 'POST', '/api/auth/login', { body: { username: 'kirill', password: 'correct horse' } })).status, 200);
  });

  it('stops working once revoked, once out of date, and when the password changes', async () => {
    const { app, clock } = setUp();
    const cookie = await signUp(app, 'kirill');

    const revoked = await makeToken(app, cookie);
    assert.equal((await call(app, 'DELETE', `/api/account/tokens/${revoked.made.id}`, { cookie })).status, 204);
    assert.equal((await script(app, 'GET', '/api/workspace', revoked.token)).status, 401);
    assert.equal((await call(app, 'DELETE', `/api/account/tokens/${revoked.made.id}`, { cookie })).status, 404, 'revoked once');

    const short = await makeToken(app, cookie, { name: 'a day', days: 1 });
    assert.equal((await script(app, 'GET', '/api/workspace', short.token)).status, 200);
    clock.advance(DAY + 1);
    assert.equal((await script(app, 'GET', '/api/workspace', short.token)).status, 401);

    const fresh = await makeToken(app, cookie);
    const changed = await call(app, 'POST', '/api/auth/password', { cookie, body: { currentPassword: 'correct horse', newPassword: 'a new horse battery' } });
    assert.equal(changed.status, 204);
    assert.equal((await script(app, 'GET', '/api/workspace', fresh.token)).status, 401, 'a token made with the old password goes with it');

    assert.equal((await script(app, 'GET', '/api/workspace', 'hzw_' + 'x'.repeat(32))).status, 401);
    assert.equal((await script(app, 'GET', '/api/workspace', 'not-a-token')).status, 401);
  });

  it('judges a request with a token by the token alone, never by the cookie beside it', async () => {
    const { app } = setUp();
    const cookie = await signUp(app, 'kirill');
    const res = await app.request(`http://${HOST}/api/workspace`, {
      headers: { host: HOST, cookie, authorization: 'Bearer hzw_nothing' },
    });
    assert.equal(res.status, 401);
  });

  it('is another account’s to list and revoke, not this one’s', async () => {
    const { app } = setUp();
    const owner = await signUp(app, 'kirill');
    const { token, made } = await makeToken(app, owner);
    const stranger = await signUp(app, 'masha');

    const theirs = (await (await call(app, 'GET', '/api/account/tokens', { cookie: stranger })).json()) as AccessTokensResponse;
    assert.deepEqual(theirs.tokens, []);
    assert.equal((await call(app, 'DELETE', `/api/account/tokens/${made.id}`, { cookie: stranger })).status, 404);
    assert.equal((await script(app, 'GET', '/api/workspace', token)).status, 200, 'still working');

    // And a token opens its own account's workspace, not anyone else's.
    await call(app, 'PUT', '/api/workspace', { cookie: stranger, body: { baseRevision: 0, document: { version: 5, mine: 'masha' } } });
    const read = (await (await script(app, 'GET', '/api/workspace', token)).json()) as { document: unknown };
    assert.equal(read.document, null);
  });

  it('gives the catalogue scope only to an account that runs the site', async () => {
    const { app } = setUp();
    const learner = await signUp(app, 'masha');
    const refused = await call(app, 'POST', '/api/account/tokens', { cookie: learner, body: { name: 'catalogue', days: 30, scopes: ['catalog:write'] } });
    assert.equal(refused.status, 403);

    const owner = await signUp(app, 'kirill');
    const { made } = await makeToken(app, owner, { name: 'catalogue', days: 30, scopes: ['texts:write', 'catalog:write'] });
    assert.deepEqual(made.scopes, ['texts:write', 'catalog:write']);
  });

  it('asks for a name and a sensible length, and needs a signed-in browser', async () => {
    const { app } = setUp();
    assert.equal((await call(app, 'GET', '/api/account/tokens')).status, 401);
    assert.equal((await call(app, 'POST', '/api/account/tokens', { body: { name: 'x', days: 90 } })).status, 401);
    const cookie = await signUp(app, 'kirill');
    assert.equal((await call(app, 'POST', '/api/account/tokens', { cookie, body: { name: '  ', days: 90 } })).status, 400);
    assert.equal((await call(app, 'POST', '/api/account/tokens', { cookie, body: { name: 'x', days: 0 } })).status, 400);
    assert.equal((await call(app, 'POST', '/api/account/tokens', { cookie, body: { name: 'x', days: 366 } })).status, 400);
    assert.equal((await call(app, 'POST', '/api/account/tokens', { cookie, body: { name: 'x', days: 90, scopes: ['everything'] } })).status, 400);
  });
});
