import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdminLogPage } from '../../shared/admin';
import type { CatalogBook, CatalogBookWithTexts, PublishCatalogResponse } from '../../shared/catalog';
import { pictureKey } from '../src/application/picture-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, HOST, sessionCookie, TestClock, type TestApp } from './support';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 6]);
const KEY = pictureKey(jpeg);
const ELSEWHERE = 'a'.repeat(64);

const book = { title: 'Pikachu goes to Beijing', titleZh: '皮卡丘去北京', level: 2, kind: 'story', blurb: 'Six chapters.', source: 'Written with Claude for this site', licence: 'written for this site' };

/** A text as the admin's workspace keeps it: with progress, and a field nobody asked for. */
const text = (id: string, zh: string) => ({
  id,
  setId: 'shelf-1',
  title: `Chapter ${id}`,
  titleZh: zh,
  topic: 'Pikachu',
  length: 'short',
  level: 'edge',
  genre: 'story',
  createdAt: 1,
  model: 'claude',
  lines: [{ zh, py: 'pí kǎ qiū', en: 'Pikachu', p: true }],
  vocab: [],
  questions: [],
  grammar: [],
  note: '',
  teach: [],
  glosses: {},
  basis: [],
  pictures: [{ para: 0, prompt: 'Pikachu on a bus', key: KEY, w: 800, h: 600 }, { para: 0, prompt: 'never drawn here', key: ELSEWHERE }],
  read: true,
  reads: 3,
  study: { heard: 5 },
  endings: ['home'],
  secretField: 'not for anyone else',
});

async function setUp() {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), policy: { adminTwoStep: 'optional' } });
  const app = createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined, adminUsers: ['kirill'] });
  const signUp = async (username: string) => sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username, password: 'correct horse' } }));
  const owner = await signUp('kirill');
  const learner = await signUp('masha');
  const put = await app.request(`http://${HOST}/api/pictures/${KEY}`, { method: 'PUT', headers: { host: HOST, cookie: owner, 'sec-fetch-site': 'same-origin', 'content-type': 'image/jpeg' }, body: jpeg as Uint8Array<ArrayBuffer> });
  assert.equal(put.status, 200);
  return { app, owner, learner };
}

async function publish(app: TestApp, cookie: string, body: unknown = { book, texts: [text('1', '皮卡丘上车。'), text('2', '北京很大。')] }) {
  return call(app, 'POST', '/api/admin/catalog', { cookie, body });
}

describe('the shared catalogue', () => {
  it('publishes a shelf as a book that a learner lists and reads, without the admin’s progress', async () => {
    const { app, owner, learner } = await setUp();
    const res = await publish(app, owner);
    assert.equal(res.status, 201);
    const made = (await res.json()) as PublishCatalogResponse;
    assert.equal(made.version, 1);
    assert.equal(made.missingPictures, 1, 'the picture the admin never kept is left out');

    const list = (await (await call(app, 'GET', '/api/catalog', { cookie: learner })).json()) as CatalogBook[];
    assert.deepEqual(list.map((b) => [b.title, b.texts, b.version, b.level]), [['Pikachu goes to Beijing', 2, 1, 2]]);
    assert.equal(list[0]!.chars, new Set('皮卡丘上车北京很大').size);
    assert.equal('hidden' in list[0]!, false, 'a learner is not told about hiding');

    const got = (await (await call(app, 'GET', `/api/catalog/${made.id}`, { cookie: learner })).json()) as CatalogBookWithTexts;
    assert.deepEqual(got.textList.map((t) => t.titleZh), ['皮卡丘上车。', '北京很大。']);
    const first = got.textList[0]!;
    for (const field of ['read', 'reads', 'study', 'endings', 'setId', 'secretField']) assert.equal(field in first, false, field);
    assert.deepEqual(first.pictures, [{ para: 0, prompt: 'Pikachu on a bus', key: KEY, w: 800, h: 600 }, { para: 0, prompt: 'never drawn here' }]);

    // The learner sees the book's picture, which is the admin's own otherwise.
    const picture = await call(app, 'GET', `/api/pictures/${KEY}`, { cookie: learner });
    assert.equal(picture.status, 200);
    assert.deepEqual(new Uint8Array(await picture.arrayBuffer()), jpeg);
  });

  it('keeps the book as published while the admin’s shelf changes, and versions it when published again', async () => {
    const { app, owner, learner } = await setUp();
    const { id } = (await (await publish(app, owner)).json()) as PublishCatalogResponse;
    await call(app, 'PUT', '/api/workspace', { cookie: owner, body: { baseRevision: 0, document: { version: 11, texts: [text('1', '改了。')] } } });
    const still = (await (await call(app, 'GET', `/api/catalog/${id}`, { cookie: learner })).json()) as CatalogBookWithTexts;
    assert.equal(still.textList[0]!.titleZh, '皮卡丘上车。');

    const again = await call(app, 'PUT', `/api/admin/catalog/${id}`, { cookie: owner, body: { book: { ...book, blurb: 'Seven chapters now.' }, texts: [text('1', '皮卡丘上车。'), text('2', '北京很大。'), text('3', '回家。')] } });
    assert.equal(again.status, 200);
    assert.equal(((await again.json()) as PublishCatalogResponse).version, 2);
    const now = (await (await call(app, 'GET', `/api/catalog/${id}`, { cookie: learner })).json()) as CatalogBookWithTexts;
    assert.deepEqual([now.version, now.texts, now.blurb], [2, 3, 'Seven chapters now.']);
    assert.equal((await call(app, 'PUT', '/api/admin/catalog/nobody', { cookie: owner, body: { book, texts: [text('1', '一。')] } })).status, 404);
  });

  it('hides a book from learners and shows it again, and says so in the log', async () => {
    const { app, owner, learner } = await setUp();
    const { id } = (await (await publish(app, owner)).json()) as PublishCatalogResponse;
    assert.equal((await call(app, 'PATCH', `/api/admin/catalog/${id}`, { cookie: owner, body: { hidden: true } })).status, 204);
    assert.deepEqual(await (await call(app, 'GET', '/api/catalog', { cookie: learner })).json(), []);
    assert.equal((await call(app, 'GET', `/api/catalog/${id}`, { cookie: learner })).status, 404);
    const adminList = (await (await call(app, 'GET', '/api/admin/catalog', { cookie: owner })).json()) as CatalogBook[];
    assert.equal(adminList[0]?.hidden, true);

    await call(app, 'PATCH', `/api/admin/catalog/${id}`, { cookie: owner, body: { hidden: false } });
    assert.equal(((await (await call(app, 'GET', '/api/catalog', { cookie: learner })).json()) as CatalogBook[]).length, 1);
    const log = (await (await call(app, 'GET', '/api/admin/log', { cookie: owner })).json()) as AdminLogPage;
    assert.deepEqual(log.entries.slice(0, 3).map((e) => e.action), ['catalog-shown', 'catalog-hidden', 'catalog-published']);
  });

  it('takes only what may go to every learner', async () => {
    const { app, owner } = await setUp();
    const refused = async (body: unknown, why: string) => assert.equal((await publish(app, owner, body)).status, 400, why);
    await refused({ book: { ...book, licence: 'all rights reserved' }, texts: [text('1', '一。')] }, 'a licence that does not let it be shared');
    await refused({ book: { ...book, source: '' }, texts: [text('1', '一。')] }, 'no source');
    await refused({ book, texts: [] }, 'no texts');
    await refused({ book, texts: [{ ...text('1', '一。'), lines: [] }] }, 'a text with no lines');
    await refused({ book, texts: [{ ...text('1', '一。'), story: { start: 'a', nodes: { a: { choices: [], end: 'https://elsewhere.test' } } } }] }, 'an address in a story');
    await refused({ book, texts: [{ ...text('1', '一。'), lines: [{ zh: '一'.repeat(700), py: '', en: '' }] }] }, 'a line too long');
  });

  it('is for admins to publish and for the signed in to read', async () => {
    const { app, owner, learner } = await setUp();
    assert.equal((await publish(app, learner)).status, 403);
    assert.equal((await call(app, 'GET', '/api/admin/catalog', { cookie: learner })).status, 403);
    const { id } = (await (await publish(app, owner)).json()) as PublishCatalogResponse;
    assert.equal((await call(app, 'PATCH', `/api/admin/catalog/${id}`, { cookie: learner, body: { hidden: true } })).status, 403);
    assert.equal((await call(app, 'GET', '/api/catalog')).status, 401);
    assert.equal((await call(app, 'GET', `/api/catalog/${id}`)).status, 401);
  });
});
