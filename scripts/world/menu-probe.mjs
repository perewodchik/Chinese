// The §10 menu probe (P4): every tab, view and drawer of the menu, and a whole 成语
// Practise round, at 375 / 768 / 1024 in light and dark. It reports sideways
// scroll (page, menu body, drawer), anything in a list that moved when a drawer
// opened or a red dot cleared, a question that moved when it was answered, and
// Esc closing more than the drawer on top. Screenshots: <out>/<width>-<theme>-<view>.jpg.
//
// Needs the dev server on a test database (never the production one) and
// Playwright, which is not a dependency of the app:
//
//   HANZI_DEV_USER=admin PORT=5177 HANZI_DB=.data/world-pj.db node --import tsx server/src/dev.ts
//   npm i --no-save playwright            # once; `npx playwright install webkit` for Safari's engine
//   node scripts/world/menu-probe.mjs [chromium|webkit] [base] [golden save] [out] [only]
//
// Use 127.0.0.1, not localhost, when another session's server shares localhost's cookies.
// The save is upgraded by the game's own migration (imported from the dev server) and put
// on the server with the character creator marked done; this browser's local copy is dropped first.
// CHROMIUM=/path/to/chrome uses a browser already on the machine.

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://127.0.0.1:5177', SAVE = 'content/world/test-saves/chapter-6.json', OUT = 'docs/world-game/review/p', only] = process.argv.slice(2);

async function seeded(b, file, { width = 1024, height = 768, dark = false } = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`${BASE}/`);
  const save = { ...JSON.parse(readFileSync(file, 'utf8')), created: true, deviceId: 'probe' };
  const st = await p.evaluate(async (save) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    // upgraded by the game's own migration (the dev server serves it), since the server keeps the newest version
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(save);
    if (!up.ok) return `unreadable: ${up.message}`;
    save = { ...up.save, created: true };
    await fetch('/api/auth/session'); // signs in as HANZI_DEV_USER, before the page's own call does
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status} ${(await r.text()).slice(0, 120)}`;
  }, save);
  if (!st.startsWith('200')) console.log('seed:', st);
  await p.goto(`${BASE}/play/world`);
  await p.waitForSelector('.wt-menu', { timeout: 30000 });
  await p.waitForTimeout(1500);
  return p;
}

const theme = (p, t) => p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);

const SIZES = [[375, 812], [768, 1024], [1024, 768]];

mkdirSync(OUT, { recursive: true });
const problems = [];
const b = await (engine === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of SIZES) for (const t of ['light', 'dark']) {
  if (only && !`${w}-${t}`.includes(only)) continue;
  const p = await seeded(b, SAVE, { width: w, height: h, dark: t === 'dark' });
  await theme(p, t);
  // a photo in the album, so its drawer can be seen
  await p.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('zouzou:save:'));
    const user = k?.slice('zouzou:save:'.length) ?? 'x';
    const c = document.createElement('canvas'); c.width = 160; c.height = 120; const g = c.getContext('2d');
    g.fillStyle = '#8fb7d9'; g.fillRect(0, 0, 160, 70); g.fillStyle = '#b33'; g.fillRect(40, 40, 80, 50); g.fillStyle = '#6a5'; g.fillRect(0, 90, 160, 30);
    localStorage.setItem(`zouzou:album:${user}`, JSON.stringify([{ id: 'p1', at: 3000, map: 'tiananmen-square', subjects: [], place: '天安门', img: c.toDataURL('image/jpeg') }]));
  });
  const tag = `${w}-${t}`;
  const shot = async (name) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, quality: 70 }); };
  const check = async (name) => {
    const m = await p.evaluate(() => {
      const body = document.querySelector('.mn-body');
      const sheet = document.querySelector('.w-sheet');
      const shell = document.querySelector('.world-shell'); // overflow: hidden, but WebKit scrolls it to a focused thing past its edge
      return { page: document.documentElement.scrollWidth - innerWidth, shell: shell ? shell.scrollWidth - shell.clientWidth : 0, body: body ? body.scrollWidth - body.clientWidth : 0, sheet: sheet ? sheet.scrollWidth - sheet.clientWidth : 0 };
    });
    for (const [k, v] of Object.entries(m)) if (v > 0) problems.push(`${tag} ${name}: ${k} scrolls sideways by ${v}px`);
  };
  const firstRect = () => p.evaluate(() => { const e = document.querySelector('.mn-body > *:not(.w-sheet-scrim)'); const r = e?.getBoundingClientRect(); return r ? [Math.round(r.top), Math.round(r.height)].join(',') : ''; });
  const drawer = async (name, sel) => {
    const before = await firstRect();
    const el = await p.$(sel);
    if (!el) { problems.push(`${tag} ${name}: nothing to tap (${sel})`); return; }
    await el.click();
    await p.waitForSelector('.w-sheet', { timeout: 3000 }).catch(() => problems.push(`${tag} ${name}: no drawer`));
    await check(name);
    if ((await firstRect()) !== before) problems.push(`${tag} ${name}: the list moved when the drawer opened`);
    await shot(name);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    if (!(await p.$('.mn'))) { problems.push(`${tag} ${name}: Esc closed the whole menu`); await p.click('.wt-menu'); }
    const x = await p.$('.w-sheet-head .wd-tool[aria-label="Close"]');
    if (x) await x.click();
  };
  const view = async (tab, v, name) => {
    await p.keyboard.press(String(tab));
    if (v) { const btns = await p.$$('.mn-views button'); await btns[v - 1]?.click(); }
    await p.waitForTimeout(400);
    const before = await firstRect();
    await p.waitForTimeout(600); // a dot clears after the view opens
    if ((await firstRect()) !== before) problems.push(`${tag} ${name}: moved when its dot cleared`);
    await check(name);
    await shot(name);
  };
  await p.click('.wt-menu');
  await p.waitForSelector('.mn');
  await view(1, 1, 'journal-now');
  await drawer('journal-quest', '.mn-body .jn-row');
  await view(1, 2, 'journal-story');
  await view(1, 3, 'journal-diary');
  await view(2, 0, 'bag');
  await view(3, 0, 'map');
  await view(4, 0, 'people');
  await drawer('people-person', '.pp-rows .jn-row');
  // a person's quest drawer over their drawer
  await (await p.$('.pp-rows .jn-row'))?.click();
  await p.waitForTimeout(300);
  const q = await p.$('.w-sheet .jn-fold');
  if (q) { await q.click(); await p.waitForTimeout(300); await check('people-quest'); await shot('people-quest'); await p.keyboard.press('Escape'); await p.waitForTimeout(150); if ((await p.$$('.w-sheet')).length !== 1) problems.push(`${tag} people: Esc did not close just the quest drawer`); await p.keyboard.press('Escape'); }
  else { await p.keyboard.press('Escape'); }
  await p.waitForTimeout(200);
  if (await p.$('.w-sheet')) problems.push(`${tag} people: a drawer is still open after two Esc`);
  if (!(await p.$('.mn'))) { problems.push(`${tag} people: Esc closed the whole menu`); await p.click('.wt-menu'); }
  await view(5, 1, 'col-spirits');
  await drawer('col-spirit', '.cl-spirit:not([data-missing])');
  await drawer('col-spirit-missing', '.cl-spirit[data-missing]');
  await view(5, 2, 'col-idioms');
  await drawer('col-idiom', '.cl-idiom');
  // Practise: each question until the end, the first option each time
  await p.click('.cl-practise');
  await p.waitForSelector('.cl-q');
  await check('practise'); await shot('practise-q1');
  for (let i = 0; i < 9; i++) {
    const kind = await p.$eval('.cl-prompt', (e) => e.textContent).catch(() => null);
    if (!kind) break;
    const stage = await p.evaluate(() => { const r = document.querySelector('.cl-stage')?.getBoundingClientRect(); return r && `${Math.round(r.top)},${Math.round(r.height)}`; });
    if (await p.$('.cl-say')) {
      await p.fill('.cl-say input', i % 2 ? 'hua long dian jing' : '');
      if (i % 2) await p.press('.cl-say input', 'Enter'); else await p.click('.cl-say .btn.ghost');
    } else await p.click('.cl-opt');
    await p.waitForTimeout(200);
    const after = await p.evaluate(() => { const r = document.querySelector('.cl-stage')?.getBoundingClientRect(); return r && `${Math.round(r.top)},${Math.round(r.height)}`; });
    if (stage !== after) problems.push(`${tag} practise ${kind}: the question moved when answered (${stage} → ${after})`);
    await check(`practise-${i}`);
    if (i < 5) await shot(`practise-a${i + 1}`);
    await p.click('.cl-after .btn');
    await p.waitForTimeout(200);
  }
  await check('practise-end'); await shot('practise-end');
  await p.click('.cl-end-actions .btn.ghost');
  await view(5, 3, 'col-stamps-cover');
  await p.click('.cl-pages .jn-row');
  await p.waitForTimeout(200);
  await check('col-stamps-page'); await shot('col-stamps-page');
  await drawer('col-stamp-got', '.cl-stamp[data-got]');
  await p.click('.cl-pager .wd-tool[aria-label="Next page"]');
  await p.waitForTimeout(200);
  await drawer('col-stamp-missing', '.cl-stamp:not([data-got])');
  await view(5, 4, 'col-album');
  await drawer('col-album-photo', '.w-album button');
  await p.click('.mn-gear');
  await p.waitForTimeout(200);
  await check('settings'); await shot('settings');
  await p.context().close();
}
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
