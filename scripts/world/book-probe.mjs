// The §13 B1 book probe: 收藏 → 书, a book opened, every page turned, at 375 / 768 / 1024
// in light and dark. It reports sideways scroll, the page box or the ‹ › bar moving between
// pages, Esc closing the whole menu with the book, and a page not marked read.
// Screenshots: <out>/<width>-<theme>-<name>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright:
//
//   node scripts/world/book-probe.mjs [chromium|webkit] [base] [golden save] [out] [book id]
//
// Use localhost for WebKit (it does not resolve *.localhost). The save gets 《灯笼》 on its shelf.

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://localhost:5183', SAVE = 'content/world/test-saves/chapter-6.json', OUT = 'docs/world-game/review/b1', BOOK = 'denglong'] = process.argv.slice(2);

async function seeded(b, file, { width, height, dark }) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`${BASE}/`);
  const save = { ...JSON.parse(readFileSync(file, 'utf8')), created: true, deviceId: 'probe' };
  const st = await p.evaluate(async (save) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save') || k === 'zouzou:book-english') localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(save);
    if (!up.ok) return `unreadable: ${up.message}`;
    const got = { got: Math.floor(up.save.clock), read: [] };
    save = { ...up.save, created: true, books: { denglong: got, [save.book]: got } };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status} ${(await r.text()).slice(0, 120)}`;
  }, { ...save, book: BOOK });
  if (!st.startsWith('200')) console.log('seed:', st);
  await p.goto(`${BASE}/play/world`);
  await p.waitForSelector('.wt-menu', { timeout: 30000 });
  await p.waitForTimeout(1500);
  return p;
}

const SIZES = [[375, 812], [768, 1024], [1024, 768]];
mkdirSync(OUT, { recursive: true });
const problems = [];
const b = await (engine === 'webkit' ? webkit : chromium).launch();
for (const [w, h] of SIZES) for (const t of ['light', 'dark']) {
  const tag = `${w}-${t}`;
  const p = await seeded(b, SAVE, { width: w, height: h, dark: t === 'dark' });
  await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  const shot = async (name) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, quality: 70 }); };
  const sideways = async (name) => {
    const m = await p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const x = (e) => (e ? e.scrollWidth - e.clientWidth : 0);
      return { page: document.documentElement.scrollWidth - innerWidth, body: x(q('.mn-body')), book: x(q('.bk')), text: x(q('.bk-page')), head: x(q('.bk-head')) };
    });
    for (const [k, v] of Object.entries(m)) if (v > 0) problems.push(`${tag} ${name}: ${k} scrolls sideways by ${v}px`);
  };
  const boxes = () => p.evaluate(() => ['.bk-page', '.bk-foot', '.bk-turn:last-child'].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : '-'; }).join(' | '));
  await p.click('.wt-menu');
  await p.waitForSelector('.mn', { timeout: 5000 });
  await p.keyboard.press('5');
  await p.waitForTimeout(300);
  const tabs = await p.$$('.mn-views button');
  for (const x of tabs) if ((await x.textContent())?.trim() === '书') await x.click();
  await p.waitForTimeout(400);
  await sideways('shelf');
  await shot('shelf');
  const covers = await p.$$('.bk-cover');
  const titles = await p.$$eval('.bk-cover', (c) => c.map((x) => x.getAttribute('aria-label') ?? ''));
  const want = JSON.parse(readFileSync(`content/world/books/${BOOK}.json`, 'utf8')).zh;
  const cover = covers[Math.max(0, titles.findIndex((t) => t.startsWith(`《${want}》`)))];
  if (!cover) { problems.push(`${tag}: no cover on the shelf`); await p.context().close(); continue; }
  await cover.click();
  await p.waitForSelector('.bk', { timeout: 3000 });
  const first = await boxes();
  await shot('page-1');
  const n = (await p.$$('.bk-dot')).length;
  for (let i = 1; i < n; i++) {
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(120);
    if ((await boxes()) !== first) problems.push(`${tag}: the page box moved on page ${i + 1}: ${await boxes()} vs ${first}`);
    await sideways(`page-${i + 1}`);
  }
  await shot('today');
  await p.click('.bk-peek');
  await sideways('today-english');
  await shot('today-english');
  const read = await p.$$eval('.bk-dot[data-read]', (d) => d.length);
  if (read !== n) problems.push(`${tag}: ${read} of ${n} pages marked read`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  if (await p.$('.bk')) problems.push(`${tag}: Esc did not close the book`);
  if (!(await p.$('.mn'))) problems.push(`${tag}: Esc closed the menu with the book`);
  await shot('shelf-after');
  await p.context().close();
}
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
