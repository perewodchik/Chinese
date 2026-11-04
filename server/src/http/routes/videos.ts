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
const HOUR = 60 * 60_000;

export function videoRoutes({ auth, clock, trustProxy, log, limits, lookups: cache }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // Adding a video is a handful of lookups a week. A page stuck retrying is
  // stopped long before YouTube takes offence at this address.
  const lookups = new RateLimiter('videos.lookups', 60, HOUR, clock, limits);
  // And all the learners together: every lookup leaves from this server's one
  // address, and an address YouTube takes against is lost to all of them.
  const site = new RateLimiter('videos.site', 300, HOUR, clock, limits);

  /**
   * A video's title and captions are the same for everyone, so they are kept
   * a while and the next learner to add the video is answered from here — a
   * kept answer costs no lookup. A cache that cannot be read or written is
   * passed by: YouTube is asked as before.
   */
  async function kept<T>(key: string, forMs: number, userId: string, fetch: () => Promise<T>): Promise<T> {
    const found = await cache.get(key, clock.now() - forMs).catch(() => null);
    if (found) return JSON.parse(found) as T;
    await lookups.consume(userId);
    await site.consume('all');
    const fresh = await fetch();
    await cache.put(key, JSON.stringify(fresh), clock.now()).catch((err: unknown) => log(`videos: could not keep ${key}: ${err instanceof Error ? err.message : String(err)}`));
    return fresh;
  }

  routes.get('/youtube/:id', session, async (c) => {
    const id = c.req.param('id');
    if (!VIDEO_ID.test(id)) throw new ValidationError('That is not a YouTube video id.');
    let found: VideoLookup;
    try {
      found = await kept(`youtube:video:${id}`, 24 * HOUR, c.get('session').user.id, () => lookUpVideo(id));
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError('not_found', err.message);
      if (err instanceof AppError) throw err;
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
    try {
      const found = await kept(`youtube:playlist:${id}`, HOUR, c.get('session').user.id, () => lookUpPlaylist(id));
      c.header('Cache-Control', 'private, max-age=3600');
      return c.json(found);
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError('not_found', err.message);
      if (err instanceof AppError) throw err;
      const why = err instanceof Error ? err.message : String(err);
      log(`videos: YouTube playlist ${id} failed: ${why}`);
      throw new AppError('unavailable', `YouTube would not list that playlist here (${why}).`);
    }
  });

  return routes;
}
