import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { call, makeApp, sessionCookie, type TestApp } from './support';

async function signedIn(app: TestApp, username: string) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } });
  return sessionCookie(res);
}

const voice = { id: 'minimax-serene', name: 'Serene · MiniMax', gender: 'female' as const };
const mp3 = (n: number) => Buffer.from(new Uint8Array(400).fill(n)).toString('base64');
const audio = (text: string) => `/api/talk/audio?voice=${voice.id}&mode=teaching&text=${encodeURIComponent(text)}`;

describe('recordings made elsewhere', () => {
  it('are kept from the admin account, read again in place of the old, and played to anyone signed in', async () => {
    const { app } = makeApp();
    const admin = await signedIn(app, 'admin');
    const other = await signedIn(app, 'masha');
    const put = (cookie: string, n: number) => call(app, 'PUT', '/api/talk/recordings', { cookie, body: { voice, text: ' 他没有生病。 ', mp3: mp3(n) } });

    assert.equal((await put(other, 1)).status, 403);
    assert.equal((await put(admin, 1)).status, 200);
    assert.equal((await put(admin, 2)).status, 200);

    const res = await call(app, 'GET', audio('他没有生病。'), { cookie: other });
    assert.equal(res.status, 200);
    assert.equal(new Uint8Array(await res.arrayBuffer())[0], 2);

    const status = await call(app, 'GET', '/api/talk', { cookie: other });
    assert.ok(((await status.json()) as { voices: Array<{ id: string; recorded?: boolean }> }).voices.some((v) => v.id === voice.id && v.recorded));
  });

  it('refuses a voice name that is not a plain id, and an empty recording', async () => {
    const { app } = makeApp();
    const admin = await signedIn(app, 'admin');
    const bad = await call(app, 'PUT', '/api/talk/recordings', { cookie: admin, body: { voice: { ...voice, id: 'Serene Voice' }, text: '你好。', mp3: mp3(1) } });
    assert.equal(bad.status, 400);
    const empty = await call(app, 'PUT', '/api/talk/recordings', { cookie: admin, body: { voice, text: '你好。', mp3: 'AAAA' } });
    assert.equal(empty.status, 400);
  });
});
