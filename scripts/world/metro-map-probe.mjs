// The metro map probe (MM4, the learner's iPhone, 2026-10-01): at 375 / 768 / 1024, light and
// dark, and at three zooms (fully out, after one pinch, fully in), no station name may cover a
// station circle or another name. It also pinches the way Safari does (gesturestart / change /
// end with a scale) and checks that one pinch zooms the whole range.
// Screenshots: <out>/<width>-<theme>-<zoom>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright:
//
//   HANZI_DEV_USER=admin PORT=5179 HANZI_DB=.data/world-test.db node --import tsx server/src/dev.ts
//   node scripts/world/metro-map-probe.mjs [chromium|webkit] [base] [golden save] [out]

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'webkit', BASE = 'http://127.0.0.1:5179', SAVE = 'content/world/test-saves/chapter-6.json', OUT = 'docs/world-game/review/mm'] = process.argv.slice(2);

async function seeded(b, file, { width, height, dark }) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`${BASE}/`);
  const save = { ...JSON.parse(readFileSync(file, 'utf8')), created: true, deviceId: 'probe' };
  const st = await p.evaluate(async (save) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(save);
    if (!up.ok) return `unreadable: ${up.message}`;
    save = { ...up.save, created: true };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status}`;
  }, save);
  if (!st.startsWith('200')) console.log('seed:', st);
  await p.goto(`${BASE}/play/world`);
  await p.waitForSelector('.wt-menu', { timeout: 30000 });
  await p.waitForTimeout(1200);
  return p;
}

/** every name's box against every circle and every other name, in screen pixels */
const overlaps = (p) =>
  p.evaluate(() => {
    const box = (e) => e.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const names = [...document.querySelectorAll('.wp-metro .mm-name')].map((e) => ({ t: e.textContent, r: box(e) }));
    // the circle itself, shrunk to the square inside it (the name may sit by its corner)
    const dots = [...document.querySelectorAll('.wp-metro .mm-dot')].map((e) => {
      const r = box(e);
      const k = (r.width / 2) * 0.7;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return { left: cx - k, right: cx + k, top: cy - k, bottom: cy + k };
    });
    const out = [];
    for (const n of names) {
      // the text's box includes its halo; take the glyphs' box a little inside it
      const g = { left: n.r.left + 2, right: n.r.right - 2, top: n.r.top + 2, bottom: n.r.bottom - 2 };
      if (dots.some((d) => hit(g, d))) out.push(`${n.t} covers a station`);
      for (const m of names) if (m !== n && hit(g, { left: m.r.left + 2, right: m.r.right - 2, top: m.r.top + 2, bottom: m.r.bottom - 2 })) out.push(`${n.t} × ${m.t}`);
    }
    return { names: names.length, out: [...new Set(out)] };
  });

const viewW = (p) => p.evaluate(() => Number(document.querySelector('.wp-metro').getAttribute('viewBox').split(' ')[2]));

/** a pinch as Safari sends it: gesture events with a growing scale */
const safariPinch = (p, scale) =>
  p.evaluate(async (scale) => {
    const svg = document.querySelector('.wp-metro');
    const r = svg.getBoundingClientRect();
    const g = (type, s) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { scale: s, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      svg.dispatchEvent(e);
    };
    g('gesturestart', 1);
    for (let i = 1; i <= 12; i++) {
      g('gesturechange', 1 + ((scale - 1) * i) / 12);
      await new Promise((f) => requestAnimationFrame(f));
    }
    g('gestureend', scale);
    await new Promise((f) => setTimeout(f, 120));
  }, scale);

mkdirSync(OUT, { recursive: true });
const problems = [];
const b = await (engine === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of [[375, 812], [768, 1024], [1024, 768]]) for (const t of ['light', 'dark']) {
  const tag = `${w}-${t}`;
  const p = await seeded(b, SAVE, { width: w, height: h, dark: t === 'dark' });
  await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  await p.click('.wt-menu');
  await p.getByRole('tab', { name: 'Map' }).click();
  await p.getByRole('button', { name: '北京 · metro' }).click();
  await p.waitForSelector('.wp-metro');
  await p.waitForTimeout(400);
  const w0 = await viewW(p);
  for (const [zoom, act] of [
    ['out', async () => {}],
    ['mid', () => safariPinch(p, 2.2)],
    ['in', () => safariPinch(p, 6)],
  ]) {
    await act();
    await p.waitForTimeout(300);
    const { names, out } = await overlaps(p);
    for (const o of out) problems.push(`${tag} ${zoom}: ${o}`);
    if (!names) problems.push(`${tag} ${zoom}: no names at all`);
    await p.screenshot({ path: `${OUT}/${tag}-${zoom}.jpg`, quality: 70 });
    console.log(tag, zoom, `view ${Math.round(await viewW(p))}`, `${names} names`);
  }
  // one Safari pinch from fully out reaches fully in
  const wIn = await viewW(p);
  if (wIn > w0 / 4) problems.push(`${tag}: two pinches only zoomed ${w0} → ${wIn}`);
  await p.context().close();
}
await b.close();
console.log(problems.length ? `\n${problems.length} problems:\n${problems.join('\n')}` : '\nno problems');
