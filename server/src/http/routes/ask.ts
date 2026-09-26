import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ASK_KINDS,
  ASK_MAX_CHARS,
  ASK_TIMEOUT_MS,
  type AskAnswer,
  type AskKind,
  type AskStatusResponse,
} from '../../../../shared/ask';
import { TutorUnavailableError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const askRequest = z.object({
  prompt: z.string().trim().min(1).max(ASK_MAX_CHARS),
  kind: z.enum(ASK_KINDS as [string, ...string[]]),
});

/**
 * Handing a prompt to Claude instead of to the clipboard.
 *
 *   GET  /api/ask    whether Claude can be asked from this server at all
 *   POST /api/ask    { prompt, kind } → what Claude wrote back
 *
 * `kind: 'check'` is the reader's Check Answer: a short prompt about one
 * comprehension question, answered in seconds.
 *
 * The same subscription, reached the same headless way as the conversation.
 * It is a separate route because it is a separate thing: no tutor persona, no
 * schema, no voices — one prompt written by a page in this app, and the reply
 * dropped into the box that was waiting for a paste.
 */
export function askRoutes({ auth, clock, trustProxy, tutor }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A session or a word list is minutes of Claude's time. A handful an hour is
  // a day's work; a page in a loop is stopped before it spends the allowance.
  const asks = new RateLimiter(20, 60 * 60_000, clock);
  // Checking an answer is seconds of Claude's time, and a reader working
  // through a session asks a dozen of them; it gets its own, larger allowance.
  const checks = new RateLimiter(120, 60 * 60_000, clock);

  routes.get('/', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    const body: AskStatusResponse = { claude: { state: tutor ? await tutor.status() : 'missing' } };
    return c.json(body);
  });

  // A video's study pack takes minutes, and the page that asked may be left
  // or reloaded in the meantime. The answer is kept for an hour by who asked
  // and what, and a second ask for the same while the first is still running
  // waits for it instead of starting Claude again.
  const kept = new Map<string, { at: number; answer: Promise<string> }>();
  const KEEP_MS = 60 * 60_000;

  routes.post('/', session, async (c) => {
    if (!tutor) throw new TutorUnavailableError('Claude Code is not installed on this server.');
    const input = await readJson(c, askRequest);
    const user = c.get('session').user.id;
    const run = () => tutor.ask(input.prompt, { timeoutMs: ASK_TIMEOUT_MS[input.kind as AskKind] });
    let text: string;
    if (input.kind === 'video') {
      const key = createHash('sha256').update(`${user}\n${input.prompt}`).digest('hex');
      const now = clock.now();
      for (const [k, v] of kept) if (now - v.at > KEEP_MS) kept.delete(k);
      let entry = kept.get(key);
      if (!entry) {
        asks.consume(user);
        entry = { at: now, answer: run() };
        kept.set(key, entry);
        // A failed run is not kept: asking again should try again.
        entry.answer.catch(() => kept.delete(key));
      }
      text = await entry.answer;
    } else {
      (input.kind === 'check' ? checks : asks).consume(user);
      text = await run();
    }
    const body: AskAnswer = { text };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  return routes;
}
