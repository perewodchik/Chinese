import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppError } from '../src/domain/errors';
import { makeServices } from './support';

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
