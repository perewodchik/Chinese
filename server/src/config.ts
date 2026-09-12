import { resolve } from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  /** a file path, or ':memory:' */
  databaseFile: string;
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
 *   HANZI_DB             .data/hanzi-workshop.db
 *   HANZI_STATIC_DIR     dist
 *   HANZI_REGISTRATION   open | closed
 *   HANZI_TRUST_PROXY    1 behind a reverse proxy
 */
export function loadConfig(
  env: Record<string, string | undefined>,
  defaults: { port: number; serveStatic: boolean },
  cwd = process.cwd(),
): ServerConfig {
  const db = env.HANZI_DB || '.data/hanzi-workshop.db';
  return {
    host: env.HOST || '0.0.0.0',
    port: portFrom(env.PORT, defaults.port),
    databaseFile: db === ':memory:' ? db : resolve(cwd, db),
    staticDir: defaults.serveStatic ? resolve(cwd, env.HANZI_STATIC_DIR || 'dist') : null,
    registration: env.HANZI_REGISTRATION === 'closed' ? 'closed' : 'open',
    trustProxy: env.HANZI_TRUST_PROXY === '1' || env.HANZI_TRUST_PROXY === 'true',
  };
}

function portFrom(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT has to be a port number, not “${raw}”.`);
  }
  return port;
}
