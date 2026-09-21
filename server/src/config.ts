import { resolve } from 'node:path';

/** Where the accounts and the saved work are kept. */
export type DatabaseSetting =
  /** a file path, or ':memory:' */
  | { kind: 'sqlite'; file: string }
  | { kind: 'postgres'; url: string };

export interface ServerConfig {
  host: string;
  port: number;
  database: DatabaseSetting;
  /** the built app to serve beside the API, or null when something else serves it */
  staticDir: string | null;
  registration: 'open' | 'closed';
  /** believe X-Forwarded-For and -Proto — only true behind a reverse proxy you run yourself */
  trustProxy: boolean;
}

/**
 * Settings come from the environment, each with a default that suits running
 * the app on a home PC for the devices on its Wi-Fi.
 *
 *   PORT                 4173 for `npm start`, 5173 for `npm run dev`
 *   HOST                 0.0.0.0 — every interface, so a tablet can reach it
 *   HANZI_DB             a file, or a postgres:// URL; see below
 *   POSTGRES_URL         the deployed database, when HANZI_DB says nothing
 *   HANZI_STATIC_DIR     dist
 *   HANZI_REGISTRATION   open | closed
 *   HANZI_TRUST_PROXY    1 behind a reverse proxy
 *
 * A server here runs on the same Postgres the deployed site runs on as soon as
 * it is given the connection string, so the development server and the site
 * are one account with one set of work rather than two that have to be kept in
 * step. `POSTGRES_URL` in `.env` is enough; `HANZI_DB` overrules it either
 * way, which is how you get back to the local file:
 *
 *   HANZI_DB=.data/hanzi-workshop.db npm run dev
 */
export function loadConfig(
  env: Record<string, string | undefined>,
  defaults: { port: number; serveStatic: boolean },
  cwd = process.cwd(),
): ServerConfig {
  return {
    host: env.HOST || '0.0.0.0',
    port: portFrom(env.PORT, defaults.port),
    database: databaseFrom(env, cwd),
    staticDir: defaults.serveStatic ? resolve(cwd, env.HANZI_STATIC_DIR || 'dist') : null,
    registration: env.HANZI_REGISTRATION === 'closed' ? 'closed' : 'open',
    trustProxy: env.HANZI_TRUST_PROXY === '1' || env.HANZI_TRUST_PROXY === 'true',
  };
}

const POSTGRES = /^postgres(ql)?:\/\//i;

function databaseFrom(env: Record<string, string | undefined>, cwd: string): DatabaseSetting {
  const asked = env.HANZI_DB?.trim();
  if (asked) {
    return POSTGRES.test(asked)
      ? { kind: 'postgres', url: asked }
      : { kind: 'sqlite', file: asked === ':memory:' ? asked : resolve(cwd, asked) };
  }
  // The names the hosts use, read here as well as on Vercel so that one line
  // in `.env` is the whole of pointing a server at the deployed database.
  const remote = env.POSTGRES_URL?.trim() || env.DATABASE_URL?.trim();
  if (remote) return { kind: 'postgres', url: remote };
  return { kind: 'sqlite', file: resolve(cwd, '.data/hanzi-workshop.db') };
}

/** What to print about a database, with the password taken out of it. */
export function describeDatabase(database: DatabaseSetting): string {
  if (database.kind === 'sqlite') return database.file;
  try {
    const url = new URL(database.url);
    return `${url.hostname}${url.pathname} (Postgres)`;
  } catch {
    return 'Postgres';
  }
}

/**
 * `.env` in the project folder, for the connection string and the speech keys.
 * A variable already set in the shell wins, so one run can be pointed
 * somewhere else without editing the file.
 */
export function loadEnvFile(cwd = process.cwd()): void {
  try {
    process.loadEnvFile(resolve(cwd, '.env'));
  } catch {
    // No .env, which is the ordinary case for a home server.
  }
}

function portFrom(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT has to be a port number, not “${raw}”.`);
  }
  return port;
}
