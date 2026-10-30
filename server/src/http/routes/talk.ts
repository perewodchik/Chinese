import { Hono } from 'hono';
import { z } from 'zod';
import {
  TALK_LENGTHS,
  TALK_LEVELS,
  TALK_LINE_MAX_CHARS,
  TALK_MAX_LINES,
  TALK_MODES,
  TALK_RECORDED_MAX,
  TALK_SAVED_TURNS_MAX,
  TALK_TOPIC_MAX_CHARS,
  TALK_VOCAB_MAX,
  type TalkMode,
  type TalkOptions,
  type TalkRecordedResponse,
  type TalkReply,
  type TalkSavedTurn,
  type TalkStatusResponse,
} from '../../../../shared/talk';
import { AppError, TutorUnavailableError, ValidationError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';
import { SPEECH_MAX_CHARS } from './speech';

const talkOptions = z.object({
  level: z.enum(TALK_LEVELS as [string, ...string[]]),
  length: z.enum(TALK_LENGTHS as [string, ...string[]]),
  explain: z.boolean(),
  words: z.boolean(),
  hints: z.boolean(),
  // The learner's own words, and they go into a prompt: a topic the length
  // of an essay is a way of talking past everything above it.
  topic: z.string().trim().max(TALK_TOPIC_MAX_CHARS),
  persona: z.string().max(64).optional(),
});

/** A word or a suggestion as Claude gave it back, on its way into the record. */
const savedWord = z.object({
  hanzi: z.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z.string().max(TALK_LINE_MAX_CHARS),
});

const savedTurn = z.object({
  who: z.enum(['tutor', 'learner']),
  hanzi: z.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z.string().max(TALK_LINE_MAX_CHARS * 2),
  words: z.array(savedWord).max(10).optional(),
  hints: z.array(savedWord).max(10).optional(),
  note: z.string().max(TALK_LINE_MAX_CHARS * 2).optional(),
});

const recordedRequest = z.object({
  voice: z.string().min(1).max(64),
  mode: z.enum(TALK_MODES as [string, ...string[]]).optional(),
  texts: z.array(z.string().max(TALK_LINE_MAX_CHARS)).max(TALK_RECORDED_MAX),
});

/** One sentence's recording, as MP3 in base64: a sentence of a text is a few seconds, well under a megabyte. */
export const RECORDING_MAX_BYTES = 1024 * 1024;
const keepRequest = z.object({
  voice: z.object({ id: z.string().min(2).max(64), name: z.string().min(1).max(80), gender: z.enum(['female', 'male']) }),
  mode: z.enum(TALK_MODES as [string, ...string[]]).optional(),
  text: z.string().trim().min(1).max(TALK_LINE_MAX_CHARS),
  mp3: z.string().min(1).max(Math.ceil((RECORDING_MAX_BYTES * 4) / 3) + 8),
});

/**
 * Who may put recordings in: they are kept for everybody (a sentence's
 * reading is the same reading whoever asks), so only the accounts named in
 * HANZI_RECORDERS, the admin account unless it says otherwise.
 */
const recorders = () => new Set((process.env.HANZI_RECORDERS ?? 'admin').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean));

const startRequest = z.object({
  options: talkOptions,
  voice: z.string().max(64).nullable(),
});

const saveRequest = z.object({
  options: talkOptions,
  voice: z.string().max(64).nullable(),
  turns: z.array(savedTurn).max(TALK_SAVED_TURNS_MAX),
});

const replyRequest = z.object({
  lines: z
    .array(z.object({ who: z.enum(['tutor', 'learner']), text: z.string().trim().min(1).max(TALK_LINE_MAX_CHARS) }))
    // A longer conversation is fine; only its end goes to Claude.
    .max(TALK_MAX_LINES * 5),
  options: talkOptions,
  vocab: z
    .object({
      known: z.array(z.string().max(12)).max(TALK_VOCAB_MAX.known),
      learning: z.array(z.string().max(12)).max(TALK_VOCAB_MAX.learning),
    })
    .optional(),
});

/**
 * Talking with Claude out loud, for signed-in users only.
 *
 *   GET    /api/talk?voice=chen   whether Claude can be asked from here, and the voices that can read its answers
 *   POST   /api/talk/reply        { lines, options } → Claude's next turn
 *   GET    /api/talk/audio?text&voice&mode=teaching&keep=1   an MP3 of one sentence: its recording, or a
 *                                                     local voice reading it now (and, with keep, recording it)
 *   POST   /api/talk/recorded     { voice, mode, texts } → which of these sentences are recorded in that voice
 *
 * and the conversations that are kept, so one can be come back to:
 *
 *   GET    /api/talk/conversations       the list, newest first
 *   POST   /api/talk/conversations       { options, voice } → a new, empty one
 *   GET    /api/talk/conversations/:id   one, with all of its turns
 *   PUT    /api/talk/conversations/:id   { options, voice, turns } → the thread as the page now has it
 *   DELETE /api/talk/conversations/:id
 *
 * The status call also gets the chosen voice's model loading, so that the
 * several seconds it takes are spent while the learner is still reading the
 * page rather than after their first sentence.
 */
export function talkRoutes({ auth, clock, trustProxy, tutor, talkVoices, conversations, recordings }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // Far more than anyone talking will reach, and a stop to a page stuck in a loop
  // before it spends the subscription's allowance.
  const turns = new RateLimiter(120, 10 * 60_000, clock);
  const clips = new RateLimiter(600, 10 * 60_000, clock);
  // A save a turn, with room to spare for a page that retries.
  const saves = new RateLimiter(400, 10 * 60_000, clock);

  routes.get('/', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    talkVoices?.warm?.(c.req.query('voice'));
    const body: TalkStatusResponse = {
      claude: { state: tutor ? await tutor.status() : 'missing' },
      voices: await recordings.voices(),
    };
    return c.json(body);
  });

  routes.post('/reply', session, async (c) => {
    if (!tutor) throw new TutorUnavailableError('Claude Code is not installed on this server.');
    const input = await readJson(c, replyRequest);
    turns.consume(c.get('session').user.id);
    const reply: TalkReply = await tutor.reply({
      lines: input.lines,
      options: input.options as TalkOptions,
      ...(input.vocab && { vocab: input.vocab }),
    });
    c.header('Cache-Control', 'no-store');
    return c.json(reply);
  });

  routes.get('/audio', session, async (c) => {
    const text = (c.req.query('text') ?? '').trim();
    const voice = c.req.query('voice') ?? talkVoices?.voices[0]?.id;
    const asked = c.req.query('mode');
    const mode = (TALK_MODES as readonly string[]).includes(asked ?? '') ? (asked as TalkMode) : 'conversation';
    if (!voice) throw new AppError('not_found', 'No local voice is set up on this server.');
    if (!text) throw new ValidationError('Nothing to say.');
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);

    clips.consume(c.get('session').user.id);
    // A sentence of a text is kept as it is read, for the website to play;
    // a turn of a conversation is never asked for twice.
    const audio = await recordings.read(text, voice, mode, c.req.query('keep') === '1');
    c.header('Content-Type', 'audio/mpeg');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(audio as Uint8Array<ArrayBuffer>);
  });

  routes.post('/recorded', session, async (c) => {
    const input = await readJson(c, recordedRequest);
    c.header('Cache-Control', 'no-store');
    const body: TalkRecordedResponse = { have: await recordings.have(input.voice, (input.mode as TalkMode | undefined) ?? 'teaching', input.texts) };
    return c.json(body);
  });

  routes.put('/recordings', session, async (c) => {
    const user = c.get('session').user;
    if (!recorders().has(user.username.toLowerCase())) throw new AppError('forbidden', 'This account cannot put recordings in.');
    clips.consume(user.id);
    const input = await readJson(c, keepRequest);
    const mp3 = new Uint8Array(Buffer.from(input.mp3, 'base64'));
    if (mp3.length > RECORDING_MAX_BYTES) throw new ValidationError('A sentence’s recording is at most a megabyte.');
    await recordings.keep(input.voice, (input.mode as TalkMode | undefined) ?? 'teaching', input.text, mp3);
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: true });
  });

  // Kept conversations. The page saves the whole thread after each turn, so
  // closing the iPad mid-sentence loses at most the turn being spoken.
  routes.get('/conversations', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ conversations: await conversations.list(c.get('session').user.id) });
  });

  routes.post('/conversations', session, async (c) => {
    const input = await readJson(c, startRequest);
    saves.consume(c.get('session').user.id);
    const made = await conversations.start(c.get('session').user.id, input.options as TalkOptions, input.voice);
    c.header('Cache-Control', 'no-store');
    return c.json(made, 201);
  });

  routes.get('/conversations/:id', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await conversations.open(c.get('session').user.id, c.req.param('id')));
  });

  routes.put('/conversations/:id', session, async (c) => {
    const input = await readJson(c, saveRequest);
    saves.consume(c.get('session').user.id);
    const saved = await conversations.save(c.get('session').user.id, c.req.param('id'), {
      options: input.options as TalkOptions,
      voice: input.voice,
      turns: input.turns as TalkSavedTurn[],
    });
    c.header('Cache-Control', 'no-store');
    return c.json(saved);
  });

  routes.delete('/conversations/:id', session, async (c) => {
    await conversations.remove(c.get('session').user.id, c.req.param('id'));
    return c.body(null, 204);
  });

  return routes;
}
