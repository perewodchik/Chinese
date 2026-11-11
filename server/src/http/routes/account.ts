import { Hono } from 'hono';
import { z } from 'zod';
import { TOKEN_SCOPES, type AccessTokensResponse, type MadeAccessTokenResponse } from '../../../../shared/api';
import type { UsageResponse } from '../../../../shared/usage';
import { TOKEN_DAYS_MAX } from '../../application/auth-service';
import { ForbiddenError, NotFoundError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { auditor, RateLimiter, requireSession } from '../guards';
import { clearSessionCookie, isHttps, readJson } from '../request';

/**
 * The account's own pages' questions.
 *
 *   GET /api/account/usage    what the learner's own keys have been spent on (shared/usage.ts)
 *   GET /api/account/export   everything the account keeps, as one JSON file to download
 *   DELETE /api/account       { password } → the account and all it kept, gone
 *   GET /api/account/storage  how much the account keeps, out of how much it may
 *   GET /api/account/tokens   the account's access tokens for scripts (never the tokens themselves)
 *   POST /api/account/tokens  { name, days, scopes? } → a new token, shown this once
 *   DELETE /api/account/tokens/:id  that token stops working
 */
const deleteRequest = z.object({ password: z.string().max(2048) });
const tokenRequest = z.object({
  name: z.string().max(200),
  days: z.number().int().min(1).max(TOKEN_DAYS_MAX),
  scopes: z.array(z.enum(TOKEN_SCOPES)).max(TOKEN_SCOPES.length).optional(),
});
export function accountRoutes({ auth, clock, trustProxy, usage, speechEval, narration, workspaces, world, conversations, limits, storage, audit, ipHeader, log }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  // The password is asked for, so a guesser with a stolen cookie gets as few tries as at the sign-in page.
  const deletes = new RateLimiter('account.deletes', 10, 15 * 60_000, clock, limits);
  // Nobody makes more than a few tokens in a day; a loop would make thousands.
  const tokenMakes = new RateLimiter('account.tokens', 30, 60 * 60_000, clock, limits);
  const note = auditor(audit, clock, trustProxy, ipHeader, log);

  routes.delete('/', session, async (c) => {
    const { user } = c.get('session');
    await deletes.consume(user.id);
    const { password } = await readJson(c, deleteRequest);
    await auth.deleteAccount({ userId: user.id, password });
    note(c, 'deleted', user.username);
    clearSessionCookie(c, isHttps(c, trustProxy));
    return c.body(null, 204);
  });

  // Tokens are made, listed and revoked only from a browser signed in with
  // the password: requireSession refuses a token here, so one token can
  // neither make another nor outlive being revoked.
  routes.get('/tokens', session, async (c) => {
    const body: AccessTokensResponse = { tokens: await auth.accessTokensOf(c.get('session').user.id) };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  routes.post('/tokens', session, async (c) => {
    const { user } = c.get('session');
    await tokenMakes.consume(user.id);
    const input = await readJson(c, tokenRequest);
    const scopes = input.scopes ?? ['texts:write'];
    if (scopes.includes('catalog:write') && user.role !== 'admin') {
      throw new ForbiddenError('Only the accounts that run the site may publish to the catalogue.');
    }
    const made = await auth.makeAccessToken(user.id, { name: input.name, days: input.days, scopes });
    note(c, 'token-made', user.username);
    const body: MadeAccessTokenResponse = made;
    c.header('Cache-Control', 'no-store');
    return c.json(body, 201);
  });

  routes.delete('/tokens/:id', session, async (c) => {
    const { user } = c.get('session');
    if (!(await auth.revokeAccessToken(user.id, c.req.param('id')))) throw new NotFoundError('That token');
    note(c, 'token-revoked', user.username);
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

  routes.get('/storage', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await storage.use(c.get('session').user.id));
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
