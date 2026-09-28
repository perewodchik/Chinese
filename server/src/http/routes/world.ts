import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { WORLD_SAVE_MAX_BYTES, worldTag, type PutWorldSaveResponse, type WorldSaveDto } from '../../../../shared/world';
import type { AppEnv, RouteDeps } from '../env';
import { errorBody } from '../errors';
import { requireSession } from '../guards';
import { readJson } from '../request';

const putRequest = z.object({
  baseRevision: z.number().int().min(0),
  save: z.record(z.string(), z.unknown()),
});

/** GET and PUT /api/world — 走走's save, behind the session like the workspace. */
export function worldRoutes({ auth, world, clock, trustProxy }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });

  routes.get('/', session, async (c) => {
    const userId = c.get('session').user.id;
    c.header('Cache-Control', 'no-store');
    const known = c.req.header('if-none-match');
    if (known) {
      const tag = worldTag(await world.revision(userId));
      if (known.replace(/^W\//, '') === tag) {
        c.header('ETag', tag);
        return c.body(null, 304);
      }
    }
    const current: WorldSaveDto = await world.get(userId);
    c.header('ETag', worldTag(current.revision));
    return c.json(current);
  });

  routes.put(
    '/',
    session,
    bodyLimit({
      maxSize: WORLD_SAVE_MAX_BYTES,
      onError: (c) => c.json(errorBody('payload_too_large', 'That game save is larger than the server keeps.'), 413),
    }),
    async (c) => {
      const input = await readJson(c, putRequest);
      const saved: PutWorldSaveResponse = await world.save(c.get('session').user.id, input.baseRevision, input.save);
      return c.json(saved);
    },
  );

  return routes;
}
