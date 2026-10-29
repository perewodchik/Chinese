import { Hono } from 'hono';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';

/**
 * The pictures beside a text's paragraphs, for their owner.
 *
 *   GET /api/pictures/:key   the picture
 *   PUT /api/pictures/:key   keep this picture (the body), filed under the digest of its bytes
 *
 * A key is the picture itself, so it is sent with a year-long private cache:
 * a text read every day fetches its pictures once per device.
 */
export function pictureRoutes({ auth, clock, trustProxy, pictures }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A shelf illustrated at once is a few dozen pictures; a loop is thousands.
  const uploads = new RateLimiter(300, 10 * 60_000, clock);

  routes.get('/:key', session, async (c) => {
    const { mime, bytes } = await pictures.get(c.get('session').user.id, c.req.param('key'));
    c.header('Content-Type', mime);
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(bytes as Uint8Array<ArrayBuffer>);
  });

  routes.put('/:key', session, async (c) => {
    const user = c.get('session').user.id;
    uploads.consume(user);
    const mime = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    await pictures.put(user, c.req.param('key'), mime, bytes);
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: true });
  });

  return routes;
}
