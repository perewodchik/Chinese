import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { createServices } from './composition';
import { loadConfig } from './config';
import { createHttpApp } from './http/app';
import { speechFromEnv } from './infrastructure/azure-speech';
import { openDatabase } from './infrastructure/sqlite/database';
import { sqliteStores } from './infrastructure/sqlite/stores';
import { banner } from './lan';

/**
 * The development server: the same API as production, with Vite serving the
 * app instead of the built files — one process, one port, hot reload.
 *
 *   npm run dev
 *
 * One process rather than an API server and a Vite server side by side keeps
 * the address the same as it always was, needs no proxy between the two, and
 * leaves nothing running on a port after the window is closed.
 *
 *   HANZI_DEV_USER=admin npm run dev
 *
 * opens the app from this machine already signed in as `admin` (made if it is
 * not there yet), with no password — for checking a change in a browser
 * without stopping at the sign-in page. Other devices on the Wi-Fi still sign
 * in as usual, and only this server reads the variable.
 */

const config = loadConfig(process.env, { port: 5173, serveStatic: false });
const devUser = process.env.HANZI_DEV_USER?.trim() || null;
const db = openDatabase(config.databaseFile);
const services = createServices(sqliteStores(db), {
  policy: { registration: config.registration },
  speech: speechFromEnv(process.env),
});
const api = getRequestListener(
  createHttpApp(services, { trustProxy: config.trustProxy, staticDir: null, log: console.error, devUser }).fetch,
);

const http = createServer();
const vite = await createViteServer({
  server: { middlewareMode: true, hmr: { server: http } },
  appType: 'spa',
});

http.on('request', (req, res) => {
  if (req.url === '/api' || req.url?.startsWith('/api/')) void api(req, res);
  else vite.middlewares(req, res);
});

http.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${config.port} is already in use — is the app already running?\n`);
    process.exit(1);
  }
  throw err;
});

http.listen(config.port, config.host, () => {
  console.log(banner(config.port, config.host));
  if (devUser) console.log(`  Signed in as “${devUser}” without a password, from this machine only (HANZI_DEV_USER).\n`);
});

async function shutdown() {
  await vite.close();
  http.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
