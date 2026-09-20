import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
  parseReply,
  REPLY_SCHEMA,
  TALK_MAX_LINES,
  turnPrompt,
  tutorInstructions,
  type ClaudeState,
  type TalkReply,
} from '../../../shared/talk';
import type { Tutor } from '../application/ports';
import { TutorUnavailableError } from '../domain/errors';

/**
 * Claude, through Claude Code running headless on this computer.
 *
 * The learner pays for a Claude subscription and does not want to pay again
 * per word for the API, and Claude Code signed in to a subscription answers
 * `claude -p` from that subscription. So each turn of a conversation is one
 * short `claude -p` run: no key, no SDK, and no bill beyond the plan.
 *
 * Three things keep it that way, and each is deliberate:
 *
 * - The child gets a short list of environment variables and nothing else.
 *   An `ANTHROPIC_API_KEY` in the server's environment would otherwise be
 *   picked up and quietly bill every turn to the API.
 * - `claude auth status` is asked first, and a Claude Code signed in with an
 *   API key (or through Bedrock or Vertex) is refused rather than used.
 * - `--bare` is never passed: it reads only an API key and would ignore the
 *   subscription entirely.
 *
 * It runs as a plain chat partner: no tools, no MCP servers, no project
 * instructions or skills (`--safe-mode`), a system prompt of our own, no
 * session left behind, and a neutral working directory. That keeps each turn
 * quick and stops anything in this repository's Claude setup leaking in.
 *
 * Each call is stateless — the whole conversation so far goes with every
 * turn. Conversations here are a few dozen short lines, so that costs little,
 * and nothing has to be remembered between turns or cleaned up after them.
 */

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs the CLI once: the program, its arguments, what to write to its stdin. */
export type Runner = (bin: string, args: string[], input: string, timeoutMs: number) => Promise<RunResult>;

const REPLY_TIMEOUT_MS = 120_000;
const STATUS_TIMEOUT_MS = 15_000;
/** A signed-in answer is kept for a while; any other is asked again soon, so signing in is noticed. */
const READY_FOR_MS = 5 * 60_000;
const OTHER_FOR_MS = 10_000;

/** The only variables the child sees. Anything that could select an API key or another endpoint is left out. */
const PASSED = ['HOME', 'USER', 'LOGNAME', 'SHELL', 'PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TZ'];
/** A subscription token from `claude setup-token`, and where Claude Code keeps its settings, if moved. */
const PASSED_CLAUDE = ['CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR'];

export function childEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of [...PASSED, ...PASSED_CLAUDE]) {
    const v = env[k];
    if (v) out[k] = v;
  }
  // The desktop app keeps its bundled copy up to date itself.
  out.DISABLE_AUTOUPDATER = '1';
  return out;
}

const numeric = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
const newer = (a: string, b: string) => {
  const x = numeric(a);
  const y = numeric(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
  }
  return 0;
};

/**
 * Where Claude Code is: `HANZI_CLAUDE_BIN`, then `claude` on the PATH or in
 * the usual install places, then the newest copy the Claude desktop app
 * bundles on a Mac (its folder carries the version, so it moves on update and
 * is looked up again every time).
 */
export function findClaude(env: Record<string, string | undefined>, home = homedir()): string | null {
  const own = env.HANZI_CLAUDE_BIN?.trim();
  if (own) return existsSync(own) ? own : null;

  const dirs = [
    ...(env.PATH ?? '').split(delimiter),
    join(home, '.local/bin'),
    join(home, '.claude/local'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean);
  for (const dir of dirs) {
    const bin = join(dir, process.platform === 'win32' ? 'claude.exe' : 'claude');
    if (existsSync(bin)) return bin;
  }

  const bundled = join(home, 'Library/Application Support/Claude/claude-code');
  try {
    for (const version of readdirSync(bundled).sort(newer)) {
      const bin = join(bundled, version, 'claude.app/Contents/MacOS/claude');
      if (existsSync(bin)) return bin;
    }
  } catch {
    // No desktop app, or not a Mac.
  }
  return null;
}

export const spawnRunner =
  (env: Record<string, string | undefined>, cwd: string): Runner =>
  (bin, args, input, timeoutMs) =>
    new Promise((resolve, reject) => {
      const child = spawn(bin, args, { cwd, env: childEnv(env), stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
      child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
      child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      child.stdin.end(input);
    });

interface AuthStatus {
  loggedIn?: boolean;
  authMethod?: string;
  apiProvider?: string;
}

/** What `claude auth status` means for us. */
export function stateFromAuth(raw: string): ClaudeState {
  let s: AuthStatus;
  try {
    s = JSON.parse(raw) as AuthStatus;
  } catch {
    return 'signed-out';
  }
  if (!s.loggedIn || !s.authMethod || s.authMethod === 'none') return 'signed-out';
  if (s.apiProvider && s.apiProvider !== 'firstParty') return 'api-key';
  if (/api.?key|console|helper/i.test(s.authMethod)) return 'api-key';
  return 'ready';
}

interface CliResult {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

const SIGNED_OUT = /not logged in|\/login|authenticat|oauth token/i;

export const SIGN_IN_HINT =
  'Claude Code on this computer is not signed in. In a terminal, run: claude auth login — and choose your Claude subscription, not an API key.';
export const API_KEY_HINT =
  'Claude Code on this computer is signed in with an API key, which is billed separately. Sign it in to your subscription instead: claude auth logout, then claude auth login.';

/** Claude's turn out of the CLI's JSON, or a clear reason there is none. */
export function replyFrom(run: RunResult): TalkReply {
  let out: CliResult;
  try {
    out = JSON.parse(run.stdout) as CliResult;
  } catch {
    const said = (run.stderr || run.stdout).trim().slice(0, 240);
    throw new TutorUnavailableError(`Claude Code did not answer${said ? `: ${said}` : '.'}`);
  }
  const text = out.result?.trim() ?? '';
  if (out.is_error) {
    if (SIGNED_OUT.test(text)) throw new TutorUnavailableError(SIGN_IN_HINT);
    throw new TutorUnavailableError(`Claude could not answer: ${text.slice(0, 240) || 'no reason given'}`);
  }
  const structured = out.structured_output;
  const reply =
    structured && typeof structured === 'object'
      ? parseReply(JSON.stringify(structured))
      : parseReply(text);
  if (!reply) throw new TutorUnavailableError('Claude answered without any Chinese in it. Try again.');
  return reply;
}

export function claudeTutor(opts: {
  /** looked up on every call, since an app update moves the bundled copy */
  bin: () => string | null;
  model: string;
  run: Runner;
  now?: () => number;
}): Tutor {
  const now = opts.now ?? Date.now;
  let known: { state: ClaudeState; until: number } | null = null;

  const status = async (): Promise<ClaudeState> => {
    if (known && known.until > now()) return known.state;
    const bin = opts.bin();
    let state: ClaudeState;
    if (!bin) state = 'missing';
    else {
      try {
        const r = await opts.run(bin, ['auth', 'status'], '', STATUS_TIMEOUT_MS);
        state = stateFromAuth(r.stdout);
      } catch {
        state = 'missing';
      }
    }
    known = { state, until: now() + (state === 'ready' ? READY_FOR_MS : OTHER_FOR_MS) };
    return state;
  };

  return {
    status,
    async reply({ lines, level }) {
      const state = await status();
      if (state === 'missing') throw new TutorUnavailableError('Claude Code is not installed on this server.');
      if (state === 'signed-out') throw new TutorUnavailableError(SIGN_IN_HINT);
      if (state === 'api-key') throw new TutorUnavailableError(API_KEY_HINT);

      const args = [
        '-p',
        '--output-format',
        'json',
        '--model',
        opts.model,
        '--safe-mode',
        '--tools',
        '',
        '--strict-mcp-config',
        '--no-session-persistence',
        '--system-prompt',
        tutorInstructions(level),
        '--json-schema',
        JSON.stringify(REPLY_SCHEMA),
      ];
      let run: RunResult;
      try {
        run = await opts.run(opts.bin()!, args, turnPrompt(lines.slice(-TALK_MAX_LINES)), REPLY_TIMEOUT_MS);
      } catch {
        throw new TutorUnavailableError('Claude Code could not be started on this server.');
      }
      try {
        return replyFrom(run);
      } catch (err) {
        // Signed out since the last check: ask again next time rather than trusting the cache.
        known = null;
        throw err;
      }
    },
  };
}

/**
 * The tutor for a server on the learner's own computer, or null where there
 * is no Claude Code to run (Vercel) or it is switched off (`HANZI_CLAUDE=off`).
 *
 *   HANZI_CLAUDE_BIN     the claude program, when it is somewhere unusual
 *   HANZI_CLAUDE_MODEL   sonnet (default), haiku, opus — any name Claude Code takes
 */
export function tutorFromEnv(env: Record<string, string | undefined>): Tutor | null {
  if (env.HANZI_CLAUDE === 'off' || env.VERCEL) return null;
  const cwd = join(tmpdir(), 'hanzi-workshop-talk');
  mkdirSync(cwd, { recursive: true });
  return claudeTutor({
    bin: () => findClaude(env),
    model: env.HANZI_CLAUDE_MODEL?.trim() || 'sonnet',
    run: spawnRunner(env, cwd),
  });
}
