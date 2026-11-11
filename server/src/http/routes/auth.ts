import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type {
  AuthOptionsResponse,
  CurrentSessionResponse,
  SessionResponse,
  SessionsResponse,
} from '../../../../shared/api';
import { usernameKey } from '../../../../shared/credentials';
import { InvalidCredentialsError, NotFoundError, ValidationError } from '../../domain/errors';
import type { AppEnv, RouteDeps } from '../env';
import { errorBody } from '../errors';
import { auditor, currentSession, RateLimiter, requireSession } from '../guards';
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
const registration = credentials.extend({ invite: z.string().max(64).optional() });
const recoverRequest = z.object({ username: z.string().max(200), code: z.string().max(64), newPassword: z.string().max(2048) });

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

/**
 * A request that came through something in front of a server that was not
 * told about one. A tunnel (ngrok, cloudflared, a port forwarded by an
 * editor) connects from this machine, so its requests look local by their
 * address — and would be signed in without a password, from anywhere. It
 * says it forwarded them, though, and that is enough to refuse.
 */
function tunnelled(c: Context, trustProxy: boolean): boolean {
  if (trustProxy) return false;
  return ['x-forwarded-for', 'forwarded', 'x-real-ip', 'cf-connecting-ip', 'x-forwarded-host'].some((h) => c.req.header(h) !== undefined);
}

export function authRoutes({ auth, clock, trustProxy, ipHeader, devUser, devUserCreate, log, limits, audit }: RouteDeps) {
  const routes = new Hono<AppEnv>();
  // A name, a password, a code: a few hundred bytes. Anything longer is not a sign-in.
  routes.use('*', bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json(errorBody('payload_too_large', 'That is too long to be a name and a password.'), 413) }));
  const sessionOptions = { trustProxy, clock };
  const session = requireSession(auth, sessionOptions);
  const note = auditor(audit, clock, trustProxy, ipHeader, log);

  // Ten wrong passwords for one name from one address buys a quarter of an
  // hour's wait; a hundred attempts of any kind from one address does too.
  const perName = new RateLimiter('auth.perName', 10, 15 * MINUTE, clock, limits);
  const perAddress = new RateLimiter('auth.perAddress', 100, 15 * MINUTE, clock, limits);
  // And for one account from everywhere at once: the two above are counted
  // per address, so a guesser with a thousand addresses had a thousand times
  // the tries. Fifty an hour is more than anyone mistyping, and 1,200 a day
  // is nothing against a password that is not on the common list.
  const perAccount = new RateLimiter('auth.perAccount', 50, 60 * MINUTE, clock, limits);
  const signUps = new RateLimiter('auth.signUps', 20, 60 * MINUTE, clock, limits);

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
    if (!active && devUser && !tunnelled(c, trustProxy) && isLocalNetwork(clientIp(c, trustProxy, ipHeader))) {
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
    await signUps.consume(clientIp(c, trustProxy, ipHeader));
    const input = await readJson(c, registration);
    const issued = await auth.register({ ...input, userAgent: c.req.header('user-agent') ?? null });
    note(c, 'sign-up', issued.user.username);
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body: SessionResponse = { user: issued.user };
    return c.json(body, 201);
  });

  routes.post('/login', async (c) => {
    const input = await readJson(c, credentials);
    const ip = clientIp(c, trustProxy, ipHeader);
    const nameKey = `${ip} ${usernameKey(input.username)}`;
    await perAddress.consume(ip);
    await perName.consume(nameKey);
    await perAccount.consume(usernameKey(input.username));

    const issued = await auth.login({ ...input, userAgent: c.req.header('user-agent') ?? null }).catch((err: unknown) => {
      if (err instanceof InvalidCredentialsError) note(c, 'sign-in-refused', input.username);
      throw err;
    });
    note(c, 'sign-in', issued.user.username);
    await perName.reset(nameKey);
    await perAccount.reset(usernameKey(input.username));
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body: SessionResponse = { user: issued.user };
    return c.json(body);
  });

  routes.post('/logout', async (c) => {
    await auth.logout(readSessionToken(c));
    clearSessionCookie(c, isHttps(c, trustProxy));
    return c.body(null, 204);
  });

  // The browsers signed in to this account, to see and to sign out.
  routes.get('/sessions', session, async (c) => {
    const { user, sessionId } = c.get('session');
    c.header('Cache-Control', 'no-store');
    const body: SessionsResponse = { sessions: await auth.sessionsOf(user.id, sessionId) };
    return c.json(body);
  });

  routes.delete('/sessions/:id', session, async (c) => {
    if (!(await auth.signOutSession(c.get('session').user.id, c.req.param('id')))) throw new NotFoundError('That device');
    return c.body(null, 204);
  });

  routes.post('/sessions/others', session, async (c) => {
    const { user, sessionId } = c.get('session');
    return c.json({ signedOut: await auth.signOutOthers(user.id, sessionId) });
  });

  // Recovery codes: made (and shown) once with the password, used without one.
  const recoveries = new RateLimiter('auth.recoveries', 10, 15 * MINUTE, clock, limits);
  routes.get('/recovery-codes', session, async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ codes: await auth.recoveryStatus(c.get('session').user.id) });
  });

  routes.post('/recovery-codes', session, async (c) => {
    await recoveries.consume(c.get('session').user.id);
    const { password } = await readJson(c, z.object({ password: z.string().max(2048) }));
    c.header('Cache-Control', 'no-store');
    return c.json({ codes: await auth.makeRecoveryCodes({ userId: c.get('session').user.id, password }) });
  });

  routes.post('/recover', async (c) => {
    const input = await readJson(c, recoverRequest);
    const ip = clientIp(c, trustProxy, ipHeader);
    await perAddress.consume(ip);
    await recoveries.consume(`${ip} ${usernameKey(input.username)}`);
    await perAccount.consume(usernameKey(input.username));
    const issued = await auth.recover({ ...input, userAgent: c.req.header('user-agent') ?? null }).catch((err: unknown) => {
      if (err instanceof ValidationError && err.fields?.code) note(c, 'recovery-refused', input.username);
      throw err;
    });
    note(c, 'recovery', issued.user.username);
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body: SessionResponse = { user: issued.user };
    return c.json(body);
  });

  routes.post('/password', session, async (c) => {
    const input = await readJson(c, passwordChange);
    const { user, sessionId } = c.get('session');
    await auth.changePassword({ userId: user.id, sessionId, ...input });
    note(c, 'password', user.username);
    return c.body(null, 204);
  });

  return routes;
}
