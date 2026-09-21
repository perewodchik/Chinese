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

/**
 * A request from this machine, or from a device on the same home network —
 * the kinds the development sign-in answers. An address from anywhere else is
 * refused even here, in case the dev server is ever reachable from outside:
 * the password is the only thing standing in the way then.
 */
function isLocalNetwork(ip: string): boolean {
  const plain = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  const octets = plain.split('.');
  if (octets.length === 4) {
    if (!octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255)) return false;
    const [a, b] = octets.map(Number) as [number, number, number, number];
    if (a === 127) return true; // this machine
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    return a === 169 && b === 254; // link-local, when there is no router
  }
  const v6 = (plain.split('%')[0] ?? '').toLowerCase(); // without any zone
  if (v6 === '::1') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local
  return /^fe[89ab]/.test(v6); // link-local
}

export function authRoutes({ auth, clock, trustProxy, devUser, devUserCreate, log }: RouteDeps) {
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
    // Development with HANZI_DEV_USER: nobody signed in, asked from this
    // machine or from the Wi-Fi it is on, is signed in as that account — so
    // the tablet you are testing on opens the app rather than a password box.
    if (!active && devUser && isLocalNetwork(clientIp(c, trustProxy))) {
      const issued = await auth.devSignIn(devUser, c.req.header('user-agent') ?? null, devUserCreate);
      // No such account, on a database this server is not allowed to add one
      // to: the sign-in page is the honest answer, and the name is worth
      // saying out loud because it is almost certainly misspelt.
      if (!issued) log(`No account called “${devUser}” in this database (HANZI_DEV_USER).`);
      else {
        writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
        const body: CurrentSessionResponse = { user: issued.user };
        return c.json(body);
      }
    }
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
