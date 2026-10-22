import { Hono } from 'hono';
import { STROKES_PER_REQUEST, type StrokesResponse } from '../../../../shared/strokes';
import { ValidationError } from '../../domain/errors';
import { lookUpOutlines } from '../../infrastructure/stroke-outlines';
import type { AppEnv, RouteDeps } from '../env';
import { requireSession } from '../guards';

const HANZI = /^\p{Script=Han}$/u;

/**
 * Stroke outlines for characters the built data does not have.
 *
 *   GET /api/strokes?c=圳鹏   the outlines of each character found
 *
 * An outline never changes, so the browser may keep the answer for a month.
 */
export function strokeRoutes({ auth, clock, trustProxy }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });

  routes.get('/', session, async (c) => {
    const chars = [...new Set([...(c.req.query('c') ?? '')])];
    if (!chars.length || chars.length > STROKES_PER_REQUEST || !chars.every((x) => HANZI.test(x))) {
      throw new ValidationError(`Ask for one to ${STROKES_PER_REQUEST} Chinese characters.`);
    }
    const body: StrokesResponse = { strokes: await lookUpOutlines(chars) };
    c.header('Cache-Control', 'private, max-age=2592000, immutable');
    return c.json(body);
  });

  return routes;
}
