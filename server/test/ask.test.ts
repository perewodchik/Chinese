import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ASK_MAX_CHARS, ASK_TIMEOUT_MS } from '../../shared/ask';
import type { Tutor } from '../src/application/ports';
import { createServices } from '../src/composition';
import { TutorUnavailableError } from '../src/domain/errors';
import { createHttpApp } from '../src/http/app';
import { answerFrom, claudeTutor, SIGN_IN_HINT, type RunResult } from '../src/infrastructure/claude-cli';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

/** A tutor that answers an ask, and remembers what it was asked and for how long. */
function stubTutor(state: 'ready' | 'signed-out' = 'ready') {
  const asked: Array<{ prompt: string; timeoutMs?: number }> = [];
  const tutor: Tutor = {
    status: async () => state,
    reply: async () => assert.fail('the ask route must not ask for a conversation turn'),
    async ask(prompt, opts) {
      asked.push({ prompt, timeoutMs: opts?.timeoutMs });
      if (state !== 'ready') throw new TutorUnavailableError(SIGN_IN_HINT);
      return '```json\n{ "texts": [] }\n```';
    },
  };
  return { tutor, asked };
}

function appWith(tutor: Tutor | null) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), {
    hasher: cheapHasher,
    clock: new TestClock(),
    tutor,
  });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

async function signedIn(app: ReturnType<typeof appWith>) {
  const res = await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } });
  return sessionCookie(res);
}

describe('asking Claude for a piece of work', () => {
  it('is only for somebody signed in', async () => {
    const app = appWith(stubTutor().tutor);
    assert.equal((await call(app, 'GET', '/api/ask')).status, 401);
    assert.equal((await call(app, 'POST', '/api/ask', { body: { prompt: 'hi', kind: 'passages' } })).status, 401);
  });

  it('says Claude is missing where this server has none', async () => {
    const app = appWith(null);
    const res = await call(app, 'GET', '/api/ask', { cookie: await signedIn(app) });
    assert.deepEqual(await res.json(), { claude: { state: 'missing' } });
  });

  it('hands the prompt over as it stands, and waits as long as the kind allows', async () => {
    const { tutor, asked } = stubTutor();
    const app = appWith(tutor);
    const prompt = '# Chinese reading practice\n\nWrite me two passages.';
    const res = await call(app, 'POST', '/api/ask', {
      cookie: await signedIn(app),
      body: { prompt, kind: 'passages' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: '```json\n{ "texts": [] }\n```' });
    assert.deepEqual(asked, [{ prompt, timeoutMs: ASK_TIMEOUT_MS.passages }]);
  });

  it('refuses an empty prompt, an enormous one, and a kind it does not know', async () => {
    const app = appWith(stubTutor().tutor);
    const cookie = await signedIn(app);
    const bad = (body: unknown) => call(app, 'POST', '/api/ask', { cookie, body });
    assert.equal((await bad({ prompt: '   ', kind: 'passages' })).status, 400);
    assert.equal((await bad({ prompt: 'x'.repeat(ASK_MAX_CHARS + 1), kind: 'passages' })).status, 400);
    assert.equal((await bad({ prompt: 'hi', kind: 'homework' })).status, 400);
    assert.equal((await bad({ prompt: 'hi' })).status, 400);
  });

  it('answers 503 with a reason the page can show when Claude cannot be asked', async () => {
    const app = appWith(stubTutor('signed-out').tutor);
    const res = await call(app, 'POST', '/api/ask', {
      cookie: await signedIn(app),
      body: { prompt: 'hello', kind: 'wordlist' },
    });
    assert.equal(res.status, 503);
    assert.match((await res.json()).error.message, /claude auth login/i);
  });
});

describe('reading what the CLI wrote', () => {
  const run = (out: Partial<RunResult> & { stdout: string }): RunResult => ({ code: 0, stderr: '', ...out });

  it('takes the answer as it stands, code fence and all', () => {
    const text = '```json\n{ "words": [] }\n```';
    assert.equal(answerFrom(run({ stdout: JSON.stringify({ result: text }) })), text);
  });

  it('turns a signed-out failure into the sign-in instruction', () => {
    const out = JSON.stringify({ is_error: true, result: 'Not logged in. Run /login.' });
    assert.throws(() => answerFrom(run({ stdout: out })), /claude auth login/i);
  });

  it('will not call an empty answer an answer', () => {
    assert.throws(() => answerFrom(run({ stdout: JSON.stringify({ result: '   ' }) })), /nothing at all/i);
  });

  it('asks with no system prompt and no schema: the prompt says everything', async () => {
    const calls: Array<{ args: string[]; input: string }> = [];
    const tutor = claudeTutor({
      bin: () => '/bin/claude',
      model: 'sonnet',
      askModel: 'opus',
      run: async (_bin, args, input) => {
        calls.push({ args, input });
        return args[0] === 'auth'
          ? run({ stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }) })
          : run({ stdout: JSON.stringify({ result: 'written' }) });
      },
    });
    assert.equal(await tutor.ask('write me a passage'), 'written');
    const asked = calls[calls.length - 1]!;
    assert.equal(asked.input, 'write me a passage');
    assert.deepEqual(
      asked.args.filter((a) => a.startsWith('--')),
      ['--output-format', '--model', '--safe-mode', '--tools', '--strict-mcp-config', '--no-session-persistence'],
    );
    // The model for a written piece of work, not the conversation's.
    assert.equal(asked.args[asked.args.indexOf('--model') + 1], 'opus');
  });
});
