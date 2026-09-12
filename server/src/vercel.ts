import { getRequestListener } from '@hono/node-server';
import { createServices } from './composition';
import { createHttpApp } from './http/app';
import { ScryptHasher } from './infrastructure/crypto/scrypt-hasher';
import { databaseUrl, openPostgres } from './infrastructure/postgres/database';
import { postgresStores } from './infrastructure/postgres/stores';

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
 * And it is bundled to api/index.js before it is deployed, rather than handed
 * over as TypeScript. Vercel compiles a .ts function itself, against whatever
 * tsconfig it finds at the root — which here is the solution file, carrying no
 * options at all — and every relative import in the server then fails to
 * compile for want of a file extension it does not need. Bundling it the way
 * `npm start` bundles the home server leaves nothing to be resolved and
 * nothing to be compiled: one file, and the packages beside it.
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

/** Runs one step, and says so rather than waiting for ever. */
async function step<T>(name: string, work: Promise<T>): Promise<Record<string, unknown>> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capped = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('did not finish in 6s')), 6_000);
  });
  try {
    const value = await Promise.race([work, capped]);
    return { [name]: { ms: Date.now() - started, value } };
  } catch (err) {
    return {
      [name]: { ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The three things signing in does, timed separately. */
async function stages(request: Request): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  Object.assign(out, await step('body', request.text().then((t) => `${t.length} bytes`)));
  const dsn = databaseUrl();
  if (!dsn) return { ...out, database: 'no POSTGRES_URL' };
  const pool = await openPostgres(dsn);
  Object.assign(
    out,
    await step('findUser', pool.query('SELECT count(*)::int AS n FROM users').then((r) => r.rows[0])),
  );
  Object.assign(
    out,
    await step('scrypt', new ScryptHasher().hash('a-password').then((h) => `${h.length} chars`)),
  );
  return out;
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
  const asked = new URL(request.url);
  if (asked.pathname === '/api/health') {
    // ?db=1 asks the harder question. A visit with no cookie never reaches
    // Postgres — the session is answered from the absence of the cookie — so
    // without this the first thing to touch the database is somebody trying to
    // sign in, which is a poor place to discover it cannot be reached.
    if (asked.searchParams.get('db') === '1') {
      const started = Date.now();
      try {
        const dsn = databaseUrl();
        if (!dsn) throw new Error('no POSTGRES_URL or DATABASE_URL');
        const pool = await openPostgres(dsn);
        const { rows } = await pool.query('SELECT 1 AS one');
        return Response.json({ ok: true, ms: Date.now() - started, rows });
      } catch (err) {
        return Response.json(
          {
            ok: false,
            ms: Date.now() - started,
            error: err instanceof Error ? err.message : String(err),
          },
          { status: 503 },
        );
      }
    }
    // ?stages=1 does what signing in does, a step at a time and with each step
    // capped, so that a request which hangs still says where it hung.
    if (asked.searchParams.get('stages') === '1') {
      return Response.json(await stages(request));
    }
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
