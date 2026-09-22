import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_OPTIONS,
  parseReply,
  relayOpening,
  replySchema,
  turnPrompt,
  tutorInstructions,
  type TalkOptions,
  type TalkRequest,
} from '../../shared/talk';
import type { TalkSynthesizer, Tutor } from '../src/application/ports';
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

const OPTIONS: TalkOptions = { ...DEFAULT_OPTIONS, words: false, hints: false };

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
    async ask() {
      if (state !== 'ready') throw new TutorUnavailableError(SIGN_IN_HINT);
      return 'nothing to say here';
    },
  };
  return { tutor, asked };
}

function stubVoices() {
  const warmed: Array<string | undefined> = [];
  const asked: Array<{ text: string; voice: string; mode: string }> = [];
  const voices: TalkSynthesizer = {
    voices: [{ id: 'chen', name: 'Chen', gender: 'male' }],
    async synthesize(text, voice, mode) {
      asked.push({ text, voice, mode });
      return new TextEncoder().encode(`mp3:${voice}:${mode}:${text}`);
    },
    warm: (v) => warmed.push(v),
  };
  return { voices, warmed, asked };
}

function appWith(tutor: Tutor | null, talkVoices: TalkSynthesizer | null = null, clock: TestClock = new TestClock()) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), {
    hasher: cheapHasher,
    clock,
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
    assert.equal((await call(app, 'POST', '/api/talk/reply', { body: { lines: [], options: OPTIONS } })).status, 401);
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
    const options: TalkOptions = { ...OPTIONS, level: 'hsk2', length: 'long', topic: 'Food', explain: true };
    const res = await call(app, 'POST', '/api/talk/reply', { cookie: await signedIn(app), body: { lines, options } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), REPLY);
    assert.deepEqual(asked, [{ lines, options }]);
  });

  it('refuses a level it does not know and an empty line', async () => {
    const app = appWith(stubTutor().tutor);
    const cookie = await signedIn(app);
    const bad = (body: unknown) => call(app, 'POST', '/api/talk/reply', { cookie, body });
    assert.equal((await bad({ lines: [], options: { ...OPTIONS, level: 'hsk9' } })).status, 400);
    assert.equal((await bad({ lines: [], options: { ...OPTIONS, length: 'epic' } })).status, 400);
    assert.equal((await bad({ lines: [], options: { ...OPTIONS, topic: 'x'.repeat(61) } })).status, 400);
    assert.equal((await bad({ lines: [{ who: 'learner', text: '  ' }], options: OPTIONS })).status, 400);
    assert.equal((await bad({ lines: [{ who: 'teacher', text: '好' }], options: OPTIONS })).status, 400);
    assert.equal((await bad({ lines: [], level: 'hsk1' })).status, 400);
  });

  it('answers 503 with a reason the page can show when Claude cannot be asked', async () => {
    const app = appWith(stubTutor('signed-out').tutor);
    const res = await call(app, 'POST', '/api/talk/reply', {
      cookie: await signedIn(app),
      body: { lines: [], options: OPTIONS },
    });
    assert.equal(res.status, 503);
    assert.match(((await res.json()) as { error: { message: string } }).error.message, /claude auth login/);

    const none = appWith(null);
    const res2 = await call(none, 'POST', '/api/talk/reply', { cookie: await signedIn(none), body: { lines: [], options: OPTIONS } });
    assert.equal(res2.status, 503);
  });

  it('reads a sentence aloud in a local voice, and refuses voices it does not have', async () => {
    const app = appWith(null, stubVoices().voices);
    const cookie = await signedIn(app);
    const res = await call(app, 'GET', `/api/talk/audio?text=${encodeURIComponent('你好')}&voice=chen`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.equal(new TextDecoder().decode(await res.arrayBuffer()), 'mp3:chen:conversation:你好');
    assert.equal((await call(app, 'GET', '/api/talk/audio?text=x&voice=siri', { cookie })).status, 400);
    assert.equal((await call(appWith(null), 'GET', '/api/talk/audio?text=x', { cookie })).status, 401);
  });

  it('reads it the way the mode asks, and ignores a mode it does not know', async () => {
    const stub = stubVoices();
    const app = appWith(null, stub.voices);
    const cookie = await signedIn(app);
    const say = (mode: string) =>
      call(app, 'GET', `/api/talk/audio?text=${encodeURIComponent('你好')}&voice=chen&mode=${mode}`, { cookie });
    for (const mode of ['breakdown', 'teaching', 'conversation', 'skim']) assert.equal((await say(mode)).status, 200);
    assert.deepEqual(
      stub.asked.map((a) => a.mode),
      ['breakdown', 'teaching', 'conversation', 'skim'],
    );
    // Anything else is somebody's stale link, not a fifth way of reading.
    await say('screaming');
    assert.equal(stub.asked.at(-1)!.mode, 'conversation');
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
    assert.deepEqual(await tutor.reply({ lines, options: OPTIONS }), REPLY);

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
    await assert.rejects(tutor.reply({ lines: [], options: OPTIONS }), { message: API_KEY_HINT });
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

describe('what the learner asked Claude for', () => {
  it('asks only for the extras that are switched on', () => {
    const plain = replySchema(OPTIONS);
    assert.deepEqual(plain.required, ['hanzi', 'pinyin', 'english']);

    const all = replySchema({ ...OPTIONS, words: true, hints: true, explain: true });
    assert.deepEqual(all.required, ['hanzi', 'pinyin', 'english', 'words', 'hints', 'note']);
    assert.ok(all.properties.words && all.properties.hints && all.properties.note);
  });

  it('puts the length and the topic into the instructions', () => {
    assert.match(tutorInstructions({ ...OPTIONS, length: 'short' }), /One short sentence a turn/);
    assert.match(tutorInstructions({ ...OPTIONS, length: 'long' }), /Three or four short sentences/);

    const onFood = tutorInstructions({ ...OPTIONS, topic: 'The food I like' });
    assert.match(onFood, /stay on it unless they change the subject: The food I like/);
    assert.doesNotMatch(onFood, /Opening the conversation: greet/);
    assert.match(tutorInstructions(OPTIONS), /Opening the conversation: greet/);
  });

  it('tells Claude who the voice is, and to be calm whoever it is', () => {
    const soft = tutorInstructions({ ...OPTIONS, persona: 'chen' });
    assert.match(soft, /You are Chen, a calm and gentle young man/);
    assert.match(soft, /Your name in Chinese is 陈/);
    assert.match(soft, /Avoid exclamation marks/);

    // The system voice, an old conversation, a voice since removed: nobody in particular.
    for (const persona of [undefined, 'nobody']) {
      const plain = tutorInstructions({ ...OPTIONS, persona });
      assert.doesNotMatch(plain, /Your name in Chinese/);
      assert.match(plain, /Avoid exclamation marks/);
    }
  });

  it('asks the chat for the same extras, in labelled lines it can paste back', () => {
    const chatty = relayOpening({ ...OPTIONS, words: true, hints: true, explain: true }, []);
    assert.match(chatty, /Chinese: your turn/);
    assert.match(chatty, /^Words: /m);
    assert.match(chatty, /^Say: /m);
    assert.match(chatty, /^Note: /m);
    assert.doesNotMatch(relayOpening(OPTIONS, []), /^(Words|Say|Note): /m);
  });
});

describe("reading Claude's answer back", () => {
  it('takes JSON, fenced or not', () => {
    assert.deepEqual(parseReply(JSON.stringify(REPLY)), REPLY);
    assert.deepEqual(parseReply('```json\n' + JSON.stringify(REPLY) + '\n```'), REPLY);
  });

  it('takes the lines whatever a chat numbered, bulleted or bolded them with', () => {
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

  it('takes the new words, the suggestions and the note out of JSON', () => {
    const reply = parseReply(
      JSON.stringify({
        ...REPLY,
        words: [{ hanzi: '茶', pinyin: 'chá', english: 'tea' }, { hanzi: '', pinyin: 'x', english: 'y' }],
        hints: [{ hanzi: '我喜欢喝茶。', pinyin: 'wǒ xǐ huan hē chá', english: 'I like tea.' }],
        note: '喜欢 is followed straight by the verb.',
      }),
    );
    assert.deepEqual(reply?.words, [{ hanzi: '茶', pinyin: 'chá', english: 'tea' }]);
    assert.equal(reply?.hints?.[0]?.hanzi, '我喜欢喝茶。');
    assert.match(reply?.note ?? '', /straight by the verb/);
  });

  it('takes them out of the labelled lines a chat writes, however it lists them', () => {
    const pasted = [
      'Chinese: 你好！你喜欢喝茶吗？',
      'Pinyin: nǐ hǎo nǐ xǐ huan hē chá ma',
      'English: Hello! Do you like tea?',
      'Words: 茶 chá — tea; 喜欢 xǐ huan — to like',
      'Say:',
      '- 我喜欢喝茶。wǒ xǐ huan hē chá — I like tea.',
      '- 我不喜欢。wǒ bù xǐ huan — I do not.',
      'Note: 吗 turns a statement into a question.',
    ].join('\n');
    const reply = parseReply(pasted)!;
    assert.equal(reply.hanzi, REPLY.hanzi);
    assert.equal(reply.pinyin, REPLY.pinyin);
    assert.equal(reply.english, REPLY.english);
    assert.deepEqual(reply.words, [
      { hanzi: '茶', pinyin: 'chá', english: 'tea' },
      { hanzi: '喜欢', pinyin: 'xǐ huan', english: 'to like' },
    ]);
    assert.deepEqual(reply.hints, [
      { hanzi: '我喜欢喝茶。', pinyin: 'wǒ xǐ huan hē chá', english: 'I like tea.' },
      { hanzi: '我不喜欢。', pinyin: 'wǒ bù xǐ huan', english: 'I do not.' },
    ]);
    assert.match(reply.note ?? '', /turns a statement/);
  });

  it('gives the chat its instructions and the conversation so far the first time', () => {
    const first = relayOpening(OPTIONS, [{ who: 'learner', text: '你好' }]);
    assert.match(first, /labelled lines/);
    assert.match(first, /Learner: 你好/);
    assert.match(relayOpening({ ...OPTIONS, level: 'hsk2' }, []), /Open the conversation now/);
  });
});

describe('conversations that are kept', () => {
  const OPENING = {
    who: 'tutor' as const,
    hanzi: '你好！你吃早饭了吗？',
    pinyin: 'nǐ hǎo nǐ chī zǎo fàn le ma',
    english: 'Hello! Have you had breakfast?',
  };

  async function started(app: ReturnType<typeof appWith>, cookie: string, options = OPTIONS) {
    const res = await call(app, 'POST', '/api/talk/conversations', { cookie, body: { options, voice: 'chen' } });
    assert.equal(res.status, 201);
    return (await res.json()) as { id: string; title: string; turns: unknown[] };
  }

  it('is only for somebody signed in', async () => {
    const app = appWith(stubTutor().tutor);
    assert.equal((await call(app, 'GET', '/api/talk/conversations')).status, 401);
    assert.equal((await call(app, 'POST', '/api/talk/conversations', { body: {} })).status, 401);
  });

  it('starts empty, takes the turns as they are said, and gives them back', async () => {
    const app = appWith(stubTutor().tutor);
    const cookie = await signedIn(app);
    const made = await started(app, cookie);
    assert.deepEqual(made.turns, []);

    const saved = await call(app, 'PUT', `/api/talk/conversations/${made.id}`, {
      cookie,
      body: { options: OPTIONS, voice: 'chen', turns: [OPENING] },
    });
    assert.equal(saved.status, 200);

    const again = await call(app, 'GET', `/api/talk/conversations/${made.id}`, { cookie });
    const body = (await again.json()) as { turns: Array<{ hanzi: string }>; options: TalkOptions; voice: string };
    assert.equal(body.turns.length, 1);
    assert.equal(body.turns[0]?.hanzi, OPENING.hanzi);
    // The settings are the point of keeping it: picked up again, it is the same conversation.
    assert.deepEqual(body.options, OPTIONS);
    assert.equal(body.voice, 'chen');
  });

  it('names itself after the topic, and after the opening line when there is none', async () => {
    const app = appWith(stubTutor().tutor);
    const cookie = await signedIn(app);

    const onTopic = await started(app, cookie, { ...OPTIONS, topic: 'Food & drink' });
    assert.equal(onTopic.title, 'Food & drink');

    const open = await started(app, cookie, { ...OPTIONS, topic: '' });
    assert.equal(open.title, 'New conversation');
    await call(app, 'PUT', `/api/talk/conversations/${open.id}`, {
      cookie,
      body: { options: { ...OPTIONS, topic: '' }, voice: null, turns: [OPENING] },
    });
    const list = await call(app, 'GET', '/api/talk/conversations', { cookie });
    const { conversations } = (await list.json()) as { conversations: Array<{ id: string; title: string; turns: number }> };
    const row = conversations.find((x) => x.id === open.id);
    assert.equal(row?.title, OPENING.hanzi);
    assert.equal(row?.turns, 1);
  });

  it('lists the newest first, and forgets one when it is thrown away', async () => {
    const clock = new TestClock();
    const app = appWith(stubTutor().tutor, null, clock);
    const cookie = await signedIn(app);
    const first = await started(app, cookie, { ...OPTIONS, topic: 'Weather' });
    clock.advance(60_000);
    const second = await started(app, cookie, { ...OPTIONS, topic: 'Family' });

    const list = async () => {
      const res = await call(app, 'GET', '/api/talk/conversations', { cookie });
      return ((await res.json()) as { conversations: Array<{ id: string }> }).conversations.map((x) => x.id);
    };
    assert.deepEqual(await list(), [second.id, first.id]);

    assert.equal((await call(app, 'DELETE', `/api/talk/conversations/${second.id}`, { cookie })).status, 204);
    assert.deepEqual(await list(), [first.id]);
    assert.equal((await call(app, 'GET', `/api/talk/conversations/${second.id}`, { cookie })).status, 404);
  });

  it('keeps each account to its own conversations', async () => {
    const app = appWith(stubTutor().tutor);
    const mine = await signedIn(app);
    const made = await started(app, mine);

    const theirs = sessionCookie(
      await call(app, 'POST', '/api/auth/register', { body: { username: 'someone-else', password: 'correct horse' } }),
    );
    // Not 403: whose it is, is not something a stranger gets to learn.
    assert.equal((await call(app, 'GET', `/api/talk/conversations/${made.id}`, { cookie: theirs })).status, 404);
    assert.equal(
      (await call(app, 'PUT', `/api/talk/conversations/${made.id}`, {
        cookie: theirs,
        body: { options: OPTIONS, voice: null, turns: [] },
      })).status,
      404,
    );
    assert.equal((await call(app, 'DELETE', `/api/talk/conversations/${made.id}`, { cookie: theirs })).status, 404);

    const list = await call(app, 'GET', '/api/talk/conversations', { cookie: theirs });
    assert.deepEqual(((await list.json()) as { conversations: unknown[] }).conversations, []);
  });
});
