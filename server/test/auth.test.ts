import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppError } from '../src/domain/errors';
import { call, makeApp, makeServices, sessionCookie } from './support';

const DAY = 86_400_000;
const PASSWORD = 'correct horse';

describe('AuthService', () => {
  it('makes an account and signs in to it whatever the case of the name', async () => {
    const { services } = makeServices();
    const made = await services.auth.register({ username: '  Kirill ', password: PASSWORD, userAgent: null });
    assert.equal(made.user.username, 'Kirill');

    const again = await services.auth.login({ username: 'KIRILL', password: PASSWORD, userAgent: null });
    assert.equal(again.user.id, made.user.id);
    assert.notEqual(again.token, made.token);
  });

  it('refuses a name that is taken, in any case', async () => {
    const { services } = makeServices();
    await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    await assert.rejects(
      services.auth.register({ username: 'Kirill', password: 'another password', userAgent: null }),
      { code: 'username_taken' },
    );
  });

  it('fails a wrong password and an unknown name in the same way', async () => {
    const { services } = makeServices();
    await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    await assert.rejects(
      services.auth.login({ username: 'kirill', password: 'wrong horse', userAgent: null }),
      { code: 'invalid_credentials' },
    );
    await assert.rejects(
      services.auth.login({ username: 'nobody', password: PASSWORD, userAgent: null }),
      { code: 'invalid_credentials' },
    );
  });

  it('says which field is wrong', async () => {
    const { services } = makeServices();
    await assert.rejects(services.auth.register({ username: 'a b', password: 'short', userAgent: null }), (err: AppError) => {
      assert.equal(err.code, 'validation');
      assert.ok(err.fields?.username);
      assert.ok(err.fields?.password);
      return true;
    });
  });

  it('makes no accounts when registration is closed', async () => {
    const { services } = makeServices({ registration: 'closed' });
    await assert.rejects(
      services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null }),
      { code: 'registration_closed' },
    );
  });

  it('ends a session left unused for thirty days, and keeps one that is used', async () => {
    const { services, clock } = makeServices();
    const { token } = await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });

    clock.advance(2 * DAY);
    assert.equal((await services.auth.authenticate(token))?.renewed, true);
    clock.advance(29 * DAY);
    assert.ok(await services.auth.authenticate(token), 'used two days in, so good for thirty more');
    clock.advance(31 * DAY);
    assert.equal(await services.auth.authenticate(token), null);
  });

  it('forgets a session on sign-out', async () => {
    const { services } = makeServices();
    const { token } = await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    await services.auth.logout(token);
    assert.equal(await services.auth.authenticate(token), null);
  });

  it('signs every other browser out when the password changes', async () => {
    const { services } = makeServices();
    const pc = await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: 'pc' });
    const ipad = await services.auth.login({ username: 'kirill', password: PASSWORD, userAgent: 'ipad' });
    const here = await services.auth.authenticate(ipad.token);
    assert.ok(here);

    await services.auth.changePassword({
      userId: here.user.id,
      sessionId: here.sessionId,
      currentPassword: PASSWORD,
      newPassword: 'battery staple',
    });

    assert.equal(await services.auth.authenticate(pc.token), null);
    assert.ok(await services.auth.authenticate(ipad.token));
    await assert.rejects(
      services.auth.login({ username: 'kirill', password: PASSWORD, userAgent: null }),
      { code: 'invalid_credentials' },
    );
    assert.ok(await services.auth.login({ username: 'kirill', password: 'battery staple', userAgent: null }));
  });

  it('refuses a password change without the current password', async () => {
    const { services } = makeServices();
    const { token } = await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    const here = await services.auth.authenticate(token);
    assert.ok(here);
    await assert.rejects(
      services.auth.changePassword({
        userId: here.user.id,
        sessionId: here.sessionId,
        currentPassword: 'a guess',
        newPassword: 'battery staple',
      }),
      { code: 'validation' },
    );
  });
});

describe('signing up by invitation', () => {
  const sign = (invite: string | undefined, username = 'masha', password = PASSWORD) => ({ username, password, invite, userAgent: null });

  it('makes an account with a code, typed in any case and with or without its dashes, and only once', async () => {
    const { services } = makeServices({ registration: 'invite' });
    const { code } = await services.auth.invite('Masha', 14);
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const made = await services.auth.register(sign(code.toLowerCase().replace(/-/g, ' ')));
    assert.equal(made.user.username, 'masha');
    await assert.rejects(services.auth.register(sign(code, 'pasha')), { code: 'validation', fields: { invite: 'Not a code that can be used.' } });
    assert.deepEqual(
      (await services.auth.invites()).map((i) => [i.note, i.usedBy]),
      [['Masha', 'masha']],
    );
  });

  it('asks for a code when there is none, and refuses one that was never given', async () => {
    const { services } = makeServices({ registration: 'invite' });
    await assert.rejects(services.auth.register(sign(undefined)), { code: 'validation', fields: { invite: 'The code from your invitation.' } });
    await assert.rejects(services.auth.register(sign('ABCD-EFGH-JKMN')), { code: 'validation' });
  });

  it('keeps the invitation for another try when the name is taken or the password too short', async () => {
    const { services } = makeServices({ registration: 'invite' });
    const first = await services.auth.invite('', null);
    await services.auth.register(sign(first.code, 'kirill'));
    const { code } = await services.auth.invite('', null);
    await assert.rejects(services.auth.register(sign(code, 'Kirill')), { code: 'username_taken' });
    await assert.rejects(services.auth.register(sign(code, 'masha', 'short')), { code: 'validation' });
    const made = await services.auth.register(sign(code, 'masha'));
    assert.equal(made.user.username, 'masha');
  });

  it('runs out on its last day', async () => {
    const { services, clock } = makeServices({ registration: 'invite' });
    const { code } = await services.auth.invite('', 3);
    clock.advance(3 * DAY);
    await assert.rejects(services.auth.register(sign(code)), { code: 'validation' });
  });

  it('is not asked for when sign-ups are open', async () => {
    const { services } = makeServices();
    const made = await services.auth.register(sign(undefined));
    assert.equal(made.user.username, 'masha');
  });
});

describe('signing up by invitation, over HTTP', () => {
  it('says sign-ups are by invitation, and takes the code with the name and password', async () => {
    const { app, services } = makeApp({ registration: 'invite' });
    assert.deepEqual(await (await call(app, 'GET', '/api/auth/options')).json(), { registration: 'invite' });
    const without = await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: PASSWORD } });
    assert.equal(without.status, 400);
    const { code } = await services.auth.invite('', null);
    const made = await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: PASSWORD, invite: code } });
    assert.equal(made.status, 201);
  });
});

describe('the browsers signed in to an account', () => {
  const login = async (app: Awaited<ReturnType<typeof makeApp>>['app'], ua: string) =>
    sessionCookie(await call(app, 'POST', '/api/auth/login', { body: { username: 'kirill', password: PASSWORD }, headers: { 'user-agent': ua } }));
  type List = { sessions: Array<{ id: string; userAgent: string | null; current: boolean }> };

  it('lists them, the one asking marked, with nothing that could sign anyone in', async () => {
    const { app, services } = makeApp();
    await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    const ipad = await login(app, 'iPad Safari');
    const phone = await login(app, 'iPhone Safari');
    const list = (await (await call(app, 'GET', '/api/auth/sessions', { cookie: ipad })).json()) as List;
    assert.equal(list.sessions.length, 3);
    assert.deepEqual(list.sessions.filter((s) => s.current).map((s) => s.userAgent), ['iPad Safari']);
    const raw = JSON.stringify(list);
    for (const cookie of [ipad, phone]) assert.ok(!raw.includes(cookie.split('=')[1]!.split(';')[0]!));
  });

  it('signs one of them out, and then everyone else, but never someone else’s', async () => {
    const { app, services } = makeApp();
    await services.auth.register({ username: 'kirill', password: PASSWORD, userAgent: null });
    await services.auth.register({ username: 'masha', password: PASSWORD, userAgent: null });
    const ipad = await login(app, 'iPad Safari');
    const phone = await login(app, 'iPhone Safari');
    const masha = sessionCookie(await call(app, 'POST', '/api/auth/login', { body: { username: 'masha', password: PASSWORD } }));
    const list = (await (await call(app, 'GET', '/api/auth/sessions', { cookie: ipad })).json()) as List;
    const phoneId = list.sessions.find((s) => s.userAgent === 'iPhone Safari')!.id;
    assert.equal((await call(app, 'DELETE', `/api/auth/sessions/${phoneId}`, { cookie: masha })).status, 404);
    assert.equal((await call(app, 'DELETE', `/api/auth/sessions/${phoneId}`, { cookie: ipad })).status, 204);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: phone })).status, 401);
    const others = await call(app, 'POST', '/api/auth/sessions/others', { cookie: ipad });
    assert.deepEqual(await others.json(), { signedOut: 1 });
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: ipad })).status, 200);
    assert.equal((await call(app, 'GET', '/api/workspace', { cookie: masha })).status, 200);
  });

  it('is for somebody signed in', async () => {
    const { app } = makeApp();
    assert.equal((await call(app, 'GET', '/api/auth/sessions')).status, 401);
  });
});
