import { Hono } from 'hono';
import { PLAYLIST_ID, VIDEO_ID, type VideoLookup } from '../../../../shared/videos';
import { AppError, ValidationError } from '../../domain/errors';
import { lookUpPlaylist, lookUpVideo, YouTubeNotFound, YouTubeRefused } from '../../infrastructure/youtube';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';

/**
 * Videos to study, looked up on YouTube for a signed-in learner.
 *
 *   GET /api/videos/youtube/:id   the title, the length and the captions
 *   GET /api/videos/playlist/:id  the videos a playlist lists, in order
 *
 * The answer is the learner's own business and changes only if the channel
 * edits its captions, so it may be kept by the browser for a day.
 */
export function videoRoutes({ auth, clock, trustProxy, log }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // Adding a video is a handful of lookups a week. A page stuck retrying is
  // stopped long before YouTube takes offence at this address.
  const lookups = new RateLimiter(60, 60 * 60_000, clock);

  routes.get('/youtube/:id', session, async (c) => {
    const id = c.req.param('id');
    if (!VIDEO_ID.test(id)) throw new ValidationError('That is not a YouTube video id.');
    lookups.consume(c.get('session').user.id);
    let found: VideoLookup;
    try {
      found = await lookUpVideo(id);
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError('not_found', err.message);
      const why = err instanceof Error ? err.message : String(err);
      log(`videos: YouTube lookup of ${id} failed: ${why}`);
      throw new AppError(
        'unavailable',
        err instanceof YouTubeRefused
          ? `YouTube would not give this server the captions (${why}). Paste the text instead, or add it from the home computer.`
          : `YouTube did not answer (${why}). Try again, or paste the text.`,
      );
    }
    c.header('Cache-Control', 'private, max-age=86400');
    return c.json(found);
  });

  routes.get('/playlist/:id', session, async (c) => {
    const id = c.req.param('id');
    if (!PLAYLIST_ID.test(id)) throw new ValidationError('That is not a YouTube playlist id.');
    lookups.consume(c.get('session').user.id);
    try {
      const found = await lookUpPlaylist(id);
      c.header('Cache-Control', 'private, max-age=3600');
      return c.json(found);
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError('not_found', err.message);
      const why = err instanceof Error ? err.message : String(err);
      log(`videos: YouTube playlist ${id} failed: ${why}`);
      throw new AppError('unavailable', `YouTube would not list that playlist here (${why}).`);
    }
  });

  return routes;
}
