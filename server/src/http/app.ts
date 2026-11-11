import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { WORKSPACE_MAX_BYTES } from '../../../shared/api';
import { usernameKey } from '../../../shared/credentials';
import { CSP, PERMISSIONS_POLICY } from '../../../shared/csp';
import type { Services } from '../composition';
import { NotFoundError } from '../domain/errors';
import type { AppEnv } from './env';
import { errorBody, handleError } from './errors';
import { sameOriginOnly } from './guards';
import { accountRoutes } from './routes/account';
import { adminRoutes } from './routes/admin';
import { askRoutes } from './routes/ask';
import { authRoutes } from './routes/auth';
import { narrationRoutes } from './routes/narration';
import { speechEvalRoutes } from './routes/speechEval';
import { pictureRoutes } from './routes/pictures';
import { speechRoutes } from './routes/speech';
import { strokeRoutes } from './routes/strokes';
import { talkRoutes } from './routes/talk';
import { videoRoutes } from './routes/videos';
import { workspaceRoutes } from './routes/workspace';
import { worldRoutes } from './routes/world';
import { staticSite } from './static-site';

export interface HttpOptions {
  trustProxy: boolean;
  /** the header the host sets with the client's address, when there is one (x-vercel-forwarded-for on Vercel) */
  ipHeader?: string | null;
  /**
   * The accounts that may ask Claude, by name: it runs on the subscription of
   * whoever runs the server, so a learner who signed up is not given it by
   * default. Left out, every account may (one learner's own server).
   */
  tutorUsers?: string[] | null;
  /**
   * HANZI_ADMIN_USERS: the names given the admin role the first time the
   * server meets a database where no account has it. After that the role in
   * the database is what counts, and the setting can go.
   */
  adminUsers?: string[];
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
  /**
   * Whether `devUser` may be made if there is no such account. True of the
   * SQLite file on a development machine; false when that server is running on
   * the deployed site's database, where an unknown name is a typo and making
   * it would put an account on the real site.
   */
  devUserCreate?: boolean;
}

/** Refuses a body over `maxSize` bytes with the app's own 413, before it is read into memory. */
export const tooLarge = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.json(errorBody('payload_too_large', 'That is more than the server takes in one request.'), 413) });

/**
 * The HTTP face of the application: JSON under /api, and the app itself
 * everywhere else when there is a build to serve.
 */
export function createHttpApp(services: Services, options: HttpOptions) {
  const onError = handleError(options.log);
  const deps = {
    ...services,
    trustProxy: options.trustProxy,
    ipHeader: options.ipHeader ?? null,
    tutorUsers: options.tutorUsers ? options.tutorUsers.map(usernameKey) : null,
    devUser: options.devUser ?? null,
    devUserCreate: options.devUserCreate ?? true,
    log: options.log,
  };

  const api = new Hono<AppEnv>();
  api.onError(onError);
  api.use('*', sameOriginOnly());
  // Nothing the app sends is larger than a workspace. Without a ceiling a
  // route reads whatever it is sent before it looks at it, and a 30 MB
  // "password" is held in memory by a server that was only going to refuse it.
  // The routes that take less say so themselves (sign-in, a picture).
  api.use('*', tooLarge(WORKSPACE_MAX_BYTES + 64 * 1024));
  // Once per process, before the first request is answered: the first
  // accounts to run the site get the role (AuthService.seedAdmins). A failure
  // is logged and tried again on the next request, never answered with.
  let seeded: Promise<void> | null = null;
  const seedAdmins = () =>
    services.auth.seedAdmins(options.adminUsers ?? []).then(
      ({ given, settled }) => {
        if (!settled) seeded = null;
        if (given.length) options.log(`Gave the admin role to ${given.join(', ')} (HANZI_ADMIN_USERS); the setting is no longer needed.`);
      },
      (err: unknown) => {
        seeded = null;
        options.log(`Could not give the admin role from HANZI_ADMIN_USERS: ${err instanceof Error ? err.message : String(err)}`);
      },
    );
  api.use('*', async (_c, next) => {
    await (seeded ??= seedAdmins());
    await next();
  });
  api.get('/health', (c) => c.json({ ok: true }));
  api.route('/auth', authRoutes(deps));
  api.route('/account', accountRoutes(deps));
  api.route('/admin', adminRoutes(deps));
  api.route('/ask', askRoutes(deps));
  api.route('/workspace', workspaceRoutes(deps));
  api.route('/world', worldRoutes(deps));
  api.route('/speech', speechRoutes(deps));
  api.route('/talk', talkRoutes(deps));
  api.route('/videos', videoRoutes(deps));
  api.route('/strokes', strokeRoutes(deps));
  api.route('/pictures', pictureRoutes(deps));
  api.route('/narration', narrationRoutes(deps));
  api.route('/eval', speechEvalRoutes(deps));
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
      // The policy itself is written once, in shared/csp.ts, beside the copy
      // vercel.json sends; a test keeps the two the same.
      contentSecurityPolicy: undefined,
      // Sent over plain http it would be ignored anyway, and on a LAN address
      // it would only get in the way of ever trying https out.
      strictTransportSecurity: false,
    }),
  );
  app.use('*', async (c, next) => {
    await next();
    c.header('Content-Security-Policy', CSP);
    c.header('Permissions-Policy', PERMISSIONS_POLICY);
  });
  app.route('/api', api);
  if (options.staticDir) app.route('/', staticSite(options.staticDir));
  return app;
}
