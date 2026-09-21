import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { createServer as createViteServer } from 'vite';
import { createServices } from './composition';
import { describeDatabase, loadConfig, loadEnvFile } from './config';
import { createHttpApp } from './http/app';
import { speechFromEnv } from './infrastructure/azure-speech';
import { tutorFromEnv } from './infrastructure/claude-cli';
import { localVoicesFromEnv } from './infrastructure/local-voices';
import { openStores } from './infrastructure/stores';
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
 * opens the app already signed in as `admin`, with no password — for checking
 * a change in a browser, or on the tablet on the same Wi-Fi, without stopping
 * at the sign-in page. Requests from beyond the local network sign in as
 * usual, and only this server reads the variable.
 *
 * With `POSTGRES_URL` in `.env` this runs on the deployed site's own database,
 * so `admin` here is the same account with the same words, texts and
 * conversations as `admin` there, and a change made in either shows up in the
 * other. Nothing is copied and nothing is kept in step, because there is only
 * one copy. The account is then never made here on the way in: an account that
 * is not on the deployed site is a typo in HANZI_DEV_USER rather than a new
 * learner, and making it would put it on the real site.
 */

loadEnvFile();
const config = loadConfig(process.env, { port: 5173, serveStatic: false });
const devUser = process.env.HANZI_DEV_USER?.trim() || null;
const { stores, local, close } = await openStores(config.database).catch(stop);
const services = createServices(stores, {
  policy: { registration: config.registration },
  speech: speechFromEnv(process.env),
  tutor: tutorFromEnv(process.env),
  talkVoices: localVoicesFromEnv(process.env, process.cwd()),
});
const api = getRequestListener(
  createHttpApp(services, {
    trustProxy: config.trustProxy,
    staticDir: null,
    log: console.error,
    devUser,
    devUserCreate: local,
  }).fetch,
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
  console.log(`  Accounts and saved work: ${describeDatabase(config.database)}`);
  if (!local) console.log('  This is the deployed site’s database — changes here are changes there.');
  if (devUser) console.log(`  Signed in as “${devUser}” without a password, from this Wi-Fi only (HANZI_DEV_USER).`);
  console.log('');
});

async function shutdown() {
  await vite.close();
  http.close();
  await close();
  process.exit(0);
}
/** A database that cannot be opened is the end of it: one line, and no stack. */
function stop(err: unknown): never {
  console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
