import { Hono } from 'hono';
import { z } from 'zod';
import type { UsageResponse } from '../../../../shared/usage';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { clearSessionCookie, isHttps, readJson } from '../request';

/**
 * The account's own pages' questions.
 *
 *   GET /api/account/usage    what the learner's own keys have been spent on (shared/usage.ts)
 *   GET /api/account/export   everything the account keeps, as one JSON file to download
 *   DELETE /api/account       { password } → the account and all it kept, gone
 */
const deleteRequest = z.object({ password: z.string().max(2048) });
export function accountRoutes({ auth, clock, trustProxy, usage, speechEval, narration, workspaces, world, conversations, limits }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // The password is asked for, so a guesser with a stolen cookie gets as few tries as at the sign-in page.
  const deletes = new RateLimiter('account.deletes', 10, 15 * 60_000, clock, limits);

  routes.delete('/', session, async (c) => {
    const { user } = c.get('session');
    await deletes.consume(user.id);
    const { password } = await readJson(c, deleteRequest);
    await auth.deleteAccount({ userId: user.id, password });
    clearSessionCookie(c, isHttps(c, trustProxy));
    return c.body(null, 204);
  });

  routes.get('/usage', session, async (c) => {
    const user = c.get('session').user.id;
    const [scoring, reading] = await Promise.all([speechEval.status(user), narration.status(user)]);
    const body: UsageResponse = await usage.summary(user, {
      speechsuper: scoring.key.set && scoring.key.provider === 'speechsuper',
      iflytek: scoring.key.set && scoring.key.provider === 'iflytek',
      minimax: reading.key.set,
    });
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  // A copy of the work to keep: the workspace as the app saves it, the game,
  // the conversations, the tries and the narrators. Not the keys, which are
  // never sent back, nor the recordings and pictures, which are files of
  // their own rather than work.
  routes.get('/export', session, async (c) => {
    const { user } = c.get('session');
    const [workspace, game, talks, tries, narrators, ownTexts] = await Promise.all([
      workspaces.get(user.id),
      world.get(user.id),
      conversations.list(user.id),
      speechEval.attempts(user.id),
      narration.narrators(user.id).catch(() => []),
      narration.ownTexts(user.id).catch(() => []),
    ]);
    const body = {
      app: 'Hanzi Workshop',
      exportedAt: new Date(clock.now()).toISOString(),
      account: { username: user.username, createdAt: new Date(user.createdAt).toISOString() },
      workspace,
      world: game,
      conversations: await Promise.all(talks.map((t) => conversations.open(user.id, t.id))),
      speechAttempts: tries,
      narrators,
      ownTexts,
    };
    const day = new Date(clock.now()).toISOString().slice(0, 10);
    const name = `hanzi-workshop-${user.username.replace(/[^\p{L}\p{N}._-]/gu, '') || 'account'}-${day}.json`;
    c.header('Cache-Control', 'no-store');
    c.header('Content-Type', 'application/json; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    return c.body(JSON.stringify(body, null, 1));
  });

  return routes;
}
