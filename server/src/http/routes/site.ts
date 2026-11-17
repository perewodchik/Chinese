import { Hono } from 'hono';
import type { SiteInfo } from '../../../../shared/site';
import type { AppEnv, RouteDeps } from '../env';
import { requireSession } from '../guards';

/**
 * What the site says to everyone signed in (A11, shared/site.ts):
 *
 *   GET /api/site   { announcement }
 */
export function siteRoutes({ auth, clock, trustProxy, site }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  routes.get('/', session, async (c) => {
    const body: SiteInfo = { announcement: (await site.get()).announcement };
    c.header('Cache-Control', 'private, max-age=60');
    return c.json(body);
  });
  return routes;
}
