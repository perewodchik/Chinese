import { Hono } from 'hono';
import { z } from 'zod';
import type {
  AuthOptionsResponse,
  CurrentSessionResponse,
  SessionResponse,
} from '../../../../shared/api';
import { usernameKey } from '../../../../shared/credentials';
import type { AppEnv, RouteDeps } from '../env';
import { currentSession, RateLimiter, requireSession } from '../guards';
import {
  clearSessionCookie,
  clientIp,
  isHttps,
  readJson,
  readSessionToken,
  writeSessionCookie,
} from '../request';

const MINUTE = 60_000;

// Shapes only. What makes a good name or password is the service's decision.
const credentials = z.object({
  username: z.string().max(200),
  password: z.string().max(2048),
});

const passwordChange = z.object({
  currentPassword: z.string().max(2048),
  newPassword: z.string().max(2048),
});

export function authRoutes({ auth, clock, trustProxy }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  const sessionOptions = { trustProxy, clock };
  const session = requireSession(auth, sessionOptions);

  // Ten wrong passwords for one name from one address buys a quarter of an
  // hour's wait; a hundred attempts of any kind from one address does too.
  const perName = new RateLimiter(10, 15 * MINUTE, clock);
  const perAddress = new RateLimiter(100, 15 * MINUTE, clock);
  const signUps = new RateLimiter(20, 60 * MINUTE, clock);

  routes.get('/options', (c) => {
    const body: AuthOptionsResponse = { registration: auth.registration };
    return c.json(body);
  });

  // Asked on every page load. Nobody signed in is an ordinary answer rather
  // than a 401, which a browser would log as a failed request each time.
  routes.get('/session', async (c) => {
    c.header('Cache-Control', 'no-store');
    const active = await currentSession(c, auth, sessionOptions);
    const body: CurrentSessionResponse = { user: active?.user ?? null };
    return c.json(body);
  });

  routes.post('/register', async (c) => {
    signUps.consume(clientIp(c, trustProxy));
    const input = await readJson(c, credentials);
    const issued = await auth.register({ ...input, userAgent: c.req.header('user-agent') ?? null });
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body: SessionResponse = { user: issued.user };
    return c.json(body, 201);
  });

  routes.post('/login', async (c) => {
    const input = await readJson(c, credentials);
    const ip = clientIp(c, trustProxy);
    const nameKey = `${ip} ${usernameKey(input.username)}`;
    perAddress.consume(ip);
    perName.consume(nameKey);

    const issued = await auth.login({ ...input, userAgent: c.req.header('user-agent') ?? null });
    perName.reset(nameKey);
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body: SessionResponse = { user: issued.user };
    return c.json(body);
  });

  routes.post('/logout', async (c) => {
    await auth.logout(readSessionToken(c));
    clearSessionCookie(c, isHttps(c, trustProxy));
    return c.body(null, 204);
  });

  routes.post('/password', session, async (c) => {
    const input = await readJson(c, passwordChange);
    const { user, sessionId } = c.get('session');
    await auth.changePassword({ userId: user.id, sessionId, ...input });
    return c.body(null, 204);
  });

  return routes;
}
