import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { ATTEMPTS_PER_CALL, EVAL_MAX_BYTES, EVAL_MAX_CHARS, PINYIN_SYLLABLE, STRICTNESS } from '../../../../shared/speechEval';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const keysRequest = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('speechsuper'), appKey: z.string().min(1).max(80), secretKey: z.string().min(1).max(120) }),
  z.object({ provider: z.literal('iflytek'), appId: z.string().min(1).max(60), apiKey: z.string().min(1).max(120), apiSecret: z.string().min(1).max(160) }),
]);
const settingsRequest = z.object({ strictness: z.enum(STRICTNESS) });
// The page's summary and the service's answer are kept as given, within a size.
const sized = (max: number) => z.unknown().refine((v) => v === undefined || JSON.stringify(v).length <= max, 'too large');
const attemptsRequest = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        at: z.number().int().nonnegative(),
        kind: z.enum(['phrase', 'drill']),
        sourceId: z.string().max(200).nullable().optional(),
        text: z.string().max(EVAL_MAX_CHARS * 4),
        tally: z.string().max(80).nullable().optional(),
        good: z.boolean(),
        summary: sized(16_000).optional(),
        result: sized(120_000).optional(),
      }),
    )
    .max(ATTEMPTS_PER_CALL),
});
const evalRequest = z.object({
  text: z.string().trim().min(1).max(EVAL_MAX_CHARS * 2),
  pinyin: z.array(z.string().regex(PINYIN_SYLLABLE)).max(EVAL_MAX_CHARS).optional(),
  // base64 of up to EVAL_MAX_BYTES of PCM
  audio: z.string().min(1).max(Math.ceil((EVAL_MAX_BYTES * 4) / 3) + 8),
});

/** Phrases scored by SpeechSuper or iFlytek with the learner's own keys (see shared/speechEval.ts for the routes). */
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

  routes.get('/history', session, async (c) => json(c, await speechEval.history(user(c))));

  routes.get('/attempts', session, async (c) => {
    const kind = c.req.query('kind');
    return json(c, { attempts: await speechEval.attempts(user(c), kind === 'phrase' || kind === 'drill' ? kind : undefined) });
  });

  routes.get('/attempts/:id', session, async (c) => json(c, await speechEval.attemptResult(user(c), c.req.param('id'))));

  routes.post('/attempts', session, async (c) => {
    const { items } = await readJson(c, attemptsRequest);
    return json(c, await speechEval.keepAttempts(user(c), items as never));
  });

  routes.post('/', session, async (c) => {
    scores.consume(user(c));
    return json(c, { result: await speechEval.evaluate(user(c), await readJson(c, evalRequest)) });
  });

  return routes;
}
