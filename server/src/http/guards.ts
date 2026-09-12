import type { Context, MiddlewareHandler } from 'hono';
import type { ActiveSession, AuthService } from '../application/auth-service';
import type { Clock } from '../application/ports';
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
 * Attempts per key per window, in memory.
 *
 * In memory is enough for one process on one machine, and it forgets on a
 * restart — which is a way round it only for someone who can already restart
 * the server.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: Clock,
  ) {}

  /** Counts one attempt against `key`, and throws once the window is used up. */
  consume(key: string): void {
    const now = this.clock.now();
    if (this.windows.size > 10_000) this.sweep(now);
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (window.count >= this.limit) {
      throw new RateLimitedError(Math.ceil((window.resetAt - now) / 1000));
    }
    window.count++;
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweep(now: number) {
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}
