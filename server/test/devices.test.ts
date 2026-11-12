import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SessionsResponse } from '../../shared/api';
import { call, makeApp, sessionCookie } from './support';

const DAY = 86_400_000;
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

async function setUp() {
  const made = makeApp();
  await call(made.app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' }, headers: { 'user-agent': IPAD } });
  const signIn = async (ua: string) =>
    sessionCookie(await call(made.app, 'POST', '/api/auth/login', { body: { username: 'masha', password: 'correct horse' }, headers: { 'user-agent': ua } }));
  const devices = async (cookie: string) => ((await (await call(made.app, 'GET', '/api/auth/sessions', { cookie })).json()) as SessionsResponse).sessions;
  return { ...made, signIn, devices };
}

describe('the devices an account is signed in on', () => {
  it('lets the same browser’s old session go when it signs in again after a week', async () => {
    const { clock, signIn, devices } = await setUp();
    // An iPhone that loses its cookie every couple of weeks, ten times over.
    let last = '';
    for (let i = 0; i < 10; i++) {
      clock.advance(8 * DAY);
      last = await signIn(IPHONE);
    }
    const list = await devices(last);
    assert.equal(list.filter((s) => s.userAgent === IPHONE).length, 1, 'one iPhone, not ten');
  });

  it('keeps a session of the same browser used within the week: two tabs, two people on one iPad', async () => {
    const { clock, signIn, devices } = await setUp();
    const first = await signIn(IPHONE);
    clock.advance(2 * DAY);
    const second = await signIn(IPHONE);
    assert.equal((await devices(second)).filter((s) => s.userAgent === IPHONE).length, 2);
    assert.equal(((await devices(first)) as unknown[]).length > 0, true, 'the first still works');
  });

  it('keeps at most twenty, letting the least recently used go', async () => {
    const { clock, signIn, devices } = await setUp();
    let last = '';
    for (let i = 0; i < 25; i++) {
      clock.advance(60_000);
      last = await signIn(`Browser ${i}`);
    }
    const list = await devices(last);
    assert.equal(list.length, 20);
    assert.ok(!list.some((s) => s.userAgent === IPAD || s.userAgent === 'Browser 0'), 'the oldest went first');
    assert.ok(list.some((s) => s.userAgent === 'Browser 24'));
  });
});
