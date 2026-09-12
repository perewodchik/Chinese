import { getRequestListener } from '@hono/node-server';
import { createServices } from '../server/src/composition';
import { createHttpApp } from '../server/src/http/app';
import { databaseUrl, openPostgres } from '../server/src/infrastructure/postgres/database';
import { postgresStores } from '../server/src/infrastructure/postgres/stores';

/**
 * The API when the app runs on Vercel, where `server/src/main.ts` cannot: a
 * function has no port to listen on and no disk to keep a SQLite file. Only
 * the outermost layer differs — the same Hono app and the same services, over
 * Postgres instead of a file.
 *
 * Three things here are defensive rather than obvious, and each was paid for.
 *
 * It is a Node listener, not a `Request => Response`. Vercel's Node runtime
 * calls a function the way `node:http` does, so `req.url` is a bare path and
 * building a URL from it throws — which is a 500 before a line of ours runs.
 * `getRequestListener` is the adapter for exactly that, and it is already here
 * for the home server.
 *
 * The route arrives in a query parameter. Vercel's own file routing read
 * `api/[...path].ts` as one segment rather than as a catch-all, so /api/health
 * reached the function and /api/auth/session answered 404; vercel.json now
 * rewrites every /api/… onto this one function and hands the rest of the path
 * along, which leaves nothing to infer.
 *
 * And the imports are static, which is not a style choice. Vercel packages a
 * function by following its static imports; the same imports written as
 * `await import(...)` are left as lookups at run time for files that were
 * never packaged, and the function dies on "Cannot find module".
 */

const REGISTRATION = process.env.HANZI_REGISTRATION === 'closed' ? 'closed' : 'open';

type App = { fetch(request: Request): Response | Promise<Response> };

let building: Promise<App> | null = null;

function application(): Promise<App> {
  if (building) return building;
  const started = (async (): Promise<App> => {
    const url = databaseUrl();
    if (!url) {
      throw new Error(
        'No database: set POSTGRES_URL (or DATABASE_URL) on the Vercel project, then redeploy.',
      );
    }
    const pool = await openPostgres(url);
    const services = createServices(postgresStores(pool), {
      policy: { registration: REGISTRATION },
    });
    return createHttpApp(services, {
      trustProxy: true,
      staticDir: null,
      // Vercel compresses what it sends; a second pass here would only cost
      // the function time it is billed for.
      compress: false,
      log: (line) => console.error(line),
    });
  })();
  building = started;
  // A database that was briefly unreachable should not poison the instance.
  started.catch(() => {
    if (building === started) building = null;
  });
  return started;
}

/** The request as it was addressed, whatever the rewrite did to get it here. */
function asSent(request: Request): Request {
  const url = new URL(request.url);
  const path = url.searchParams.get('__path');
  if (path === null) return request;
  url.searchParams.delete('__path');
  url.pathname = `/api/${path}`;
  return new Request(url, request);
}

function failed(what: string, err: unknown, status: number): Response {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${what}: ${message}`);
  return Response.json({ error: { code: 'internal', message: `${what}. ${message}` } }, { status });
}

export default getRequestListener(async (incoming: Request): Promise<Response> => {
  let request: Request;
  try {
    request = asSent(incoming);
  } catch (err) {
    return failed('Could not read the request', err, 500);
  }

  // Answered before the database is touched, so that "the function runs" and
  // "the database answers" are two questions with two answers rather than one
  // failure that could be either. Everything else goes through the app, and
  // /api/auth/session is the one to ask about the database.
  if (new URL(request.url).pathname === '/api/health') {
    return Response.json({
      ok: true,
      database: process.env.POSTGRES_URL
        ? 'POSTGRES_URL'
        : process.env.DATABASE_URL
          ? 'DATABASE_URL'
          : null,
      node: process.version,
    });
  }

  let app: App;
  try {
    app = await application();
  } catch (err) {
    // Failing to start happens before there is any account or any saved work,
    // so what went wrong is configuration rather than anybody's data.
    return failed('The server could not start', err, 503);
  }
  try {
    return await app.fetch(request);
  } catch (err) {
    return failed('The server failed on that request', err, 500);
  }
});
