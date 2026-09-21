import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createServices } from './composition';
import { describeDatabase, loadConfig, loadEnvFile } from './config';
import { createHttpApp } from './http/app';
import { speechFromEnv } from './infrastructure/azure-speech';
import { tutorFromEnv } from './infrastructure/claude-cli';
import { localVoicesFromEnv } from './infrastructure/local-voices';
import { openStores } from './infrastructure/stores';
import { banner } from './lan';

/**
 * The production server: the API and the built app, from one port.
 *
 *   npm run build && npm start
 *
 * Which database it keeps its accounts and saved work in is a setting rather
 * than a fact about this file: the SQLite file beside it by default, and the
 * deployed site's Postgres when `POSTGRES_URL` says so.
 */

const HOUR = 3_600_000;

loadEnvFile();
const config = loadConfig(process.env, { port: 4173, serveStatic: true });
let staticDir = config.staticDir;
if (staticDir && !existsSync(join(staticDir, 'index.html'))) {
  console.warn(`\n  There is no built app in ${staticDir} — run "npm run build" first.`);
  console.warn('  Serving the API only.\n');
  staticDir = null;
}

const { stores, close } = await openStores(config.database).catch(stop);
const services = createServices(stores, {
  policy: { registration: config.registration },
  speech: speechFromEnv(process.env),
  tutor: tutorFromEnv(process.env),
  talkVoices: localVoicesFromEnv(process.env, process.cwd()),
});
const app = createHttpApp(services, {
  trustProxy: config.trustProxy,
  staticDir,
  log: (line) => console.error(line),
});

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(banner(config.port, config.host));
  console.log(`  Accounts and saved work: ${describeDatabase(config.database)}\n`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${config.port} is already in use — is the app already running?\n`);
    process.exit(1);
  }
  throw err;
});

void services.auth.purgeExpiredSessions();
const sweep = setInterval(() => void services.auth.purgeExpiredSessions(), HOUR);
sweep.unref();

function shutdown() {
  clearInterval(sweep);
  server.close(() => void close().finally(() => process.exit(0)));
  // Browsers hold keep-alive connections open; do not wait on them for long.
  setTimeout(() => process.exit(0), 2_000).unref();
}
/** A database that cannot be opened is the end of it: one line, and no stack. */
function stop(err: unknown): never {
  console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
