import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SpeechSynthesizer } from '../src/application/ports';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { azureSpeech, speechFromEnv } from '../src/infrastructure/azure-speech';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

/** A synthesizer that says what it was asked, as bytes, and remembers being asked. */
function stubSpeech(fail = false) {
  const asked: Array<{ text: string; voice: string; slow: boolean }> = [];
  const speech: SpeechSynthesizer = {
    voices: [
      { id: 'xiaoxiao', name: 'Xiaoxiao', gender: 'female' },
      { id: 'yunxi', name: 'Yunxi', gender: 'male' },
    ],
    async synthesize(text, voice, slow) {
      asked.push({ text, voice, slow });
      if (fail) throw new Error('down');
      return new TextEncoder().encode(`mp3:${voice}:${text}`);
    },
  };
  return { speech, asked };
}

function appWith(speech: SpeechSynthesizer | null) {
  const clock = new TestClock();
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock, speech });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

async function signedIn(app: ReturnType<typeof appWith>) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } });
  return sessionCookie(res);
}

const audio = (text: string, extra = '') => `/api/speech/audio?text=${encodeURIComponent(text)}${extra}`;

describe('reading aloud', () => {
  it('is only for somebody signed in', async () => {
    const app = appWith(stubSpeech().speech);
    assert.equal((await call(app, 'GET', '/api/speech')).status, 401);
    assert.equal((await call(app, 'GET', audio('你好'))).status, 401);
  });

  it('lists the voices, or none when nothing is set up', async () => {
    const on = appWith(stubSpeech().speech);
    const res = await call(on, 'GET', '/api/speech', { cookie: await signedIn(on) });
    assert.deepEqual(((await res.json()) as { voices: Array<{ id: string }> }).voices.map((v) => v.id), [
      'xiaoxiao',
      'yunxi',
    ]);

    const off = appWith(null);
    const none = await call(off, 'GET', '/api/speech', { cookie: await signedIn(off) });
    assert.deepEqual(await none.json(), { voices: [] });
  });

  it('answers 404 for audio when no voice is set up', async () => {
    const off = appWith(null);
    const cookie = await signedIn(off);
    assert.equal((await call(off, 'GET', audio('你好'), { cookie })).status, 404);
  });

  it('returns an MP3 that the browser may keep for a year', async () => {
    const { speech, asked } = stubSpeech();
    const app = appWith(speech);
    const res = await call(app, 'GET', audio('水果', '&voice=yunxi&slow=1'), { cookie: await signedIn(app) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.match(res.headers.get('cache-control') ?? '', /private.*max-age=31536000/);
    assert.equal(new TextDecoder().decode(await res.arrayBuffer()), 'mp3:yunxi:水果');
    assert.deepEqual(asked, [{ text: '水果', voice: 'yunxi', slow: true }]);
  });

  it('refuses empty text, long text and voices it does not have', async () => {
    const app = appWith(stubSpeech().speech);
    const cookie = await signedIn(app);
    assert.equal((await call(app, 'GET', audio('  '), { cookie })).status, 400);
    assert.equal((await call(app, 'GET', audio('好'.repeat(241)), { cookie })).status, 400);
    assert.equal((await call(app, 'GET', audio('好', '&voice=alexa'), { cookie })).status, 400);
  });

  it('says so, rather than failing blankly, when the voice service is down', async () => {
    const app = appWith(stubSpeech(true).speech);
    const res = await call(app, 'GET', audio('你好'), { cookie: await signedIn(app) });
    assert.equal(res.status, 500);
    assert.match(((await res.json()) as { error: { message: string } }).error.message, /system voice/);
  });
});

describe('the Azure synthesizer', () => {
  it('is only built when both the key and the region are set', () => {
    assert.equal(speechFromEnv({}), null);
    assert.equal(speechFromEnv({ AZURE_SPEECH_KEY: 'k' }), null);
    assert.ok(speechFromEnv({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'EastUS' }));
  });

  it('will not turn a strange region into a request to another host', () => {
    assert.throws(() => azureSpeech({ key: 'k', region: 'evil.example.com/x' }));
  });

  it('sends escaped SSML to the region, with the key and an MP3 format', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const synth = azureSpeech({
      key: 'secret',
      region: 'eastus',
      fetch: (async (url: string, init: RequestInit) => {
        seen = { url, init };
        return new Response(new Uint8Array([1, 2, 3]));
      }) as unknown as typeof fetch,
    });
    const bytes = await synth.synthesize('<你好>&', 'xiaoxiao', true);
    assert.deepEqual([...bytes], [1, 2, 3]);
    const s = seen!;
    assert.equal(s.url, 'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
    const headers = s.init.headers as Record<string, string>;
    assert.equal(headers['Ocp-Apim-Subscription-Key'], 'secret');
    assert.match(headers['X-Microsoft-OutputFormat']!, /mp3/);
    assert.match(String(s.init.body), /&lt;你好&gt;&amp;/);
    assert.match(String(s.init.body), /zh-CN-XiaoxiaoNeural/);
    assert.match(String(s.init.body), /rate="-25%"/);
  });

  it('reports an error status instead of returning it as audio', async () => {
    const synth = azureSpeech({
      key: 'wrong',
      region: 'eastus',
      fetch: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch,
    });
    await assert.rejects(synth.synthesize('你好', 'xiaoxiao', false), /401/);
  });
});
