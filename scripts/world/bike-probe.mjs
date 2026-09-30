// The §13 L probe (L4): the bike shop (the sheet, a test ride), riding your own bike with a basket
// (兔儿爷 in it), the bell's caption, a park gate's no-ride sign, the bike parked, and 骑车去
// between districts — at 375 / 768 / 1024 in light and dark. It reports sideways scroll of the
// page, the sheet wider or taller than the screen, the sheet covering the talk box or changing
// size on the test ride. Screenshots: <out>/<engine>-<width>-<theme>-<view>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright, which is
// not a dependency of the app:
//
//   HANZI_DEV_USER=admin PORT=5182 HANZI_DB=.data/world-test-5182.db node --import tsx server/src/dev.ts
//   npm i --no-save playwright
//   node scripts/world/bike-probe.mjs [chromium|webkit] [base] [out]
//
// The save is the chapter-6 golden save upgraded by the game's own migration, put where each
// view needs the hero; for riding it is given a bike.

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://localhost:5182', OUT = 'docs/world-game/review/l'] = process.argv.slice(2);
const GOLDEN = JSON.parse(readFileSync('content/world/test-saves/chapter-6.json', 'utf8'));
const BIKE = { model: 'fenghuang', colour: 'red', parts: ['basket', 'lock'], bell: 1, at: 'riding', got: 0 };

async function open(b, place, { width, height, dark }, extra = {}) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => !/access control checks/.test(e.message) && problems.push(`${engine} ${width}: pageerror ${e.message}`));
  await p.goto(`${BASE}/today`);
  const st = await p.evaluate(async ({ golden, place, extra }) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(golden);
    if (!up.ok) return `unreadable: ${up.message}`;
    const s = up.save;
    const save = { ...s, created: true, deviceId: 'probe', clock: Math.floor(s.clock / 1440) * 1440 + 1440 + 10 * 60, bag: { ...s.bag, money: 900 }, place, ...extra };
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

const act = (p) => p.evaluate(() => window.__world.act());

async function measure(p, tag, sel) {
  const m = await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el?.getBoundingClientRect();
    const box = document.querySelector('.wd')?.getBoundingClientRect();
    return { found: !!el, pageScroll: document.documentElement.scrollWidth - window.innerWidth, r: r && { l: r.left, t: r.top, w: r.width, h: r.height, b: r.bottom, rr: r.right }, talkTop: box?.top ?? null, vw: window.innerWidth, vh: window.innerHeight };
  }, sel);
  if (!m.found) return problems.push(`${tag}: ${sel} not shown`), m;
  if (m.pageScroll > 0) problems.push(`${tag}: page scrolls sideways by ${m.pageScroll}px`);
  if (m.r.l < -0.5 || m.r.rr > m.vw + 0.5) problems.push(`${tag}: ${sel} wider than the screen (${Math.round(m.r.l)}…${Math.round(m.r.rr)} of ${m.vw})`);
  if (m.r.b > m.vh + 0.5) problems.push(`${tag}: ${sel} runs off the bottom (${Math.round(m.r.b)} of ${m.vh})`);
  if (sel === '.wk' && m.talkTop !== null && m.r.b > m.talkTop + 0.5) problems.push(`${tag}: the bike sheet covers the talk box (${Math.round(m.r.b)} > ${Math.round(m.talkTop)})`);
  return m;
}

const shot = (p, tag) => p.screenshot({ path: `${OUT}/${tag}.jpg`, type: 'jpeg', quality: 70 });

const SIZES = [[375, 812], [768, 1024], [1024, 768]];
const problems = [];
mkdirSync(OUT, { recursive: true });
const b = await (engine === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const only = process.env.SIZES ? SIZES.filter(([w]) => process.env.SIZES.split(',').includes(String(w))) : SIZES;
for (const [width, height] of only) for (const dark of [false, true]) {
  const tag = `${engine}-${width}-${dark ? 'dark' : 'light'}`;
  const size = { width, height, dark };
  // the bike shop: the owner at [8,6] on 鼓楼东大街; stand below him, facing up
  let p = await open(b, { map: 'gulou-dongdajie', tile: [8, 7], facing: 'up' }, size);
  await act(p);
  await p.waitForSelector('.wk', { timeout: 8000 }).catch(() => {});
  const before = await measure(p, `${tag} shop`, '.wk');
  await shot(p, `${tag}-shop`);
  await p.locator('.wk-pic').nth(1).click();
  await p.waitForTimeout(500);
  await p.locator('.wk-say', { hasText: 'test ride' }).click();
  await p.waitForTimeout(1200);
  const after = await measure(p, `${tag} test ride`, '.wk');
  if (before.r && after.r && (Math.abs(before.r.h - after.r.h) > 0.5 || Math.abs(before.r.t - after.r.t) > 0.5)) problems.push(`${tag}: the bike sheet moved on the test ride`);
  await shot(p, `${tag}-test-ride`);
  await p.context().close();
  // riding your own bike on 南锣鼓巷's street, basket and 兔儿爷; the bell
  p = await open(b, { map: 'gulou-dongdajie', tile: [20, 7], facing: 'right' }, size, { bike: BIKE });
  if (!(await p.locator('.wbd-btn[data-state="riding"]').count())) problems.push(`${tag}: no 🚲 riding button`);
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(400);
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(400);
  await p.locator('.wbd-btn[aria-label="Ring the bell"]').click();
  await p.waitForTimeout(300);
  await shot(p, `${tag}-riding`);
  // 骑车去: the metro map's row, then the ride's picture
  await p.locator('.wt-btn[aria-label="Map (M)"]').click();
  await p.waitForTimeout(600);
  await p.getByRole('radio', { name: /metro/ }).click().catch(() => p.getByText('北京 · metro').click());
  await p.waitForTimeout(400);
  const chips = await p.locator('.wbr-chip').count();
  if (!chips) problems.push(`${tag}: no 骑车去 chips on the metro map`);
  await shot(p, `${tag}-ride-chips`);
  if (chips) {
    await p.locator('.wbr-chip').first().click();
    await p.waitForTimeout(1500);
    await measure(p, `${tag} ride`, '.wbr');
    await shot(p, `${tag}-ride`);
    await p.locator('.wbr button', { hasText: 'Skip' }).click();
    await p.waitForTimeout(2500);
    await shot(p, `${tag}-arrived`);
  }
  await p.context().close();
  // a park gate: riding into 景山 — the sign, and the bike stays outside
  p = await open(b, { map: 'beihai-north', tile: [34, 14], facing: 'right' }, size, { bike: BIKE });
  for (let i = 0; i < 3; i++) {
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(1500);
  const sign = await p.locator('.wd').innerText().catch(() => '');
  if (!/禁/.test(sign) || !/止/.test(sign)) problems.push(`${tag}: no 禁止骑车 sign at the park gate (${sign.slice(0, 40)})`);
  await shot(p, `${tag}-park-gate`);
  await p.context().close();
}
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
