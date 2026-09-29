// The §12 probe (W7): a clothes rack (look, try on), the barber's menu, the wardrobe
// sheet and the mirror's creator, at 375 / 768 / 1024 in light and dark. It reports
// sideways scroll of the page, a sheet wider or taller than the screen, the rack sheet
// overlapping the talk box, and the rack sheet changing size when a thing is tried on.
// Screenshots: <out>/<engine>-<width>-<theme>-<view>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright,
// which is not a dependency of the app:
//
//   HANZI_DEV_USER=admin PORT=5182 HANZI_DB=.data/world-test-5182.db node --import tsx server/src/dev.ts
//   npm i --no-save playwright            # once; `npx playwright install webkit` for Safari's engine
//   node scripts/world/rack-probe.mjs [chromium|webkit] [base] [out]
//
// Use a host name of its own (w5.localhost) when other sessions' servers share
// 127.0.0.1's cookies (Chromium; WebKit does not resolve *.localhost — give it http://localhost:<port>). The save is the chapter-6 golden save upgraded by the game's own
// migration, put where each view needs the hero, facing the thing to use.

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://w5.localhost:5182', OUT = 'docs/world-game/review/w/ui'] = process.argv.slice(2);
const GOLDEN = JSON.parse(readFileSync('content/world/test-saves/chapter-6.json', 'utf8'));

async function open(b, place, { width, height, dark }, extra = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // WebKit reports fetches cancelled by closing the page as errors (fonts, the workspace): not the page's
  p.on('pageerror', (e) => !/access control checks/.test(e.message) && problems.push(`${engine} ${width}: pageerror ${e.message}`));
  await p.goto(`${BASE}/today`);
  const st = await p.evaluate(async ({ golden, place, extra }) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(golden);
    if (!up.ok) return `unreadable: ${up.message}`;
    const s = up.save;
    const save = { ...s, created: true, deviceId: 'probe', clock: Math.floor(s.clock / 1440) * 1440 + 1440 + 10 * 60, bag: { ...s.bag, money: 900 }, flags: [...s.flags, 'haircut'], place, ...extra };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status}`;
  }, { golden: GOLDEN, place, extra });
  if (st !== '200') problems.push(`${engine} ${width}: seed ${st}`);
  await p.goto(`${BASE}/play/world`);
  await p.waitForSelector('.wt-menu', { timeout: 30000 });
  await p.waitForTimeout(1500);
  if (dark) await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  return p;
}

/** Talk to / use what is ahead. */
const act = (p) => p.evaluate(() => window.__world.act());

async function measure(p, tag, sel) {
  const m = await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el?.getBoundingClientRect();
    const box = document.querySelector('.wd')?.getBoundingClientRect();
    return {
      found: !!el,
      pageScroll: document.documentElement.scrollWidth - window.innerWidth,
      r: r && { l: r.left, t: r.top, w: r.width, h: r.height, b: r.bottom, rr: r.right },
      talkTop: box?.top ?? null,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  }, sel);
  if (!m.found) return problems.push(`${tag}: ${sel} not shown`), m;
  if (m.pageScroll > 0) problems.push(`${tag}: page scrolls sideways by ${m.pageScroll}px`);
  if (m.r.l < -0.5 || m.r.rr > m.vw + 0.5) problems.push(`${tag}: ${sel} wider than the screen (${Math.round(m.r.l)}…${Math.round(m.r.rr)} of ${m.vw})`);
  if (m.r.b > m.vh + 0.5) problems.push(`${tag}: ${sel} runs off the bottom (${Math.round(m.r.b)} of ${m.vh})`);
  if (sel === '.wk' && m.talkTop !== null && m.r.b > m.talkTop + 0.5) problems.push(`${tag}: the rack sheet covers the talk box (${Math.round(m.r.b)} > ${Math.round(m.talkTop)})`);
  return m;
}

const shot = (p, tag) => p.screenshot({ path: `${OUT}/${tag}.jpg`, type: 'jpeg', quality: 70 });

const SIZES = [[375, 812], [768, 1024], [1024, 768]];
const problems = [];
mkdirSync(OUT, { recursive: true });
const b = await (engine === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [width, height] of SIZES) for (const dark of [false, true]) {
  const tag = `${engine}-${width}-${dark ? 'dark' : 'light'}`;
  const size = { width, height, dark };
  // 瑞蚨祥: the seller at [4,3]; stand on her left, facing her
  let p = await open(b, { map: 'ruifuxiang', tile: [3, 3], facing: 'right' }, size);
  await act(p);
  await p.waitForSelector('.wk', { timeout: 8000 }).catch(() => {});
  const before = await measure(p, `${tag} rack`, '.wk');
  await shot(p, `${tag}-rack`);
  await p.locator('.wk-pic').first().click();
  await p.waitForTimeout(400);
  await p.locator('.wk-say', { hasText: 'try it on' }).click();
  await p.waitForTimeout(600);
  const after = await measure(p, `${tag} tried`, '.wk');
  if (before.r && after.r && (Math.abs(before.r.h - after.r.h) > 0.5 || Math.abs(before.r.t - after.r.t) > 0.5)) problems.push(`${tag}: the rack sheet moved when a thing was tried on`);
  await shot(p, `${tag}-tried`);
  await p.context().close();
  // 张师傅: the barber at [5,4]
  p = await open(b, { map: 'lifadian', tile: [4, 4], facing: 'right' }, size);
  await act(p);
  await p.waitForSelector('.wk', { timeout: 8000 }).catch(() => {});
  await measure(p, `${tag} barber`, '.wk');
  await shot(p, `${tag}-barber`);
  await p.context().close();
  // your room: the 衣柜 at [6,3], the 镜子 at [3,3]
  p = await open(b, { map: 'siheyuan-room', tile: [6, 4], facing: 'up' }, size, { wardrobe: ['jacket:blue', 'trousers:dark', 'sneakers:white', 'scarf:red', 'qipao:red', 'cap:blue', 'buxie:black', 'skirt:blue'] });
  await act(p);
  await p.waitForSelector('.wc', { timeout: 8000 }).catch(() => {});
  await measure(p, `${tag} wardrobe`, '.wc');
  await shot(p, `${tag}-wardrobe`);
  await p.context().close();
  p = await open(b, { map: 'siheyuan-room', tile: [3, 4], facing: 'up' }, size);
  await act(p);
  await p.waitForTimeout(800);
  await shot(p, `${tag}-mirror`);
  await p.context().close();
}
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
