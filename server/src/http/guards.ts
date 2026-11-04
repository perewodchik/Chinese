import type { Context, MiddlewareHandler } from 'hono';
import type { ActiveSession, AuthService } from '../application/auth-service';
import { usernameKey } from '../../../shared/credentials';
import type { Clock, RateLimitStore, Tutor } from '../application/ports';
import { ForbiddenOriginError, RateLimitedError, UnauthorizedError } from '../domain/errors';
import type { AppEnv } from './env';
import { clearSessionCookie, isHttps, readSessionToken, writeSessionCookie } from './request';

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

/** Lets a request through only with a live session, which handlers then read from `c.get('session')`. */
export function requireSession(auth: AuthService, opts: SessionOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
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
