import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AdminAccountPage, AdminLogPage, AdminOverview, AdminWatch } from '../../../../shared/admin';
import type { Actor } from '../../application/ports';
import type { AppEnv, RouteDeps } from '../env';
import { auditor, RateLimiter, requireFresh, requireRole, requireSession } from '../guards';
import { clientIp, readJson } from '../request';
import { publishSchema } from '../../application/catalog-schema';
import { FEEDBACK_STATUSES } from '../../../../shared/feedback';

const inviteRequest = z.object({ note: z.string().trim().max(120), days: z.number().int().min(0).max(365) });
const logQuery = z.object({
  action: z.string().max(40).optional(),
  name: z.string().max(200).optional(),
  before: z.coerce.number().int().positive().optional(),
});
const LOG_PAGE = 50;
const blockRequest = z.object({ reason: z.string().trim().min(1, 'Say why, for the log.').max(300) });

/**
 * For the accounts that run the site (role `admin`): the accounts, how
 * much each keeps and spends, and invitations made from the phone rather
 * than from a terminal (see shared/admin.ts for the routes).
 *
 * Nothing here reads anyone's work: names, dates, sizes and counts.
 */
export function adminRoutes({ auth, clock, trustProxy, ipHeader, log, limits, storage, audit, catalog, feedback, site }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  const admin = requireRole('admin');
  // Everything here that changes something asks for the password again when it was typed long ago.
  const fresh = requireFresh(auth);
  const invites = new RateLimiter('admin.invites', 50, 60 * 60_000, clock, limits);

  routes.get('/', session, admin, (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ admin: true });
  });

  /**
   * SEC15: what is worth a look today — sign-ins refused and limits reached in
   * the last day, and any admin signed in from a browser their sign-ins of the
   * last ninety days have not come from.
   */
  async function watchOf(): Promise<AdminWatch> {
    const now = clock.now();
    const day = now - 86_400_000;
    const today = await audit.since(day, ['sign-in-refused', 'reauth-refused', 'recovery-refused', 'reset-refused', 'rate-limited'], 10_000);
    const admins = new Set((await auth.accounts()).filter((a) => a.role === 'admin').map((a) => a.username));
    const signIns = await audit.since(now - 90 * 86_400_000, ['sign-in', 'recovery', 'reset'], 20_000);
    const seen = new Map<string, Set<string>>();
    const fresh: AdminWatch['newAdminDevices'] = [];
    for (const e of signIns) {
      if (!admins.has(e.username)) continue;
      const browsers = seen.get(e.username) ?? new Set<string>();
      const agent = e.userAgent ?? '';
      // The first sign-in on record is where the account began, not news.
      if (e.at >= day && browsers.size > 0 && !browsers.has(agent)) fresh.push({ username: e.username, userAgent: e.userAgent, at: e.at });
      browsers.add(agent);
      seen.set(e.username, browsers);
    }
    return {
      refusedToday: today.filter((e) => e.kind !== 'rate-limited').length,
      limitedToday: today.filter((e) => e.kind === 'rate-limited').length,
      newAdminDevices: fresh,
    };
  }

  routes.get('/overview', session, admin, async (c) => {
    // The first page, seen last first, from one query (A4, SEC14): no longer three queries an account.
    const first = await auth.accountPage({});
    const body: AdminOverview = {
      registration: await auth.registration(),
      storageLimitBytes: await storage.limitBytes(),
      accounts: first.rows,
      accountsTotal: first.total,
      invites: (await auth.invites()).reverse(),
      events: (await audit.recent(60)).map(({ at, kind, username, userAgent }) => ({ at, kind, username, userAgent })),
      watch: await watchOf(),
    };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  // A4: the accounts a page at a time, searched by name and sorted.
  const accountsQuery = z.object({ q: z.string().max(64).optional(), sort: z.enum(['seen', 'joined', 'room', 'spent']).optional(), page: z.coerce.number().int().min(0).max(10_000).optional() });
  routes.get('/accounts', session, admin, async (c) => {
    const parsed = accountsQuery.safeParse(c.req.query());
    const q = parsed.success ? parsed.data : {};
    const found = await auth.accountPage(q);
    const body: AdminAccountPage = { accounts: found.rows, total: found.total, page: found.page, pages: found.pages };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  /** The admin making this request, as the log names them. */
  const actor = (c: Context<AppEnv>): Actor => {
    const { user } = c.get('session');
    return { id: user.id, name: user.username, ip: clientIp(c, trustProxy, ipHeader) };
  };

  routes.get('/log', session, admin, async (c) => {
    const parsed = logQuery.safeParse(c.req.query());
    const q = parsed.success ? parsed.data : {};
    const rows = await auth.adminLogPage({ action: q.action || undefined, name: q.name?.trim() || undefined, before: q.before, limit: LOG_PAGE + 1 });
    const page = rows.slice(0, LOG_PAGE);
    const body: AdminLogPage = {
      entries: page.map((r) => ({ id: r.id!, at: r.at, actor: r.actorName, action: r.action, target: r.targetName, details: r.details })),
      next: rows.length > LOG_PAGE ? (page[page.length - 1]?.id ?? null) : null,
    };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  // Pausing, opening again and signing out everywhere: few, and each one in
  // the log. A loop that pauses every account is what the limit is for.
  const changes = new RateLimiter('admin.accounts', 60, 60 * 60_000, clock, limits);

  routes.post('/accounts/:id/block', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    const { reason } = await readJson(c, blockRequest);
    await auth.setStatusById(c.req.param('id'), 'blocked', actor(c), reason);
    return c.body(null, 204);
  });

  routes.post('/accounts/:id/unblock', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    await auth.setStatusById(c.req.param('id'), 'active', actor(c));
    return c.body(null, 204);
  });

  // A6: a link for someone locked out, to pass on by hand; the admin never sees or sets the password.
  routes.post('/accounts/:id/reset-link', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    c.header('Cache-Control', 'no-store');
    return c.json(await auth.makeResetLink(c.req.param('id'), actor(c)));
  });

  routes.post('/accounts/:id/sign-out', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    return c.json(await auth.signOutEverywhere(c.req.param('id'), actor(c)));
  });

  // The shared catalogue (T1): a shelf published as a book, a new version of
  // it, hidden or shown again. Checked against the catalogue's schema here
  // (SEC12): what goes in is read by every learner.
  const hideRequest = z.object({ hidden: z.boolean() });
  routes.get('/catalog', session, admin, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await catalog.list(true));
  });
  routes.post('/catalog', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    const { book, texts } = await readJson(c, publishSchema);
    const who = actor(c);
    return c.json(await catalog.publish({ ...who, id: c.get('session').user.id }, book, texts), 201);
  });
  routes.put('/catalog/:id', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    const { book, texts } = await readJson(c, publishSchema);
    const who = actor(c);
    return c.json(await catalog.publish({ ...who, id: c.get('session').user.id }, book, texts, c.req.param('id')));
  });
  routes.patch('/catalog/:id', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    const { hidden } = await readJson(c, hideRequest);
    await catalog.setHidden(actor(c), c.req.param('id'), hidden);
    return c.body(null, 204);
  });

  // A11: the site's own settings, changed here without a deploy.
  routes.get('/settings', session, admin, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(await site.view());
  });
  const settingsChange = z
    .object({
      registration: z.enum(['open', 'invite', 'closed']).optional(),
      storageLimitMb: z.number().int().nullable().optional(),
      announcement: z.string().max(1000).optional(),
    })
    .strict();
  routes.put('/settings', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    c.header('Cache-Control', 'no-store');
    return c.json(await site.change(await readJson(c, settingsChange), actor(c)));
  });

  // A12: feedback sent from the site, and where each stands.
  routes.get('/feedback', session, admin, async (c) => {
    const status = c.req.query('status');
    c.header('Cache-Control', 'no-store');
    return c.json({ items: await feedback.list((FEEDBACK_STATUSES as readonly string[]).includes(status ?? '') ? (status as (typeof FEEDBACK_STATUSES)[number]) : undefined) });
  });
  const feedbackStatus = z.object({ status: z.enum(FEEDBACK_STATUSES) });
  routes.patch('/feedback/:id', session, admin, async (c) => {
    await changes.consume(c.get('session').user.id);
    await feedback.setStatus(c.req.param('id'), (await readJson(c, feedbackStatus)).status);
    return c.body(null, 204);
  });

  // A8: an invitation taken back before it was used.
  routes.post('/invites/:id/revoke', session, admin, fresh, async (c) => {
    await changes.consume(c.get('session').user.id);
    await auth.revokeInvite(c.req.param('id'), actor(c));
    return c.body(null, 204);
  });

  routes.post('/invites', session, admin, fresh, async (c) => {
    await invites.consume(c.get('session').user.id);
    const { note, days } = await readJson(c, inviteRequest);
    const made = await auth.invite(note, days === 0 ? null : days, actor(c));
    auditor(audit, clock, trustProxy, ipHeader, log)(c, 'invite', c.get('session').user.username);
    c.header('Cache-Control', 'no-store');
    return c.json({ code: made.code, expiresAt: made.expiresAt }, 201);
  });

  return routes;
}
