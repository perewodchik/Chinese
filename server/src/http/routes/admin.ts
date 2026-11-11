import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AdminAccount, AdminLogPage, AdminOverview } from '../../../../shared/admin';
import type { Actor } from '../../application/ports';
import type { AppEnv, RouteDeps } from '../env';
import { auditor, RateLimiter, requireRole, requireSession } from '../guards';
import { clientIp, readJson } from '../request';

const inviteRequest = z.object({ note: z.string().trim().max(120), days: z.number().int().min(0).max(365) });
const logQuery = z.object({
  action: z.string().max(40).optional(),
  name: z.string().max(200).optional(),
  before: z.coerce.number().int().positive().optional(),
});
const LOG_PAGE = 50;

/**
 * For the accounts that run the site (role `admin`): the accounts, how
 * much each keeps and spends, and invitations made from the phone rather
 * than from a terminal (see shared/admin.ts for the routes).
 *
 * Nothing here reads anyone's work: names, dates, sizes and counts.
 */
export function adminRoutes({ auth, clock, trustProxy, ipHeader, log, limits, usage, storage, audit }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  const admin = requireRole('admin');
  const invites = new RateLimiter('admin.invites', 50, 60 * 60_000, clock, limits);

  routes.get('/', session, admin, (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ admin: true });
  });

  routes.get('/overview', session, admin, async (c) => {
    const users = await auth.listUsers();
    const none = { speechsuper: false, iflytek: false, minimax: false };
    const accounts: AdminAccount[] = await Promise.all(
      users.map(async (u) => {
        const [devices, room, spent] = await Promise.all([auth.sessionsOf(u.id, ''), storage.use(u.id), usage.summary(u.id, none)]);
        const month = (service: string) => spent.lines.find((l) => l.service === service)?.month ?? { calls: 0, units: 0 };
        return {
          username: u.username,
          createdAt: u.createdAt,
          lastSeenAt: devices.length ? Math.max(...devices.map((d) => d.lastSeenAt)) : null,
          devices: devices.length,
          storageBytes: room.usedBytes,
          scoredThisMonth: month('speechsuper').calls + month('iflytek').calls,
          charactersReadThisMonth: month('minimax').units,
        };
      }),
    );
    const body: AdminOverview = {
      registration: auth.registration,
      storageLimitBytes: storage.limitBytes,
      accounts: accounts.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
      invites: (await auth.invites()).reverse(),
      events: (await audit.recent(60)).map(({ at, kind, username, userAgent }) => ({ at, kind, username, userAgent })),
    };
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

  routes.post('/invites', session, admin, async (c) => {
    await invites.consume(c.get('session').user.id);
    const { note, days } = await readJson(c, inviteRequest);
    const made = await auth.invite(note, days === 0 ? null : days, actor(c));
    auditor(audit, clock, trustProxy, ipHeader, log)(c, 'invite', c.get('session').user.username);
    c.header('Cache-Control', 'no-store');
    return c.json({ code: made.code, expiresAt: made.expiresAt }, 201);
  });

  return routes;
}
