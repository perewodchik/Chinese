import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { describeDatabase, loadConfig } from '../src/config';
import { call, makeApp, sessionCookie } from './support';

const defaults = { port: 4173, serveStatic: false };
const at = (env: Record<string, string | undefined>) => loadConfig(env, defaults, '/app').database;

describe('which database a server runs on', () => {
  it('is the file beside it when nothing says otherwise', () => {
    assert.deepEqual(at({}), { kind: 'sqlite', file: resolve('/app', '.data/hanzi-workshop.db') });
  });

  it('is the deployed one when the host has named it, under either name', () => {
    const url = 'postgresql://u:p@db.example.com/hanzi?sslmode=require';
    assert.deepEqual(at({ POSTGRES_URL: url }), { kind: 'postgres', url });
    assert.deepEqual(at({ DATABASE_URL: url }), { kind: 'postgres', url });
    // POSTGRES_URL is the one Vercel's integration writes, so it wins.
    assert.deepEqual(at({ POSTGRES_URL: url, DATABASE_URL: 'postgres://other/x' }), {
      kind: 'postgres',
      url,
    });
  });

  it('is whatever HANZI_DB says, which is how one run goes back to the file', () => {
    assert.deepEqual(at({ HANZI_DB: 'postgres://u:p@host/db' }), {
      kind: 'postgres',
      url: 'postgres://u:p@host/db',
    });
    assert.deepEqual(at({ HANZI_DB: '.data/other.db', POSTGRES_URL: 'postgres://u:p@host/db' }), {
      kind: 'sqlite',
      file: resolve('/app', '.data/other.db'),
    });
    assert.deepEqual(at({ HANZI_DB: ':memory:' }), { kind: 'sqlite', file: ':memory:' });
  });

  it('never prints the password back out', () => {
    const said = describeDatabase({ kind: 'postgres', url: 'postgres://u:hunter2@db.example.com/hanzi' });
    assert.ok(!said.includes('hunter2'), said);
    assert.equal(said, 'db.example.com/hanzi (Postgres)');
  });
});

describe('the development sign-in, on a database it does not own', () => {
  // The address a request came from, the way a proxy would say it — the only
  // way to give a request made in-process an address at all.
  const from = (ip: string) => ({ headers: { 'x-forwarded-for': ip } });
  const here = from('127.0.0.1');

  it('signs in as an account that is there', async () => {
    const { app, services } = makeApp({}, { trustProxy: true, devUser: 'admin', devUserCreate: false });
    await services.auth.addUser('admin', 'adminadmin');

    const res = await call(app, 'GET', '/api/auth/session', here);
    const body = (await res.json()) as { user: { username: string } | null };
    assert.equal(body.user?.username, 'admin');
    assert.ok(sessionCookie(res));
  });

  it('asks for a password rather than inventing the account when the name is not there', async () => {
    const { app } = makeApp({}, { trustProxy: true, devUser: 'admni', devUserCreate: false });

    const res = await call(app, 'GET', '/api/auth/session', here);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { user: null });
    assert.equal(res.headers.get('set-cookie'), null);
  });

  it('makes it on this machine’s own file, where that is how the first one appears', async () => {
    const { app } = makeApp({}, { trustProxy: true, devUser: 'admin' });

    const body = (await (await call(app, 'GET', '/api/auth/session', here)).json()) as {
      user: { username: string } | null;
    };
    assert.equal(body.user?.username, 'admin');
  });
});
