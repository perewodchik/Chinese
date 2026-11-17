import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

/**
 * A7: the page's report of the learner's day, in numbers only:
 *
 *   POST /api/activity   { day, minutes, textsRead, answers, spoken, videos } → 204
 *
 * Sent every few minutes and as the page goes away; sixty an hour.
 */
export function activityRoutes({ auth, clock, trustProxy, activity, limits }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  const reports = new RateLimiter('activity.reports', 60, 60 * 60_000, clock, limits);
  const count = z.number().finite().min(0).max(1_000_000);
  const body = z.object({ day: z.string().max(10), minutes: count, textsRead: count, answers: count, spoken: count, videos: count }).strict();

  routes.post('/', session, async (c) => {
    const userId = c.get('session').user.id;
    await reports.consume(userId);
    await activity.record(userId, await readJson(c, body));
    return c.body(null, 204);
  });

  return routes;
}
