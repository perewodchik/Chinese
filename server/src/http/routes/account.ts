import { Hono } from 'hono';
import type { UsageResponse } from '../../../../shared/usage';
import type { AppEnv, RouteDeps } from '../env';
import { requireSession } from '../guards';

/**
 * The account's own pages' questions.
 *
 *   GET /api/account/usage   what the learner's own keys have been spent on (shared/usage.ts)
 */
export function accountRoutes({ auth, clock, trustProxy, usage, speechEval, narration }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });

  routes.get('/usage', session, async (c) => {
    const user = c.get('session').user.id;
    const [scoring, reading] = await Promise.all([speechEval.status(user), narration.status(user)]);
    const body: UsageResponse = await usage.summary(user, {
      speechsuper: scoring.key.set && scoring.key.provider === 'speechsuper',
      iflytek: scoring.key.set && scoring.key.provider === 'iflytek',
      minimax: reading.key.set,
    });
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  return routes;
}
