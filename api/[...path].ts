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
 * The name is a catch-all because every route is nested: /api/auth/login,
 * /api/workspace. Vercel hands the whole path through, and the Hono app is
 * mounted at /api, so the two agree without any rewriting.
 *
 * Vercel serves the built page and everything in public/ from its own CDN, so
 * this hands back no static files — `staticDir` is null and vercel.json does
 * that routing. It sits behind Vercel's proxy, which terminates TLS, so
 * `trustProxy` is on: that is what puts `Secure` on the session cookie.
 */

const REGISTRATION = process.env.HANZI_REGISTRATION === 'closed' ? 'closed' : 'open';

/** Built once per instance and reused, so a warm function does no setup at all. */
let building: Promise<ReturnType<typeof createHttpApp>> | null = null;

function application() {
  if (building) return building;
  const started = (async () => {
    const url = databaseUrl();
    if (!url) {
      throw new Error(
        'No database: set POSTGRES_URL on the Vercel project (Storage › Create Database ' +
          'fills it in), then redeploy.',
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

export default async function handler(request: Request): Promise<Response> {
  const app = await application();
  return app.fetch(request);
}
