import { Hono } from 'hono';
import { z } from 'zod';
import { FEEDBACK_MAX } from '../../../../shared/feedback';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

/**
 * Feedback sent from the site itself (A12, shared/feedback.ts):
 *
 *   POST /api/feedback   { kind, message, page } → 201
 *
 * Ten a day an account. Admins read it at /api/admin/feedback.
 */
export function feedbackRoutes({ auth, clock, trustProxy, feedback, limits }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  const sends = new RateLimiter('feedback.sends', 10, 24 * 60 * 60_000, clock, limits);
  const body = z.object({ kind: z.string().max(20), message: z.string().max(FEEDBACK_MAX * 4), page: z.string().max(2000).default('/') });

  routes.post('/', session, async (c) => {
    const userId = c.get('session').user.id;
    await sends.consume(userId);
    await feedback.send(userId, await readJson(c, body));
    return c.body(null, 201);
  });

  return routes;
}
