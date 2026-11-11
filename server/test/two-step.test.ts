import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TwoStepSetup, TwoStepStatus } from '../../shared/api';
import { codeAt, stepOf } from '../src/application/totp';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock, type TestApp } from './support';

const PASSWORD = 'correct horse';

function setUp(adminTwoStep: 'required' | 'optional' = 'required') {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock, policy: { adminTwoStep } });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: PASSWORD } }));
  return { app, clock, services, signUp };
}

const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;
const login = (app: TestApp, username: string, code?: string) => call(app, 'POST', '/api/auth/login', { body: { username, password: PASSWORD, ...(code !== undefined && { code }) } });

/** Turns two-step sign-in on for the account behind `cookie`; the secret, to make codes with. */
async function turnOn(app: TestApp, clock: TestClock, cookie: string) {
  const started = await call(app, 'POST', '/api/auth/two-step/start', { cookie });
  assert.equal(started.status, 200);
  const { secret, link } = (await started.json()) as TwoStepSetup;
  assert.match(link, /^otpauth:\/\/totp\/Hanzi%20Workshop%3A/);
  assert.equal((await call(app, 'POST', '/api/auth/two-step/confirm', { cookie, body: { code: codeAt(secret, stepOf(clock.now())) } })).status, 204);
  return secret;
}

describe('two-step sign-in', () => {
  it('turns on with the first code, then asks for a code after the right password only', async () => {
    const { app, clock, signUp } = setUp();
    const cookie = await signUp('masha');
    const other = sessionCookie(await login(app, 'masha'));
    assert.deepEqual((await (await call(app, 'GET', '/api/auth/two-step', { cookie })).json()) as TwoStepStatus, { enabled: false, required: false });

    const secret = await turnOn(app, clock, cookie);
    assert.equal(((await (await call(app, 'GET', '/api/auth/two-step', { cookie })).json()) as TwoStepStatus).enabled, true);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie })).status, 200, 'this browser stays');
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: other })).status, 401, 'the others were never asked for a code');

    const wrongPassword = await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: 'not it at all' } });
    assert.equal(await errorCode(wrongPassword), 'invalid_credentials', 'a guesser learns nothing about the code');
    const noCode = await login(app, 'masha');
    assert.equal(noCode.status, 401);
    assert.equal(await errorCode(noCode), 'totp_required');
    assert.equal(noCode.headers.get('set-cookie'), null);

    clock.advance(60_000);
    const code = codeAt(secret, stepOf(clock.now()));
    assert.equal((await login(app, 'masha', '000000' === code ? '111111' : '000000')).status, 400);
    assert.equal((await login(app, 'masha', code)).status, 200);
    assert.equal((await login(app, 'masha', code)).status, 400, 'each code once');
  });

  it('takes a recovery code in place of the app’s, once', async () => {
    const { app, clock, signUp } = setUp();
    const cookie = await signUp('masha');
    await turnOn(app, clock, cookie);
    const codes = ((await (await call(app, 'POST', '/api/auth/recovery-codes', { cookie, body: { password: PASSWORD } })).json()) as { codes: string[] }).codes;
    assert.equal((await login(app, 'masha', codes[0]!.toLowerCase())).status, 200);
    assert.equal((await login(app, 'masha', codes[0]!)).status, 400, 'used up');
  });

  it('refuses a wrong first code, and turns off only with a code', async () => {
    const { app, clock, signUp } = setUp();
    const cookie = await signUp('masha');
    await call(app, 'POST', '/api/auth/two-step/start', { cookie });
    assert.equal((await call(app, 'POST', '/api/auth/two-step/confirm', { cookie, body: { code: '123456' } })).status, 400);
    assert.equal(((await (await call(app, 'GET', '/api/auth/two-step', { cookie })).json()) as TwoStepStatus).enabled, false);

    const secret = await turnOn(app, clock, cookie);
    clock.advance(60_000);
    assert.equal((await call(app, 'POST', '/api/auth/two-step/disable', { cookie, body: { code: '000001' } })).status, 400);
    assert.equal((await call(app, 'POST', '/api/auth/two-step/disable', { cookie, body: { code: codeAt(secret, stepOf(clock.now())) } })).status, 204);
    assert.equal((await login(app, 'masha')).status, 200, 'a password alone again');
  });

  it('keeps an admin out of the site’s pages until it is on, and on for good', async () => {
    const { app, clock, signUp } = setUp();
    const owner = await signUp('kirill');
    await call(app, 'GET', '/api/health');
    const refused = await call(app, 'GET', '/api/admin/overview', { cookie: owner });
    assert.equal(refused.status, 403);
    assert.equal(await errorCode(refused), 'totp_setup_required');
    assert.equal(((await (await call(app, 'GET', '/api/auth/two-step', { cookie: owner })).json()) as TwoStepStatus).required, true);

    const secret = await turnOn(app, clock, owner);
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: owner })).status, 200);
    clock.advance(60_000);
    const off = await call(app, 'POST', '/api/auth/two-step/disable', { cookie: owner, body: { code: codeAt(secret, stepOf(clock.now())) } });
    assert.equal(off.status, 400);
  });

  it('can be left optional for admins by the server', async () => {
    const { app, signUp } = setUp('optional');
    const owner = await signUp('kirill');
    await call(app, 'GET', '/api/health');
    assert.equal((await call(app, 'GET', '/api/admin/overview', { cookie: owner })).status, 200);
  });

  it('asks for the password lately before it is turned on or off', async () => {
    const { app, clock, signUp } = setUp();
    const cookie = await signUp('masha');
    clock.advance(16 * 60_000);
    assert.equal(await errorCode(await call(app, 'POST', '/api/auth/two-step/start', { cookie })), 'reauth_required');
    assert.equal(await errorCode(await call(app, 'POST', '/api/auth/two-step/disable', { cookie, body: { code: '123456' } })), 'reauth_required');
  });
});
