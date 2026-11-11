import type { Context, MiddlewareHandler } from 'hono';
import type { ActiveSession, AuthService } from '../application/auth-service';
import { usernameKey } from '../../../shared/credentials';
import type { AuditLog, Clock, RateLimitStore, Tutor } from '../application/ports';
import type { TokenScope } from '../../../shared/api';
import { ForbiddenError, ForbiddenOriginError, RateLimitedError, UnauthorizedError } from '../domain/errors';
import type { AppEnv } from './env';
import { clearSessionCookie, clientIp, isHttps, readSessionToken, writeSessionCookie } from './request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Refuses anything that changes state unless it came from a page of this app.
 *
 * The session cookie is SameSite=Lax already, which stops most of it; this is
 * the rest. A modern browser says where a request came from in
 * `Sec-Fetch-Site`, and failing that in `Origin`. A request carrying neither
 * did not come from a browser at all, so it is not a forged one either.
 */
export function sameOriginOnly(): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();

    const site = c.req.header('sec-fetch-site');
    if (site) {
      if (site === 'same-origin' || site === 'none') return next();
      throw new ForbiddenOriginError();
    }
    const origin = c.req.header('origin');
    if (!origin) return next();

    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* a malformed Origin is not a matching one */
    }
    if (originHost && originHost === c.req.header('host')) return next();
    throw new ForbiddenOriginError();
  };
}

/**
 * Claude for this account, or null: the server's subscription is for the
 * accounts named in HANZI_TUTOR_USERS (every account when it is not set).
 */
export function tutorFor(tutor: Tutor | null, tutorUsers: string[] | null, user: { username: string }): Tutor | null {
  if (!tutor) return null;
  return !tutorUsers || tutorUsers.includes(usernameKey(user.username)) ? tutor : null;
}

/**
 * Writes down what happened to an account, for whoever runs the site, and
 * now and then forgets what is older than ninety days. A line that cannot be
 * written never fails what was asked for.
 */
export function auditor(audit: AuditLog, clock: Clock, trustProxy: boolean, ipHeader: string | null, log: (line: string) => void) {
  return (c: Context, kind: string, username: string) => {
    const at = clock.now();
    void audit
      .add({ at, kind, username: username.trim().slice(0, 64), ip: clientIp(c, trustProxy, ipHeader), userAgent: c.req.header('user-agent')?.slice(0, 300) ?? null })
      .then(() => (Math.random() < 0.01 ? audit.sweep(at - 90 * 86_400_000) : undefined))
      .catch((err: unknown) => log(`audit: could not write ${kind}: ${err instanceof Error ? err.message : String(err)}`));
  };
}

interface SessionOptions {
  trustProxy: boolean;
  clock: Clock;
}

/**
 * The session this request's cookie opens, if it opens one. A cookie that no
 * longer opens anything is cleared rather than sent back forever, and one whose
 * expiry has just moved goes back out with the new one.
 */
export async function currentSession(
  c: Context,
  auth: AuthService,
  opts: SessionOptions,
): Promise<ActiveSession | null> {
  const token = readSessionToken(c);
  if (!token) return null;
  const session = await auth.authenticate(token);
  const secure = isHttps(c, opts.trustProxy);
  if (!session) clearSessionCookie(c, secure);
  else if (session.renewed) writeSessionCookie(c, token, session.expiresAt - opts.clock.now(), secure);
  return session;
}

/** The token in `Authorization: Bearer …`, or null when the request carries none. */
export function bearerToken(c: Context): string | null {
  const header = c.req.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  // An Authorization header that is not a bearer token opens nothing either.
  return match?.[1] ?? '';
}

/**
 * Lets a request through only with a live session, which handlers then read
 * from `c.get('session')`.
 *
 * A request with `Authorization: Bearer hzw_…` is a script's, and is judged
 * by its token alone: the cookie is not read. It gets through only where the
 * route names a scope the token has (`tokenScope`); everywhere else — the
 * password, the account, the keys, the admin pages, the tokens themselves —
 * a working token is refused with 403, and one that does not work with 401.
 */
export function requireSession(auth: AuthService, opts: SessionOptions, tokenScope?: TokenScope): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const bearer = bearerToken(c);
    if (bearer !== null) {
      const opened = await auth.authenticateAccessToken(bearer);
      if (!opened) throw new UnauthorizedError();
      if (!tokenScope || !opened.scopes?.includes(tokenScope)) throw new ForbiddenError('An access token cannot do that. Sign in on the site instead.');
      c.set('session', opened);
      return next();
    }
    const session = await currentSession(c, auth, opts);
    if (!session) throw new UnauthorizedError();
    c.set('session', session);
    await next();
  };
}

/**
 * Attempts per key per window, counted in the database (`RateLimitStore`).
 *
 * In memory was enough for one process on one machine; on Vercel each request
 * may meet a different instance and a cold one starts from nothing, so a count
 * kept in memory stopped nobody. The windows are fixed — this minute's ten,
 * then the next minute's — which is simpler to share than a sliding one and
 * just as good at what it is for: a ceiling no person meets and a loop does.
 *
 * Each limiter has a name, so two limiters counting the same key (a user's
 * readings and a user's keys) never share a count.
 */
export class RateLimiter {
  constructor(
    private readonly name: string,
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock,
    private readonly store: RateLimitStore,
  ) {}

  /** Counts one attempt against `key`, and throws once the window is used up. */
  async consume(key: string): Promise<void> {
    const now = this.clock.now();
    const start = Math.floor(now / this.windowMs) * this.windowMs;
    const count = await this.store.hit(`${this.name}:${key}`, start);
    // Now and then, the windows that ended more than a day ago go.
    if (count === 1 && Math.random() < 0.02) void this.store.sweep(now - 86_400_000).catch(() => undefined);
    if (count > this.limit) throw new RateLimitedError(Math.max(1, Math.ceil((start + this.windowMs - now) / 1000)));
  }

  reset(key: string): Promise<void> {
    return this.store.reset(`${this.name}:${key}`);
  }
}
