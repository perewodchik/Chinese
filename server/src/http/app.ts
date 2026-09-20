import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import type { Services } from '../composition';
import { NotFoundError } from '../domain/errors';
import type { AppEnv } from './env';
import { handleError } from './errors';
import { sameOriginOnly } from './guards';
import { authRoutes } from './routes/auth';
import { speechRoutes } from './routes/speech';
import { talkRoutes } from './routes/talk';
import { workspaceRoutes } from './routes/workspace';
import { staticSite } from './static-site';

export interface HttpOptions {
  trustProxy: boolean;
  /** the built app, or null when Vite is serving it */
  staticDir: string | null;
  /** false where something in front already compresses, as a CDN does */
  compress?: boolean;
  log: (line: string) => void;
  /**
   * Development only: sign requests from this machine in as this account, with
   * no password. Never set by the production server or on Vercel.
   */
  devUser?: string | null;
}

/**
 * The HTTP face of the application: JSON under /api, and the app itself
 * everywhere else when there is a build to serve.
 */
export function createHttpApp(services: Services, options: HttpOptions) {
  const onError = handleError(options.log);
  const deps = { ...services, trustProxy: options.trustProxy, devUser: options.devUser ?? null };

  const api = new Hono<AppEnv>();
  api.onError(onError);
  api.use('*', sameOriginOnly());
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/auth', authRoutes(deps));
  api.route('/workspace', workspaceRoutes(deps));
  api.route('/speech', speechRoutes(deps));
  api.route('/talk', talkRoutes(deps));
  api.all('*', () => {
    throw new NotFoundError('That API route');
  });

  const app = new Hono<AppEnv>();
  app.onError(onError);
  // Character data and a workspace are both text that shrinks to a fifth of
  // its size, which over Wi-Fi is most of the wait. A CDN in front does this
  // itself, and doing it twice is at best wasted work.
  if (options.compress !== false) app.use('*', compress());
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        // The worksheet preview is the PDF itself, in a frame, from a blob.
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
      // Sent over plain http it would be ignored anyway, and on a LAN address
      // it would only get in the way of ever trying https out.
      strictTransportSecurity: false,
    }),
  );
  app.route('/api', api);
  if (options.staticDir) app.route('/', staticSite(options.staticDir));
  return app;
}
