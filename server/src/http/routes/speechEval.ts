import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { EVAL_MAX_BYTES, EVAL_MAX_CHARS, STRICTNESS } from '../../../../shared/speechEval';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const keysRequest = z.object({ appId: z.string().min(1).max(60), apiKey: z.string().min(1).max(120), apiSecret: z.string().min(1).max(160) });
const settingsRequest = z.object({ strictness: z.enum(STRICTNESS) });
const evalRequest = z.object({
  text: z.string().trim().min(1).max(EVAL_MAX_CHARS * 2),
  // base64 of up to EVAL_MAX_BYTES of PCM
  audio: z.string().min(1).max(Math.ceil((EVAL_MAX_BYTES * 4) / 3) + 8),
});

/** Phrases scored by iFlytek with the learner's own keys (see shared/speechEval.ts for the routes). */
export function speechEvalRoutes({ auth, clock, trustProxy, speechEval }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A phrase is said a few times a minute; a page in a loop would spend the learner's allowance.
  const scores = new RateLimiter(200, 10 * 60_000, clock);
  const keys = new RateLimiter(20, 10 * 60_000, clock);
  const user = (c: Context<AppEnv>) => c.get('session').user.id;
  const json = <T,>(c: Context<AppEnv>, body: T) => {
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  };

  routes.get('/', session, async (c) => json(c, await speechEval.status(user(c))));

  routes.put('/key', session, async (c) => {
    keys.consume(user(c));
    return json(c, await speechEval.setKeys(user(c), await readJson(c, keysRequest)));
  });

  routes.delete('/key', session, async (c) => json(c, await speechEval.deleteKeys(user(c))));

  routes.patch('/settings', session, async (c) => {
    const { strictness } = await readJson(c, settingsRequest);
    return json(c, await speechEval.setStrictness(user(c), strictness));
  });

  routes.post('/', session, async (c) => {
    scores.consume(user(c));
    return json(c, { result: await speechEval.evaluate(user(c), await readJson(c, evalRequest)) });
  });

  return routes;
}
