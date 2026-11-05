import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SealedSecrets, secretsFor } from '../src/infrastructure/crypto/sealed-secrets';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';

const KEY = 'a long random string kept out of the database, 0123456789';
const T = Date.UTC(2026, 10, 5);

function setUp() {
  const db = openDatabase(':memory:');
  const stores = sqliteStores(db);
  db.prepare('INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('u1', 'kirill', 'kirill', 'x', T, T);
  db.prepare('INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run('u2', 'masha', 'masha', 'x', T, T);
  const raw = (user: string, name: string) => (db.prepare('SELECT value FROM user_secrets WHERE user_id = ? AND name = ?').get(user, name) as { value: string } | undefined)?.value;
  return { db, stores, raw };
}

describe('learners’ keys, sealed before they are stored', () => {
  it('stores what cannot be read without HANZI_SECRETS_KEY, and gives it back with it', async () => {
    const { stores, raw } = setUp();
    const sealed = new SealedSecrets(stores.secrets, KEY);
    await sealed.set('u1', 'minimax', 'sk-api-0123456789', T);
    assert.match(raw('u1', 'minimax')!, /^v1:/);
    assert.ok(!raw('u1', 'minimax')!.includes('sk-api'));
    assert.equal(await sealed.get('u1', 'minimax'), 'sk-api-0123456789');
  });

  it('seals a key kept before, the first time it is read', async () => {
    const { stores, raw } = setUp();
    await stores.secrets.set('u1', 'minimax', 'sk-api-plain', T);
    const sealed = new SealedSecrets(stores.secrets, KEY);
    assert.equal(await sealed.get('u1', 'minimax'), 'sk-api-plain');
    assert.match(raw('u1', 'minimax')!, /^v1:/);
    assert.equal(await sealed.get('u1', 'minimax'), 'sk-api-plain');
  });

  it('reads as no key under a different HANZI_SECRETS_KEY, or moved onto another account’s row', async () => {
    const { stores, db, raw } = setUp();
    const lines: string[] = [];
    await new SealedSecrets(stores.secrets, KEY).set('u1', 'minimax', 'sk-api-0123456789', T);
    assert.equal(await new SealedSecrets(stores.secrets, `${KEY}, but another`, (l) => lines.push(l)).get('u1', 'minimax'), null);
    assert.equal(lines.length, 1);
    db.prepare('INSERT INTO user_secrets (user_id, name, value, updated_at) VALUES (?, ?, ?, ?)').run('u2', 'minimax', raw('u1', 'minimax')!, T);
    assert.equal(await new SealedSecrets(stores.secrets, KEY).get('u2', 'minimax'), null);
  });

  it('is left as it was without the setting, says so, and refuses a setting too short to be a key', async () => {
    const { stores } = setUp();
    const lines: string[] = [];
    const plain = secretsFor(stores.secrets, '', (l) => lines.push(l));
    assert.equal(lines.length, 1);
    await plain.set('u1', 'minimax', 'sk-api-plain', T);
    assert.equal(await plain.get('u1', 'minimax'), 'sk-api-plain');
    // Sealed by the site, read on a machine without the setting: no key, not the sealed text.
    await new SealedSecrets(stores.secrets, KEY).set('u1', 'minimax', 'sk-api-0123456789', T);
    assert.equal(await plain.get('u1', 'minimax'), null);
    assert.throws(() => secretsFor(stores.secrets, 'short', () => undefined), /at least 32 characters/);
  });
});

describe('the keys as the site uses them', () => {
  it('are sealed when the server is given HANZI_SECRETS_KEY, and still score a phrase', async () => {
    const { createServices } = await import('../src/composition');
    const { createHttpApp } = await import('../src/http/app');
    const { call, cheapHasher, sessionCookie, TestClock } = await import('./support');
    const db = openDatabase(':memory:');
    const services = createServices(sqliteStores(db), {
      hasher: cheapHasher,
      clock: new TestClock(),
      secretsKey: KEY,
      evaluator: { evaluate: async () => ({ total: 90 }) as never },
    });
    const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } }));
    assert.equal((await call(app, 'PUT', '/api/eval/key', { cookie, body: { provider: 'speechsuper', appKey: 'app123456', secretKey: 'secret0123456789abcd' } })).status, 200);
    const stored = (db.prepare('SELECT value FROM user_secrets').get() as { value: string }).value;
    assert.match(stored, /^v1:/);
    assert.ok(!stored.includes('secret0123456789abcd'));
    const scored = await call(app, 'POST', '/api/eval', { cookie, body: { text: '你好', audio: Buffer.alloc(6400).toString('base64') } });
    assert.equal(scored.status, 200);
  });
});
