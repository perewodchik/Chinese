import { Hono } from 'hono';
import { AppError, ValidationError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';

/** Longer than any line of a passage, shorter than anything worth abusing a key for. */
export const SPEECH_MAX_CHARS = 240;

/**
 * Mandarin read aloud, for signed-in users only.
 *
 *   GET /api/speech                          which voices there are ([] when none is set up)
 *   GET /api/speech/audio?text&voice&slow=1  an MP3 of the text
 *
 * The same text in the same voice is the same file for ever, so it is sent
 * with a year-long private cache: a word practised every day is fetched once
 * per device, and the free tier's characters go on new words, not old ones.
 * Private, because the answer is only for somebody signed in.
 */
export function speechRoutes({ auth, clock, trustProxy, speech }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A generous ceiling that no person reading and repeating will meet, and a
  // runaway loop in the page will, before it spends the month's characters.
  const limiter = new RateLimiter(300, 10 * 60_000, clock);

  routes.get('/', session, (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ voices: speech?.voices ?? [] });
  });

  routes.get('/audio', session, async (c) => {
    if (!speech) {
      throw new AppError('not_found', 'No natural voice is set up here: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set.');
    }
    const text = (c.req.query('text') ?? '').trim();
    const voice = c.req.query('voice') ?? speech.voices[0]!.id;
    const slow = c.req.query('slow') === '1';
    if (!text) throw new ValidationError('Nothing to say.');
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);
    if (!speech.voices.some((v) => v.id === voice)) throw new ValidationError(`There is no voice called ${voice}.`);

    limiter.consume(c.get('session').user.id);
    let audio: Uint8Array;
    try {
      audio = await speech.synthesize(text, voice, slow);
    } catch {
      throw new AppError('internal', 'The voice service did not answer. The system voice will have to do for now.');
    }
    c.header('Content-Type', 'audio/mpeg');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(audio as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
