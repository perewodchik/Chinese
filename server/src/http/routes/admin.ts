import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { AdminAccount, AdminOverview } from '../../../../shared/admin';
import { usernameKey } from '../../../../shared/credentials';
import { ForbiddenError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { RateLimiter, requireSession } from '../guards';
import { readJson } from '../request';

const inviteRequest = z.object({ note: z.string().trim().max(120), days: z.number().int().min(0).max(365) });

/**
 * For whoever runs the site, named in HANZI_ADMIN_USERS: the accounts, how
 * much each keeps and spends, and invitations made from the phone rather
 * than from a terminal (see shared/admin.ts for the routes).
 *
 * Nothing here reads anyone's work: names, dates, sizes and counts.
 */
export function adminRoutes({ auth, clock, trustProxy, adminUsers, limits, usage, storage }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const session = requireSession(auth, { trustProxy, clock });
  const admin: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (!adminUsers.includes(usernameKey(c.get('session').user.username))) throw new ForbiddenError();
    await next();
  };
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
    };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  routes.post('/invites', session, admin, async (c) => {
    await invites.consume(c.get('session').user.id);
    const { note, days } = await readJson(c, inviteRequest);
    const made = await auth.invite(note, days === 0 ? null : days);
    c.header('Cache-Control', 'no-store');
    return c.json({ code: made.code, expiresAt: made.expiresAt }, 201);
  });

  return routes;
}
