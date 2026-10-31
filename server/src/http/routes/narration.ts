import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { EMOTIONS } from '../../../../shared/narration';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const keyRequest = z.object({ key: z.string().min(1).max(400) });
const lines = z.array(z.string().max(240)).min(1).max(300);
const textRequest = z.object({ narrator: z.string().min(1).max(80), lines, generate: z.boolean().optional(), again: z.boolean().optional() });
const ofRequest = z.object({ lines });
const designRequest = z.object({ name: z.string().trim().min(1).max(60), prompt: z.string().trim().min(1).max(2000), previewText: z.string().trim().min(1).max(200) });
const adoptRequest = z.object({ name: z.string().max(60), voice: z.string().min(1).max(120) });
const changeRequest = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  pitch: z.number().min(-12).max(12).optional(),
  emotion: z.enum(EMOTIONS).nullable().optional(),
});
const previewRequest = z.object({ text: z.string().max(200) });

const mp3 = (c: Context<AppEnv>, bytes: Uint8Array) => {
  c.header('Content-Type', 'audio/mpeg');
  c.header('Cache-Control', 'no-store');
  return c.body(bytes as Uint8Array<ArrayBuffer>);
};

/**
 * Texts read aloud by MiniMax with the learner's own key, and the narrators
 * who read them (see shared/narration.ts for the routes). A whole
 * text is read in one request, kept, and played from then on without asking
 * MiniMax again.
 */
export function narrationRoutes({ auth, clock, trustProxy, narration }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // A text is a few dozen sentences; a page stuck in a loop would spend the learner's money.
  const reads = new RateLimiter(200, 10 * 60_000, clock);
  const keys = new RateLimiter(20, 10 * 60_000, clock);
  const makes = new RateLimiter(30, 10 * 60_000, clock);
  const user = (c: Context<AppEnv>) => c.get('session').user.id;
  const json = <T,>(c: Context<AppEnv>, body: T) => {
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  };

  routes.get('/', session, async (c) => json(c, await narration.status(user(c))));

  routes.put('/key', session, async (c) => {
    keys.consume(user(c));
    const { key } = await readJson(c, keyRequest);
    return json(c, await narration.setKey(user(c), key));
  });

  routes.delete('/key', session, async (c) => json(c, await narration.deleteKey(user(c))));

  routes.get('/voices', session, async (c) => json(c, { voices: await narration.voices(user(c)) }));

  routes.get('/narrators', session, async (c) => json(c, { narrators: await narration.narrators(user(c)) }));

  routes.post('/narrators/design', session, async (c) => {
    makes.consume(user(c));
    const input = await readJson(c, designRequest);
    const { narrator, trial } = await narration.design(user(c), input);
    return json(c, { narrator, trial: Buffer.from(trial).toString('base64') });
  });

  routes.post('/narrators', session, async (c) => {
    makes.consume(user(c));
    const input = await readJson(c, adoptRequest);
    return json(c, { narrator: await narration.adopt(user(c), input) });
  });

  routes.patch('/narrators/:id', session, async (c) => {
    const change = await readJson(c, changeRequest);
    return json(c, { narrator: await narration.change(user(c), c.req.param('id'), change) });
  });

  routes.delete('/narrators/:id', session, async (c) => {
    await narration.remove(user(c), c.req.param('id'));
    return json(c, { ok: true });
  });

  routes.post('/narrators/:id/preview', session, async (c) => {
    reads.consume(user(c));
    const { text } = await readJson(c, previewRequest);
    return mp3(c, await narration.preview(user(c), c.req.param('id'), text));
  });

  routes.post('/texts', session, async (c) => {
    const input = await readJson(c, textRequest);
    if (input.generate || input.again) reads.consume(user(c));
    return json(c, { narration: await narration.text(user(c), input.narrator, input.lines, input) });
  });

  routes.post('/texts/of', session, async (c) => {
    const { lines: said } = await readJson(c, ofRequest);
    return json(c, { narrations: await narration.readingsOf(user(c), said) });
  });

  // The key names the reading as it is; ?v= its making, so a reading made again is fetched again.
  routes.get('/texts/:key/audio', session, async (c) => {
    const bytes = await narration.audio(user(c), c.req.param('key'));
    c.header('Content-Type', 'audio/mpeg');
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    return c.body(bytes as Uint8Array<ArrayBuffer>);
  });

  return routes;
}
