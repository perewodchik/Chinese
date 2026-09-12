/**
 * The API when the app runs on Vercel, where `server/src/main.ts` cannot: a
 * function has no port to listen on and no disk to keep a SQLite file. Only
 * the outermost layer differs — the same Hono app and the same services, over
 * Postgres instead of a file.
 *
 * Two things here are defensive rather than obvious, and both were paid for.
 *
 * The route arrives in a query parameter. Vercel's own file routing read
 * `api/[...path].ts` as one segment rather than as a catch-all, so /api/health
 * reached the function and /api/auth/session answered 404; vercel.json now
 * rewrites every /api/… onto this one function and hands the rest of the path
 * along, which leaves nothing to infer.
 *
 * And the server is imported here rather than at the top of the file. An
 * import that throws takes the module with it, before any code of ours runs,
 * and the platform then answers a bare 500 that says nothing at all. Loaded
 * inside the try, a bad import is a message like any other.
 */

const REGISTRATION = process.env.HANZI_REGISTRATION === 'closed' ? 'closed' : 'open';

type App = { fetch(request: Request): Response | Promise<Response> };

let building: Promise<App> | null = null;

function application(): Promise<App> {
  if (building) return building;
  const started = (async (): Promise<App> => {
    const [{ createServices }, { createHttpApp }, { databaseUrl, openPostgres }, { postgresStores }] =
      await Promise.all([
        import('../server/src/composition'),
        import('../server/src/http/app'),
        import('../server/src/infrastructure/postgres/database'),
        import('../server/src/infrastructure/postgres/stores'),
      ]);

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
async function asSent(request: Request): Promise<Request> {
  const url = new URL(request.url);
  const path = url.searchParams.get('__path');
  if (path === null) return request;
  url.searchParams.delete('__path');
  url.pathname = `/api/${path}`;
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  return new Request(url, { method: request.method, headers: request.headers, body });
}

export default async function handler(request: Request): Promise<Response> {
  const sent = await asSent(request);

  // Answered before the database is touched, so that "the function runs" and
  // "the database answers" are two questions with two answers rather than one
  // failure that could be either. Everything else goes through the app, and
  // /api/auth/session is the one to ask about the database.
  if (new URL(sent.url).pathname === '/api/health') {
    return Response.json({
      ok: true,
      database: process.env.POSTGRES_URL ? 'POSTGRES_URL' : process.env.DATABASE_URL ? 'DATABASE_URL' : null,
      node: process.version,
    });
  }

  let app: App;
  try {
    app = await application();
  } catch (err) {
    // Failing to start is not something the Hono app can report, because there
    // is no Hono app yet — and left to escape it becomes the platform's own
    // blank 500, which says nothing about what is wrong. These failures happen
    // before there is any account or any saved work, so what went wrong is
    // configuration rather than anybody's data.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`starting up: ${message}`);
    return Response.json(
      { error: { code: 'internal', message: `The server could not start. ${message}` } },
      { status: 503 },
    );
  }
  return app.fetch(sent);
}
