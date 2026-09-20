import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parseReply, relayOpening, turnPrompt, type TalkRequest } from '../../shared/talk';
import type { SpeechSynthesizer, Tutor } from '../src/application/ports';
import { createServices } from '../src/composition';
import { TutorUnavailableError } from '../src/domain/errors';
import { createHttpApp } from '../src/http/app';
import {
  API_KEY_HINT,
  childEnv,
  claudeTutor,
  findClaude,
  replyFrom,
  SIGN_IN_HINT,
  spawnRunner,
  stateFromAuth,
  type Runner,
} from '../src/infrastructure/claude-cli';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

const REPLY = { hanzi: '你好！你喜欢喝茶吗？', pinyin: 'nǐ hǎo nǐ xǐ huan hē chá ma', english: 'Hello! Do you like tea?' };

function stubTutor(state: Awaited<ReturnType<Tutor['status']>> = 'ready') {
  const asked: TalkRequest[] = [];
  const tutor: Tutor = {
    status: async () => state,
    async reply(req) {
      asked.push(req);
      if (state !== 'ready') throw new TutorUnavailableError(SIGN_IN_HINT);
      return REPLY;
    },
  };
  return { tutor, asked };
}

function stubVoices() {
  const warmed: Array<string | undefined> = [];
  const voices: SpeechSynthesizer = {
    voices: [{ id: 'chen', name: 'Chen', gender: 'male' }],
    async synthesize(text, voice) {
      return new TextEncoder().encode(`mp3:${voice}:${text}`);
    },
    warm: (v) => warmed.push(v),
  };
  return { voices, warmed };
}

function appWith(tutor: Tutor | null, talkVoices: SpeechSynthesizer | null = null) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), {
    hasher: cheapHasher,
    clock: new TestClock(),
    tutor,
    talkVoices,
  });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

async function signedIn(app: ReturnType<typeof appWith>) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } });
  return sessionCookie(res);
}

describe('talking with Claude over HTTP', () => {
  it('is only for somebody signed in', async () => {
    const app = appWith(stubTutor().tutor);
    assert.equal((await call(app, 'GET', '/api/talk')).status, 401);
    assert.equal((await call(app, 'POST', '/api/talk/reply', { body: { lines: [], level: 'hsk1' } })).status, 401);
  });

  it('says Claude is missing where there is no tutor, and lists no voices', async () => {
    const app = appWith(null);
    const res = await call(app, 'GET', '/api/talk', { cookie: await signedIn(app) });
    assert.deepEqual(await res.json(), { claude: { state: 'missing' }, voices: [] });
  });

  it('reports the tutor state and the voices, and warms the voice asked for', async () => {
    const { voices, warmed } = stubVoices();
    const app = appWith(stubTutor('signed-out').tutor, voices);
    const res = await call(app, 'GET', '/api/talk?voice=chen', { cookie: await signedIn(app) });
    assert.deepEqual(await res.json(), {
      claude: { state: 'signed-out' },
      voices: [{ id: 'chen', name: 'Chen', gender: 'male' }],
    });
    assert.deepEqual(warmed, ['chen']);
  });

  it('passes the conversation to Claude and returns its turn', async () => {
    const { tutor, asked } = stubTutor();
    const app = appWith(tutor);
    const lines = [
      { who: 'tutor', text: '你好！' },
      { who: 'learner', text: '你好，我喜欢和茶' },
    ];
    const res = await call(app, 'POST', '/api/talk/reply', { cookie: await signedIn(app), body: { lines, level: 'hsk2' } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), REPLY);
    assert.deepEqual(asked, [{ lines, level: 'hsk2' }]);
  });

  it('refuses a level it does not know and an empty line', async () => {
    const app = appWith(stubTutor().tutor);
    const cookie = await signedIn(app);
    const bad = (body: unknown) => call(app, 'POST', '/api/talk/reply', { cookie, body });
    assert.equal((await bad({ lines: [], level: 'hsk9' })).status, 400);
    assert.equal((await bad({ lines: [{ who: 'learner', text: '  ' }], level: 'hsk1' })).status, 400);
    assert.equal((await bad({ lines: [{ who: 'teacher', text: '好' }], level: 'hsk1' })).status, 400);
  });

  it('answers 503 with a reason the page can show when Claude cannot be asked', async () => {
    const app = appWith(stubTutor('signed-out').tutor);
    const res = await call(app, 'POST', '/api/talk/reply', {
      cookie: await signedIn(app),
      body: { lines: [], level: 'hsk1' },
    });
    assert.equal(res.status, 503);
    assert.match(((await res.json()) as { error: { message: string } }).error.message, /claude auth login/);

    const none = appWith(null);
    const res2 = await call(none, 'POST', '/api/talk/reply', { cookie: await signedIn(none), body: { lines: [], level: 'hsk1' } });
    assert.equal(res2.status, 503);
  });

  it('reads a sentence aloud in a local voice, and refuses voices it does not have', async () => {
    const app = appWith(null, stubVoices().voices);
    const cookie = await signedIn(app);
    const res = await call(app, 'GET', `/api/talk/audio?text=${encodeURIComponent('你好')}&voice=chen`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.equal(new TextDecoder().decode(await res.arrayBuffer()), 'mp3:chen:你好');
    assert.equal((await call(app, 'GET', '/api/talk/audio?text=x&voice=siri', { cookie })).status, 400);
    assert.equal((await call(appWith(null), 'GET', '/api/talk/audio?text=x', { cookie })).status, 401);
  });
});

describe('Claude Code as the tutor', () => {
  it('never hands the child an API key, another endpoint, or the host session', () => {
    const env = childEnv({
      HOME: '/Users/k',
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-api',
      ANTHROPIC_AUTH_TOKEN: 't',
      ANTHROPIC_BASE_URL: 'https://proxy',
      CLAUDECODE: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'subscription',
    });
    assert.deepEqual(env, {
      HOME: '/Users/k',
      PATH: '/usr/bin',
      CLAUDE_CODE_OAUTH_TOKEN: 'subscription',
      DISABLE_AUTOUPDATER: '1',
    });
  });

  it('reads auth status: a subscription is ready, an API key or a cloud provider is refused', () => {
    assert.equal(stateFromAuth('{"loggedIn":false,"authMethod":"none"}'), 'signed-out');
    assert.equal(stateFromAuth('not json'), 'signed-out');
    assert.equal(stateFromAuth('{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty"}'), 'ready');
    assert.equal(stateFromAuth('{"loggedIn":true,"authMethod":"oauth_token"}'), 'ready');
    assert.equal(stateFromAuth('{"loggedIn":true,"authMethod":"api_key"}'), 'api-key');
    assert.equal(stateFromAuth('{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"bedrock"}'), 'api-key');
  });

  it('takes the structured answer, and explains a signed-out CLI instead of failing blankly', () => {
    const ok = JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: REPLY });
    assert.deepEqual(replyFrom({ code: 0, stdout: ok, stderr: '' }), REPLY);

    const text = JSON.stringify({ is_error: false, result: '```json\n' + JSON.stringify(REPLY) + '\n```' });
    assert.deepEqual(replyFrom({ code: 0, stdout: text, stderr: '' }), REPLY);

    const out = JSON.stringify({ is_error: true, result: 'Not logged in · Please run /login' });
    assert.throws(() => replyFrom({ code: 1, stdout: out, stderr: '' }), { message: SIGN_IN_HINT });
    assert.throws(() => replyFrom({ code: 1, stdout: '', stderr: 'boom' }), /did not answer: boom/);
  });

  it('asks as a plain chat partner: no tools, no project setup, never --bare, the prompt on stdin', async () => {
    const runs: Array<{ args: string[]; input: string }> = [];
    const run: Runner = async (_bin, args, input) => {
      runs.push({ args, input });
      if (args[0] === 'auth') return { code: 0, stdout: '{"loggedIn":true,"authMethod":"claude.ai"}', stderr: '' };
      return { code: 0, stdout: JSON.stringify({ is_error: false, structured_output: REPLY }), stderr: '' };
    };
    const tutor = claudeTutor({ bin: () => '/bin/claude', model: 'sonnet', run });
    const lines = [{ who: 'learner' as const, text: '我想喝咖啡' }];
    assert.deepEqual(await tutor.reply({ lines, level: 'hsk1' }), REPLY);

    const { args, input } = runs[1]!;
    assert.ok(args.includes('-p') && args.includes('--safe-mode') && args.includes('--no-session-persistence'));
    assert.equal(args[args.indexOf('--tools') + 1], '');
    assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
    assert.ok(!args.includes('--bare'));
    assert.match(args[args.indexOf('--system-prompt') + 1]!, /HSK 1/);
    assert.equal(input, turnPrompt(lines));
    assert.match(input, /Learner: 我想喝咖啡/);
  });

  it('will not run a turn on an API key, and remembers the status only briefly', async () => {
    let now = 0;
    let method = 'api_key';
    let turns = 0;
    const run: Runner = async (_bin, args) => {
      if (args[0] === 'auth') return { code: 0, stdout: JSON.stringify({ loggedIn: true, authMethod: method }), stderr: '' };
      turns++;
      return { code: 0, stdout: JSON.stringify({ structured_output: REPLY }), stderr: '' };
    };
    const tutor = claudeTutor({ bin: () => '/bin/claude', model: 'sonnet', run, now: () => now });
    await assert.rejects(tutor.reply({ lines: [], level: 'hsk1' }), { message: API_KEY_HINT });
    assert.equal(turns, 0);

    method = 'claude.ai';
    assert.equal(await tutor.status(), 'api-key');
    now += 11_000;
    assert.equal(await tutor.status(), 'ready');
  });

  it('is missing when there is no claude program to run', async () => {
    const tutor = claudeTutor({ bin: () => null, model: 'sonnet', run: async () => assert.fail('ran') });
    assert.equal(await tutor.status(), 'missing');
    assert.equal(findClaude({ HANZI_CLAUDE_BIN: '/nowhere/claude' }), null);
  });

  it('really spawns with the short environment', { skip: process.platform === 'win32' }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'talk-test-'));
    const bin = join(dir, 'claude');
    writeFileSync(bin, '#!/bin/sh\ncat >/dev/null\n/usr/bin/env\n');
    chmodSync(bin, 0o755);
    const run = spawnRunner({ PATH: '/usr/bin:/bin', HOME: dir, ANTHROPIC_API_KEY: 'sk-ant-api' }, dir);
    const { stdout } = await run(bin, ['-p'], 'hello', 5_000);
    assert.match(stdout, /DISABLE_AUTOUPDATER=1/);
    assert.doesNotMatch(stdout, /ANTHROPIC/);
  });
});

describe("reading Claude's answer back", () => {
  it('takes JSON, fenced or not', () => {
    assert.deepEqual(parseReply(JSON.stringify(REPLY)), REPLY);
    assert.deepEqual(parseReply('```json\n' + JSON.stringify(REPLY) + '\n```'), REPLY);
  });

  it('takes the three lines, whatever labels the chat put on them', () => {
    const pasted = [
      '**Line 1:** 你好！你喜欢喝茶吗？',
      '2. nǐ hǎo nǐ xǐ huan hē chá ma',
      'English: Hello! Do you like tea?',
    ].join('\n');
    assert.deepEqual(parseReply(pasted), REPLY);
  });

  it('keeps the Chinese even when pinyin and English are missing, and gives up without any', () => {
    assert.deepEqual(parseReply('好的。'), { hanzi: '好的。', pinyin: '', english: '' });
    assert.equal(parseReply('Sorry, I cannot help with that.'), null);
  });

  it('gives the chat its instructions and the conversation so far the first time', () => {
    const first = relayOpening('hsk1', [{ who: 'learner', text: '你好' }]);
    assert.match(first, /exactly three lines/);
    assert.match(first, /Learner: 你好/);
    assert.match(relayOpening('hsk2', []), /Open the conversation now/);
  });
});
