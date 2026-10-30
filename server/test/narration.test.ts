import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Narrator } from '../src/application/ports';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { NarratorRefused } from '../src/infrastructure/minimax';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const GOOD = 'sk-api-good-key-0123456789';

function stub() {
  const read: Array<{ text: string; voice: string }> = [];
  const narrator: Narrator = {
    async voices(key) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      return [
        { id: 'Chinese (Mandarin)_News_Anchor', name: 'News Anchor (Female)', description: 'A professional female news anchor' },
        { id: 'Chinese (Mandarin)_Reliable_Executive', name: 'Steady Executive', description: 'A steady male executive' },
      ];
    },
    async read(key, text, voice) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      read.push({ text, voice });
      return new Uint8Array(500).fill(7);
    },
  };
  return { narrator, read };
}

function appWith(narrator: Narrator) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), narrator });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

async function signedIn(app: ReturnType<typeof appWith>) {
  return sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'admin', password: 'correct horse' } }));
}

describe('reading texts aloud with MiniMax and the learner’s key', () => {
  it('keeps a key only once MiniMax accepts it, and never sends it back', async () => {
    const app = appWith(stub().narrator);
    const cookie = await signedIn(app);
    assert.deepEqual(await (await call(app, 'GET', '/api/narration', { cookie })).json(), { key: { set: false, hint: null } });

    const bad = await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: 'sk-api-wrong-key-000000000' } });
    assert.equal(bad.status, 400);

    const ok = await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: ` ${GOOD} ` } });
    assert.equal(ok.status, 200);
    const status = await (await call(app, 'GET', '/api/narration', { cookie })).json();
    assert.deepEqual(status, { key: { set: true, hint: '…6789' } });
    assert.ok(!JSON.stringify(status).includes(GOOD));

    await call(app, 'DELETE', '/api/narration/key', { cookie });
    assert.equal(((await (await call(app, 'GET', '/api/narration', { cookie })).json()) as { key: { set: boolean } }).key.set, false);
  });

  it('lists the voices and reads a sentence into a recording Listen can play, with the sound the sentence names', async () => {
    const { narrator, read } = stub();
    const app = appWith(narrator);
    const cookie = await signedIn(app);
    assert.equal((await call(app, 'GET', '/api/narration/voices', { cookie })).status, 404);
    await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: GOOD } });

    const voices = (await (await call(app, 'GET', '/api/narration/voices', { cookie })).json()) as { voices: Array<{ id: string; gender: string }> };
    assert.deepEqual(voices.voices.map((v) => v.gender), ['female', 'male']);

    const res = await call(app, 'POST', '/api/narration/line', { cookie, body: { voice: 'Chinese (Mandarin)_News_Anchor', text: '医生看了看皮卡丘，笑了。' } });
    assert.equal(res.status, 200);
    const { recordedAs } = (await res.json()) as { recordedAs: string };
    assert.equal(recordedAs, 'mm-chinese-mandarin-news-anchor');
    assert.equal(read[0]!.text, '医生看了看皮卡丘，笑了。 (chuckle)');

    const audio = await call(app, 'GET', `/api/talk/audio?voice=${recordedAs}&mode=teaching&text=${encodeURIComponent('医生看了看皮卡丘，笑了。')}`, { cookie });
    assert.equal(audio.status, 200);
    const talk = (await (await call(app, 'GET', '/api/talk', { cookie })).json()) as { voices: Array<{ id: string; name: string }> };
    assert.deepEqual(talk.voices.map((v) => v.name), ['News Anchor · MiniMax']);
  });

  it('refuses a voice MiniMax does not have', async () => {
    const app = appWith(stub().narrator);
    const cookie = await signedIn(app);
    await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: GOOD } });
    const res = await call(app, 'POST', '/api/narration/line', { cookie, body: { voice: 'Nobody', text: '你好。' } });
    assert.equal(res.status, 400);
  });
});
