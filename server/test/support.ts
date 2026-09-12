import type { AuthPolicy } from '../src/application/auth-service';
import type { Clock } from '../src/application/ports';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { ScryptHasher } from '../src/infrastructure/crypto/scrypt-hasher';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';

export class TestClock implements Clock {
  constructor(public time = Date.UTC(2026, 8, 11, 9)) {}

  now() {
    return this.time;
  }

  advance(ms: number) {
    this.time += ms;
  }
}

/** Real scrypt, at a cost that lets a suite make a few dozen accounts in well under a second. */
export const cheapHasher = new ScryptHasher({ log2N: 10, r: 8, p: 1 });

export function makeServices(policy: Partial<AuthPolicy> = {}) {
  const db = openDatabase(':memory:');
  const clock = new TestClock();
  const services = createServices(sqliteStores(db), { hasher: cheapHasher, clock, policy });
  return { db, clock, services };
}

export type TestApp = ReturnType<typeof createHttpApp>;

export function makeApp(policy: Partial<AuthPolicy> = {}) {
  const made = makeServices(policy);
  const app = createHttpApp(made.services, { trustProxy: false, staticDir: null, log: () => undefined });
  return { ...made, app };
}

export const HOST = 'hanzi.test';

/** A request the way the app's own page sends one. */
export function call(
  app: TestApp,
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = {
    host: HOST,
    'sec-fetch-site': 'same-origin',
    ...(options.cookie && { cookie: options.cookie }),
    ...(options.body !== undefined && { 'content-type': 'application/json' }),
    ...options.headers,
  };
  return app.request(`http://${HOST}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export function sessionCookie(res: Response): string {
  const header = res.headers.get('set-cookie') ?? '';
  const match = /hanzi_session=([^;]*)/.exec(header);
  if (!match) throw new Error(`No session cookie in: ${header}`);
  return `hanzi_session=${match[1]}`;
}
