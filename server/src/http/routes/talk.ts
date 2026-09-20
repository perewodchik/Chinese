import { Hono } from 'hono';
import { z } from 'zod';
import {
  TALK_LEVELS,
  TALK_LINE_MAX_CHARS,
  TALK_MAX_LINES,
  type TalkReply,
  type TalkStatusResponse,
} from '../../../../shared/talk';
import { AppError, TutorUnavailableError, ValidationError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';
import { SPEECH_MAX_CHARS } from './speech';

const replyRequest = z.object({
  lines: z
    .array(z.object({ who: z.enum(['tutor', 'learner']), text: z.string().trim().min(1).max(TALK_LINE_MAX_CHARS) }))
    // A longer conversation is fine; only its end goes to Claude.
    .max(TALK_MAX_LINES * 5),
  level: z.enum(TALK_LEVELS as [string, ...string[]]),
});

/**
 * Talking with Claude out loud, for signed-in users only.
 *
 *   GET  /api/talk?voice=chen     whether Claude can be asked from here, and the voices that can read its answers
 *   POST /api/talk/reply          { lines, level } → Claude's next turn
 *   GET  /api/talk/audio?text&voice&slow=1   an MP3 of one sentence, in a local voice
 *
 * The status call also gets the chosen voice's model loading, so that the
 * several seconds it takes are spent while the learner is still reading the
 * page rather than after their first sentence.
 */
export function talkRoutes({ auth, clock, trustProxy, tutor, talkVoices }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // Far more than anyone talking will reach, and a stop to a page stuck in a loop
  // before it spends the subscription's allowance.
  const turns = new RateLimiter(120, 10 * 60_000, clock);
  const clips = new RateLimiter(600, 10 * 60_000, clock);

  routes.get('/', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    talkVoices?.warm?.(c.req.query('voice'));
    const body: TalkStatusResponse = {
      claude: { state: tutor ? await tutor.status() : 'missing' },
      voices: talkVoices?.voices ?? [],
    };
    return c.json(body);
  });

  routes.post('/reply', session, async (c) => {
    if (!tutor) throw new TutorUnavailableError('Claude Code is not installed on this server.');
    const input = await readJson(c, replyRequest);
    turns.consume(c.get('session').user.id);
    const reply: TalkReply = await tutor.reply({
      lines: input.lines,
      level: input.level as (typeof TALK_LEVELS)[number],
    });
    c.header('Cache-Control', 'no-store');
    return c.json(reply);
  });

  routes.get('/audio', session, async (c) => {
    if (!talkVoices) throw new AppError('not_found', 'No local voice is set up on this server.');
    const text = (c.req.query('text') ?? '').trim();
    const voice = c.req.query('voice') ?? talkVoices.voices[0]!.id;
    const slow = c.req.query('slow') === '1';
    if (!text) throw new ValidationError('Nothing to say.');
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);
    if (!talkVoices.voices.some((v) => v.id === voice)) throw new ValidationError(`There is no voice called ${voice}.`);

    clips.consume(c.get('session').user.id);
    let audio: Uint8Array;
    try {
      audio = await talkVoices.synthesize(text, voice, slow);
    } catch {
      throw new AppError('unavailable', 'The voice did not answer. The system voice will have to do for now.');
    }
    c.header('Content-Type', 'audio/mpeg');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(audio as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
