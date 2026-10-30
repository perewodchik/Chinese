import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const keyRequest = z.object({ key: z.string().min(1).max(400) });
const lineRequest = z.object({ voice: z.string().min(1).max(120), text: z.string().trim().min(1).max(240) });

/**
 * Texts read aloud by MiniMax with the learner's own key (see
 * shared/narration.ts for the routes). A sentence a request, so a long text
 * never meets a function's time limit and the page can say how far it has got.
 */
export function narrationRoutes({ auth, clock, trustProxy, narration }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A text is a few dozen sentences; a page stuck in a loop would spend the learner's money.
  const lines = new RateLimiter(400, 10 * 60_000, clock);
  const keys = new RateLimiter(20, 10 * 60_000, clock);
  const user = (c: { get: (k: 'session') => { user: { id: string } } }) => c.get('session').user.id;

  routes.get('/', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await narration.status(user(c)));
  });

  routes.put('/key', session, async (c) => {
    keys.consume(user(c));
    const { key } = await readJson(c, keyRequest);
    c.header('Cache-Control', 'no-store');
    return c.json(await narration.setKey(user(c), key));
  });

  routes.delete('/key', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await narration.deleteKey(user(c)));
  });

  routes.get('/voices', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ voices: await narration.voices(user(c)) });
  });

  routes.post('/line', session, async (c) => {
    lines.consume(user(c));
    const input = await readJson(c, lineRequest);
    c.header('Cache-Control', 'no-store');
    return c.json({ recordedAs: await narration.line(user(c), input.voice, input.text) });
  });

  return routes;
}
