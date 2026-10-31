import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Narrator, VoiceTuning } from '../src/application/ports';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { NarratorRefused } from '../src/infrastructure/minimax';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const GOOD = 'sk-api-good-key-0123456789';

function stub() {
  const read: Array<{ text: string; voice: string; tuning: VoiceTuning }> = [];
  const whole: string[] = [];
  const narrator: Narrator = {
    async voices(key) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      return [
        { id: 'Chinese (Mandarin)_News_Anchor', name: 'News Anchor (Female)', description: 'A professional female news anchor' },
        { id: 'Chinese (Mandarin)_Reliable_Executive', name: 'Steady Executive', description: 'A steady male executive' },
      ];
    },
    async design(key, prompt) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      return { voiceId: `designed-${prompt.length}`, trial: new Uint8Array(300).fill(3) };
    },
    async readText(key, text) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      whole.push(text);
      // 8000 bytes at 64 kbit/s: a second of audio; two sentences, half a second each.
      return { audio: new Uint8Array(8000).fill(9), segments: [{ text: '你好。', start: 0, end: 400 }, { text: '我很好。', start: 600, end: 1000 }] };
    },
    async read(key, text, voice, tuning) {
      if (key !== GOOD) throw new NarratorRefused('MiniMax did not accept the key.', 'key');
      read.push({ text, voice, tuning });
      return new Uint8Array(500).fill(7);
    },
  };
  return { narrator, read, whole };
}

function appWith(narrator: Narrator) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), narrator });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

async function signedIn(app: ReturnType<typeof appWith>, username = 'admin') {
  return sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
}

describe('reading texts aloud with MiniMax and the learner’s key', () => {
  it('keeps a key only once MiniMax accepts it, and never sends it back', async () => {
    const app = appWith(stub().narrator);
    const cookie = await signedIn(app);
    assert.deepEqual(await (await call(app, 'GET', '/api/narration', { cookie })).json(), { key: { set: false, hint: null } });
    assert.equal((await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: 'sk-api-wrong-key-000000000' } })).status, 400);
    assert.equal((await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: ` ${GOOD} ` } })).status, 200);
    const status = await (await call(app, 'GET', '/api/narration', { cookie })).json();
    assert.deepEqual(status, { key: { set: true, hint: '…6789' } });
    assert.ok(!JSON.stringify(status).includes(GOOD));
    await call(app, 'DELETE', '/api/narration/key', { cookie });
    assert.equal(((await (await call(app, 'GET', '/api/narration', { cookie })).json()) as { key: { set: boolean } }).key.set, false);
  });

  it('makes a narrator from a description, tunes it, and reads a whole text with it, kept so it is paid for once', async () => {
    const { narrator, read, whole } = stub();
    const app = appWith(narrator);
    const cookie = await signedIn(app);
    assert.equal((await call(app, 'POST', '/api/narration/narrators/design', { cookie, body: { name: 'Tutor', prompt: 'A calm young man from Beijing', previewText: '你好。' } })).status, 404);
    await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: GOOD } });

    const made = await call(app, 'POST', '/api/narration/narrators/design', { cookie, body: { name: 'Tutor', prompt: 'A calm young man from Beijing', previewText: '你好。' } });
    assert.equal(made.status, 200);
    const { narrator: tutor, trial } = (await made.json()) as { narrator: { id: string; recordingId: string; voiceId: string }; trial: string };
    assert.equal(tutor.voiceId, 'designed-29');
    assert.equal(Buffer.from(trial, 'base64').length, 300);

    const changed = await call(app, 'PATCH', `/api/narration/narrators/${tutor.id}`, { cookie, body: { speed: 0.85, pitch: -2, emotion: 'calm' } });
    assert.deepEqual(
      ((await changed.json()) as { narrator: { speed: number; pitch: number; emotion: string } }).narrator,
      { ...((await (await call(app, 'GET', '/api/narration/narrators', { cookie })).json()) as { narrators: object[] }).narrators[0], speed: 0.85, pitch: -2, emotion: 'calm' },
    );

    const preview = await call(app, 'POST', `/api/narration/narrators/${tutor.id}/preview`, { cookie, body: { text: '慢慢说。' } });
    assert.equal(preview.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual(read.at(-1)!.tuning, { speed: 0.85, pitch: -2, emotion: 'calm' });

    // A whole text, read in one request when asked, and kept.
    const lines = ['你好。', '我很好。'];
    const none = await call(app, 'POST', '/api/narration/texts', { cookie, body: { narrator: tutor.id, lines } });
    assert.deepEqual(await none.json(), { narration: null });
    const made2 = await call(app, 'POST', '/api/narration/texts', { cookie, body: { narrator: tutor.id, lines, generate: true } });
    const { narration } = (await made2.json()) as { narration: { key: string; durationMs: number; timings: Array<[number, number]> } };
    assert.equal(narration.durationMs, 1000);
    assert.deepEqual(narration.timings, [[0, 400], [600, 1000]]);
    assert.equal(whole.length, 1);
    assert.match(whole[0]!, /你好。 <#0.6#> 我很好。/);

    // Asked again: the kept reading, MiniMax not asked.
    await call(app, 'POST', '/api/narration/texts', { cookie, body: { narrator: tutor.id, lines, generate: true } });
    assert.equal(whole.length, 1);
    const of = (await (await call(app, 'POST', '/api/narration/texts/of', { cookie, body: { lines } })).json()) as { narrations: Array<{ key: string }> };
    assert.deepEqual(of.narrations.map((n) => n.key), [narration.key]);
    const audio = await call(app, 'GET', `/api/narration/texts/${narration.key}/audio`, { cookie });
    assert.equal(audio.status, 200);
    assert.equal((await audio.arrayBuffer()).byteLength, 8000);

    // Read again on purpose: MiniMax asked again. Changed: a new reading, none kept for it yet.
    await call(app, 'POST', '/api/narration/texts', { cookie, body: { narrator: tutor.id, lines, again: true } });
    assert.equal(whole.length, 2);
    await call(app, 'PATCH', `/api/narration/narrators/${tutor.id}`, { cookie, body: { speed: 0.8 } });
    assert.deepEqual(await (await call(app, 'POST', '/api/narration/texts/of', { cookie, body: { lines } })).json(), { narrations: [] });

    // Nobody else hears it.
    const other = await signedIn(app, 'masha');
    assert.equal((await call(app, 'GET', `/api/narration/texts/${narration.key}/audio`, { cookie: other })).status, 404);
  });

  it('adopts one of MiniMax’s voices; nobody else sees or reads with a learner’s narrator', async () => {
    const app = appWith(stub().narrator);
    const cookie = await signedIn(app);
    await call(app, 'PUT', '/api/narration/key', { cookie, body: { key: GOOD } });
    const res = await call(app, 'POST', '/api/narration/narrators', { cookie, body: { name: '', voice: 'Chinese (Mandarin)_News_Anchor' } });
    const { narrator } = (await res.json()) as { narrator: { id: string; name: string } };
    assert.equal(narrator.name, 'News Anchor');
    assert.equal((await call(app, 'POST', '/api/narration/narrators', { cookie, body: { name: 'x', voice: 'Nobody' } })).status, 400);

    const other = await signedIn(app, 'masha');
    assert.deepEqual(await (await call(app, 'GET', '/api/narration/narrators', { cookie: other })).json(), { narrators: [] });
    assert.equal((await call(app, 'DELETE', `/api/narration/narrators/${narrator.id}`, { cookie: other })).status, 404);
    assert.equal((await call(app, 'DELETE', `/api/narration/narrators/${narrator.id}`, { cookie })).status, 200);
  });
});

describe('where each line falls in a reading', () => {
  it('follows the service’s sentences, characters only, and scales when the counts differ', async () => {
    const { timingsFor } = await import('../src/application/narration-service');
    assert.deepEqual(timingsFor(['你好。', '我很好！'], [{ text: '你好。', start: 0, end: 400 }, { text: '我很好！ (laughs)', start: 600, end: 1000 }], 1000), [[0, 400], [600, 1000]]);
    // No times from the service: the reading is one run, the lines by their length.
    assert.deepEqual(timingsFor(['你好', '我很好呀'], null, 1200), [[0, 400], [400, 1200]]);
  });
});
