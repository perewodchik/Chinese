import pg from 'pg';
import { MIGRATIONS } from './migrations';

/**
 * The Postgres pool.
 *
 * It exists because a serverless function has no disk that survives the
 * request, so the file the home server keeps had to become a database
 * somewhere else. A server on this machine can be pointed at that same
 * database — see `infrastructure/stores.ts` — which is how development happens
 * on the real accounts and the real saved work rather than on a copy.
 *
 * Two things follow from being serverless, and both are handled here rather
 * than at the call sites. A function instance handles one request at a time and
 * may be frozen between requests, so the pool holds a single connection and the
 * module keeps it across invocations. And several instances can start at once
 * on a cold deploy, so the migration takes a lock before looking at the schema.
 */

const { Pool, types } = pg;

// int8 arrives as a string, because a Postgres BIGINT does not always fit a
// JavaScript number. Every BIGINT here is milliseconds since the epoch, which
// stays exact until the year 287396, so reading them as numbers is safe.
types.setTypeParser(20, (v) => Number(v));

let pool: pg.Pool | null = null;
let ready: Promise<pg.Pool> | null = null;

/** How the connection is secured, given the URL the host handed us. */
function sslFor(url: string): pg.PoolConfig['ssl'] {
  if (/[?&]sslmode=disable/.test(url)) return false;
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    /* a libpq-style DSN rather than a URL; assume it is remote */
  }
  if (host === 'localhost' || host === '127.0.0.1') return false;
  // A managed Postgres presents a certificate from a public CA, so verify it.
  // PGSSLNOVERIFY=1 is the way out for a provider that self-signs.
  return process.env.PGSSLNOVERIFY === '1' ? { rejectUnauthorized: false } : true;
}

export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.POSTGRES_URL || env.DATABASE_URL || null;
}

/**
 * The pool, with the schema up to date. Safe to call on every request: the
 * work happens once per instance, and a failure is not cached.
 */
export function openPostgres(url: string): Promise<pg.Pool> {
  if (ready) return ready;
  pool ??= new Pool({
    connectionString: url,
    ssl: sslFor(url),
    // Neon's connection string asks for channel binding, and `pg` only reads
    // that from the options, never from the URL. With it on, the password is
    // bound to this TLS connection, so a proxy that talked us into trusting it
    // still cannot replay what it heard.
    enableChannelBinding: true,
    max: 1,
    idleTimeoutMillis: 10_000,
    // Under the time the platform allows a function, so that failing to
    // connect is an error we can report rather than the request being cut off
    // with nothing said.
    connectionTimeoutMillis: 5_000,
  });
  // A pool that never sees a listener throws on a dropped backend and takes
  // the whole instance with it; a dropped connection is only worth a log.
  pool.on('error', (err) => console.error(`postgres pool: ${err.message}`));
  const opening = migrate(pool).then(() => pool as pg.Pool);
  ready = opening;
  opening.catch(() => {
    if (ready === opening) ready = null;
  });
  return opening;
}

/**
 * Closes the pool and forgets it, so that opening one again in the same
 * process — a server told to shut down and started again by a test, or a
 * command that runs another — gets a live pool rather than the ended one.
 */
export async function closePostgres(): Promise<void> {
  const open = pool;
  pool = null;
  ready = null;
  if (open) await open.end();
}

/** The little of a client the migration needs, so a test can supply its own. */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

async function migrate(p: pg.Pool): Promise<void> {
  const c = await p.connect();
  try {
    await applyMigrations(c);
  } finally {
    c.release();
  }
}

/**
 * Applies every migration past the last one recorded, all inside one
 * transaction holding an advisory lock — so of several instances starting
 * together, one migrates and the rest wait and find the work already done.
 */
export async function applyMigrations(c: Queryable): Promise<void> {
  if (await upToDate(c)) return;
  try {
    await c.query('BEGIN');
    // Never wait on the lock for longer than the platform will wait for us. An
    // instance frozen mid-transaction still holds it, and every other instance
    // queueing behind it would be a deployment that hangs rather than one that
    // says what is wrong.
    await c.query("SET LOCAL lock_timeout = '4s'");
    // An arbitrary constant, chosen once: it only has to be this application's.
    await c.query('SELECT pg_advisory_xact_lock($1)', [4_917_283]);
    await c.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         step       INTEGER PRIMARY KEY,
         applied_at BIGINT NOT NULL
       )`,
    );
    const { rows } = await c.query('SELECT COALESCE(MAX(step), 0) AS step FROM schema_migrations');
    const applied = Number((rows[0] as { step: number } | undefined)?.step ?? 0);
    for (let step = applied; step < MIGRATIONS.length; step++) {
      await c.query(MIGRATIONS[step]);
      await c.query('INSERT INTO schema_migrations (step, applied_at) VALUES ($1, $2)', [
        step + 1,
        Date.now(),
      ]);
    }
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

/**
 * Whether the schema is already current, asked without a transaction and
 * without a lock — which is every start but the first, and the case worth
 * making cheap.
 */
async function upToDate(c: Queryable): Promise<boolean> {
  try {
    const { rows } = await c.query(
      `SELECT COALESCE(MAX(step), 0) AS step FROM schema_migrations`,
    );
    return Number((rows[0] as { step: number } | undefined)?.step ?? 0) >= MIGRATIONS.length;
  } catch {
    // No such table yet, so there is migrating to do.
    return false;
  }
}
