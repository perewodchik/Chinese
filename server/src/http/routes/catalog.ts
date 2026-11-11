import { Hono } from 'hono';
import type { AppEnv, RouteDeps } from '../env';
import { requireSession } from '../guards';

/**
 * The shared catalogue, for anyone signed in (shared/catalog.ts):
 *
 *   GET /api/catalog       the books on offer
 *   GET /api/catalog/:id   one book with its texts
 *
 * An admin also sees the hidden books here, to look at one before showing
 * it. Publishing is under /api/admin/catalog.
 */
export function catalogRoutes({ auth, clock, trustProxy, catalog }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });

  routes.get('/', session, async (c) => {
    // A minute is enough for a list that changes when an admin publishes.
    c.header('Cache-Control', 'private, max-age=60');
    return c.json(await catalog.list(c.get('session').user.role === 'admin'));
  });

  routes.get('/:id', session, async (c) => {
    c.header('Cache-Control', 'private, max-age=60');
    return c.json(await catalog.get(c.req.param('id'), c.get('session').user.role === 'admin'));
  });

  return routes;
}
