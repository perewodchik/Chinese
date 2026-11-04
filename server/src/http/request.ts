import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { z } from 'zod';
import { ValidationError } from '../domain/errors';

/** Reading a request, and the cookie that goes back with the response. */

export const SESSION_COOKIE = 'hanzi_session';

/**
 * Whether the browser reached us over https.
 *
 * It decides the cookie's `Secure` flag, which cannot simply always be on: over
 * the Wi-Fi at http://192.168… a Secure cookie is never stored at all, and
 * signing in would appear to work and then forget you on the next click.
 */
export function isHttps(c: Context, trustProxy: boolean): boolean {
  const forwarded = trustProxy ? c.req.header('x-forwarded-proto')?.split(',')[0]?.trim() : undefined;
  return (forwarded ?? new URL(c.req.url).protocol.replace(':', '')) === 'https';
}

/**
 * Where a request came from, for the limits counted per address.
 *
 * Behind a proxy of our own, the last X-Forwarded-For: the address the proxy
 * itself added. The ones before it are whatever the client sent, and a client
 * can send `127.0.0.1`. On Vercel, the
 * header Vercel itself sets (`ipHeader`, x-vercel-forwarded-for): a header a
 * client sent is not something Vercel vouches for, and an address a guesser
 * can choose is no limit at all.
 */
export function clientIp(c: Context, trustProxy: boolean, ipHeader: string | null = null): string {
  const named = trustProxy && ipHeader ? c.req.header(ipHeader)?.split(',')[0]?.trim() : undefined;
  if (named) return named;
  const forwarded = trustProxy ? c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() : undefined;
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // No socket behind this request — a test calling the app directly.
    return 'unknown';
  }
}

export const readSessionToken = (c: Context) => getCookie(c, SESSION_COOKIE);

export function writeSessionCookie(c: Context, token: string, maxAgeMs: number, secure: boolean) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
  });
}

export function clearSessionCookie(c: Context, secure: boolean) {
  deleteCookie(c, SESSION_COOKIE, { httpOnly: true, sameSite: 'Lax', secure, path: '/' });
}

/**
 * A JSON body, checked against a schema. Insisting on the JSON content type is
 * part of the cross-site defence as well as tidiness: a form on another site
 * can post to this server, but it cannot post JSON.
 */
export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.output<S>> {
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ValidationError('Send the request as JSON.');
  }
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError('The request body is not valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    fields[issue.path.map(String).join('.') || 'body'] ??= issue.message;
  }
  throw new ValidationError('The request is not in the expected shape.', fields);
}
