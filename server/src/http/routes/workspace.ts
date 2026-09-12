import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import {
  WORKSPACE_MAX_BYTES,
  workspaceTag,
  type SaveWorkspaceResponse,
  type WorkspaceDto,
} from '../../../../shared/api';
import type { AppEnv, RouteDeps } from '../env';
import { errorBody } from '../errors';
import { requireSession } from '../guards';
import { readJson } from '../request';

const saveRequest = z.object({
  baseRevision: z.number().int().min(0),
  document: z.record(z.string(), z.unknown()),
});

export function workspaceRoutes({ auth, workspaces, clock, trustProxy }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });

  routes.get('/', session, async (c) => {
    const userId = c.get('session').user.id;
    c.header('Cache-Control', 'no-store');

    // Answered from the revision alone when the app already has it, which is
    // the common case: a tablet checking in every time it is picked up.
    const known = c.req.header('if-none-match');
    if (known) {
      const tag = workspaceTag(await workspaces.revision(userId));
      // Compressed on the way out, the tag goes back weak (W/"r41"); either
      // spelling names the same revision.
      if (known.replace(/^W\//, '') === tag) {
        c.header('ETag', tag);
        return c.body(null, 304);
      }
    }

    const current: WorkspaceDto = await workspaces.get(userId);
    c.header('ETag', workspaceTag(current.revision));
    return c.json(current);
  });

  routes.put(
    '/',
    session,
    bodyLimit({
      maxSize: WORKSPACE_MAX_BYTES,
      onError: (c) =>
        c.json(errorBody('payload_too_large', 'That is more than one account can store.'), 413),
    }),
    async (c) => {
      const input = await readJson(c, saveRequest);
      const saved: SaveWorkspaceResponse = await workspaces.save(
        c.get('session').user.id,
        input.baseRevision,
        input.document,
      );
      return c.json(saved);
    },
  );

  return routes;
}
