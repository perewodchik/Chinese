import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createServices } from './composition';
import { loadConfig } from './config';
import { createHttpApp } from './http/app';
import { speechFromEnv } from './infrastructure/azure-speech';
import { openDatabase } from './infrastructure/sqlite/database';
import { sqliteStores } from './infrastructure/sqlite/stores';
import { banner } from './lan';

/**
 * The production server: the API and the built app, from one port.
 *
 *   npm run build && npm start
 */

const HOUR = 3_600_000;

const config = loadConfig(process.env, { port: 4173, serveStatic: true });
let staticDir = config.staticDir;
if (staticDir && !existsSync(join(staticDir, 'index.html'))) {
  console.warn(`\n  There is no built app in ${staticDir} — run "npm run build" first.`);
  console.warn('  Serving the API only.\n');
  staticDir = null;
}

const db = openDatabase(config.databaseFile);
const services = createServices(sqliteStores(db), {
  policy: { registration: config.registration },
  speech: speechFromEnv(process.env),
});
const app = createHttpApp(services, {
  trustProxy: config.trustProxy,
  staticDir,
  log: (line) => console.error(line),
});

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, () => {
  console.log(banner(config.port, config.host));
  console.log(`  Accounts and saved work: ${config.databaseFile}\n`);
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
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Browsers hold keep-alive connections open; do not wait on them for long.
  setTimeout(() => process.exit(0), 2_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
