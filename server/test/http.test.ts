import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ApiErrorBody,
  CurrentSessionResponse,
  SaveWorkspaceResponse,
  WorkspaceConflictBody,
} from '../../shared/api';
import { call, HOST, makeApp, sessionCookie, type TestApp } from './support';

const CREDENTIALS = { username: 'kirill', password: 'correct horse' };

async function signUp(app: TestApp) {
  const res = await call(app, 'POST', '/api/auth/register', { body: CREDENTIALS });
  assert.equal(res.status, 201);
  return sessionCookie(res);
}

async function whoIsSignedIn(app: TestApp, cookie?: string) {
  const res = await call(app, 'GET', '/api/auth/session', { cookie });
  assert.equal(res.status, 200);
  return ((await res.json()) as CurrentSessionResponse).user;
}

describe('HTTP API', () => {
  it('signs up with an HttpOnly cookie that opens the session', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/api/auth/register', { body: CREDENTIALS });
    assert.equal(res.status, 201);

    const setCookie = res.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.doesNotMatch(setCookie, /Secure/i, 'plain http on the Wi-Fi would never store a Secure cookie');

    assert.equal((await whoIsSignedIn(app, sessionCookie(res)))?.username, 'kirill');
  });

  it('says nobody is signed in without treating it as an error', async () => {
    const { app } = makeApp();
    assert.equal(await whoIsSignedIn(app), null);

    const stale = await call(app, 'GET', '/api/auth/session', { cookie: 'hanzi_session=long-gone' });
    assert.equal(((await stale.json()) as CurrentSessionResponse).user, null);
    assert.match(stale.headers.get('set-cookie') ?? '', /Max-Age=0/i, 'a cookie that opens nothing is cleared');
  });

  it('keeps the workspace behind the session', async () => {
    const { app } = makeApp();
    assert.equal((await call(app, 'GET', '/api/workspace')).status, 401);
    const put = await call(app, 'PUT', '/api/workspace', { body: { baseRevision: 0, document: { version: 5 } } });
    assert.equal(put.status, 401);
  });

  it('saves a workspace, answers 304 while nothing has changed, and 409 with the newer copy', async () => {
    const { app } = makeApp();
    const cookie = await signUp(app);

    const first = await call(app, 'PUT', '/api/workspace', { cookie, body: { baseRevision: 0, document: { version: 5, a: 1 } } });
    assert.equal(first.status, 200);
    assert.equal(((await first.json()) as SaveWorkspaceResponse).revision, 1);

    const unchanged = await call(app, 'GET', '/api/workspace', { cookie, headers: { 'if-none-match': '"r1"' } });
    assert.equal(unchanged.status, 304);

    const current = await call(app, 'GET', '/api/workspace', { cookie, headers: { 'if-none-match': '"r0"' } });
    assert.equal(current.status, 200);
    assert.equal(current.headers.get('etag'), '"r1"');

    const stale = await call(app, 'PUT', '/api/workspace', { cookie, body: { baseRevision: 0, document: { version: 5, b: 2 } } });
    assert.equal(stale.status, 409);
    const body = (await stale.json()) as WorkspaceConflictBody;
    assert.equal(body.error.code, 'conflict');
    assert.deepEqual(body.current.document, { version: 5, a: 1 });
  });

  it('refuses a state change sent from another site', async () => {
    const { app } = makeApp();
    const crossSite = await call(app, 'POST', '/api/auth/register', {
      body: CREDENTIALS,
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(crossSite.status, 403);

    const foreignOrigin = await app.request(`http://${HOST}/api/auth/register`, {
      method: 'POST',
      headers: { host: HOST, origin: 'http://elsewhere.test', 'content-type': 'application/json' },
      body: JSON.stringify(CREDENTIALS),
    });
    assert.equal(foreignOrigin.status, 403);
  });

  it('only takes JSON', async () => {
    const { app } = makeApp();
    const res = await call(app, 'POST', '/api/auth/login', {
      headers: { 'content-type': 'text/plain' },
    });
    assert.equal(res.status, 400);
  });

  it('makes somebody guessing passwords wait', async () => {
    const { app } = makeApp();
    await signUp(app);
    const wrong = { username: 'kirill', password: 'not the password' };
    for (let i = 0; i < 10; i++) {
      assert.equal((await call(app, 'POST', '/api/auth/login', { body: wrong })).status, 401);
    }
    const blocked = await call(app, 'POST', '/api/auth/login', { body: CREDENTIALS });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  });

  it('signs out, and the old cookie opens nothing', async () => {
    const { app } = makeApp();
    const cookie = await signUp(app);
    const out = await call(app, 'POST', '/api/auth/logout', { cookie });
    assert.equal(out.status, 204);
    assert.match(out.headers.get('set-cookie') ?? '', /Max-Age=0/i);
    assert.equal(await whoIsSignedIn(app, cookie), null);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie })).status, 401);
  });

  it('answers an unknown API route with JSON', async () => {
    const { app } = makeApp();
    const res = await call(app, 'GET', '/api/nothing-here');
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as ApiErrorBody).error.code, 'not_found');
  });
});

describe('signing in without a password, on the development server', () => {
  // The address a request came from, the way a proxy would say it — the only
  // way to give a request made in-process an address at all.
  const from = (ip: string) => ({ headers: { 'x-forwarded-for': ip } });

  it('signs a request from this machine in as the named account, making it the first time', async () => {
    const { app } = makeApp({}, { trustProxy: true, devUser: 'admin' });
    const res = await call(app, 'GET', '/api/auth/session', from('127.0.0.1'));
    assert.equal(((await res.json()) as CurrentSessionResponse).user?.username, 'admin');

    const cookie = sessionCookie(res);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie })).status, 200);

    const again = await call(app, 'GET', '/api/auth/session', from('::1'));
    const second = ((await again.json()) as CurrentSessionResponse).user;
    assert.equal(second?.username, 'admin');
    assert.equal(second?.id, ((await whoIsSignedIn(app, cookie)) ?? undefined)?.id, 'the same account, not a new one');
  });

  it('makes the account once when the page asks twice at the same moment', async () => {
    const { app } = makeApp({}, { trustProxy: true, devUser: 'admin' });
    const both = await Promise.all([
      call(app, 'GET', '/api/auth/session', from('127.0.0.1')),
      call(app, 'GET', '/api/auth/session', from('127.0.0.1')),
    ]);
    const users = await Promise.all(both.map(async (r) => ((await r.json()) as CurrentSessionResponse).user));
    assert.deepEqual(both.map((r) => r.status), [200, 200]);
    assert.equal(users[0]?.id, users[1]?.id);
  });

  it('leaves another device on the Wi-Fi at the sign-in page', async () => {
    const { app } = makeApp({}, { trustProxy: true, devUser: 'admin' });
    const res = await call(app, 'GET', '/api/auth/session', from('192.168.1.42'));
    assert.equal(((await res.json()) as CurrentSessionResponse).user, null);
    assert.equal(res.headers.get('set-cookie'), null);
  });

  it('does nothing unless it was asked for', async () => {
    const { app } = makeApp({}, { trustProxy: true });
    const res = await call(app, 'GET', '/api/auth/session', from('127.0.0.1'));
    assert.equal(((await res.json()) as CurrentSessionResponse).user, null);
  });
});
