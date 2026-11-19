import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

/**
 * The shared catalogue, for anyone signed in (shared/catalog.ts):
 *
 *   GET /api/catalog       the books on offer
 *   GET /api/catalog/:id   one book with its texts
 *   POST /api/catalog/:id/reader  { finished }: took it, or read all of it (A9)
 *
 * An admin also sees the hidden books here, to look at one before showing
 * it. Publishing is under /api/admin/catalog.
 */
export function catalogRoutes({ auth, clock, trustProxy, catalog, limits }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A book is taken and finished once; a page in a loop is held back long before it matters.
  const marks = new RateLimiter('catalog.readers', 60, 60 * 60_000, clock, limits);

  routes.get('/', session, async (c) => {
    // A minute is enough for a list that changes when an admin publishes.
    c.header('Cache-Control', 'private, max-age=60');
    return c.json(await catalog.list(c.get('session').user.role === 'admin'));
  });

  routes.get('/:id', session, async (c) => {
    c.header('Cache-Control', 'private, max-age=60');
    return c.json(await catalog.get(c.req.param('id'), c.get('session').user.role === 'admin'));
  });

  // A9: took it onto a shelf, or read all of it — counted for the admin page, never named.
  routes.post('/:id/reader', session, async (c) => {
    const user = c.get('session').user.id;
    await marks.consume(user);
    const { finished } = await readJson(c, z.object({ finished: z.boolean() }));
    await catalog.markReader(user, c.req.param('id'), finished);
    return c.body(null, 204);
  });

  return routes;
}
