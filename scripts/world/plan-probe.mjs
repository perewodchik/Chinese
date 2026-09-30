// The plan probe (M6–M8): the corner map and the 🗺 tab's neighbourhood plan for every
// neighbourhood, at 375 / 768 / 1024 in light and dark, in Chromium or WebKit.
// It reports, per plan: a street picture whose file is not the shape of its box (a stale or
// wrong miniature), an image URL without a build stamp, a missing corner map, and sideways
// scroll (where cards sit is tested in core/hoods.test.ts). Screenshots: <out>/<engine>-<w>-<theme>-<hood>.jpg
// and <out>/<engine>-<w>-<theme>-mini-<hood>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright
// (`npm i --no-save playwright`, `npx playwright install webkit`):
//
//   HANZI_DEV_USER=admin PORT=5181 HANZI_DB=.data/words-test.db node --import tsx server/src/dev.ts
//   node scripts/world/plan-probe.mjs [chromium|webkit] [base] [out] [only-hood] [sizes e.g. 375,1024] [themes e.g. light]
//
// Each neighbourhood is opened by standing on its first street (`?map=`), so the corner map
// shows it around you; the save is chapter-6's with the character creator done.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://127.0.0.1:5181', OUT = 'docs/world-game/review/m', only, sizesArg, themesArg] = process.argv.slice(2);
const SAVE = process.env.SAVE ?? 'content/world/test-saves/chapter-6.json';
const plans = JSON.parse(readFileSync('public/world/maps/hoods.json', 'utf8'));
const SIZES = [[375, 812], [768, 1024], [1024, 768]].filter(([w]) => !sizesArg || sizesArg.split(',').includes(String(w)));
const THEMES = themesArg ? themesArg.split(',') : ['light', 'dark'];

async function seeded(b, { width, height, dark }) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`${BASE}/today`);
  const save = { ...JSON.parse(readFileSync(SAVE, 'utf8')), created: true, deviceId: 'probe' };
  const st = await p.evaluate(async (save) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save') || k === 'zouzou:minimap') localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(save);
    if (!up.ok) return `unreadable: ${up.message}`;
    save = { ...up.save, created: true };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status}`;
  }, save);
  if (st !== '200') console.log('seed:', st);
  return p;
}

const problems = [];
// CHROMIUM=/path/to/chrome uses a browser already on the machine (else Playwright's "Chrome for Testing" if it is there)
const testChrome = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = process.env.CHROMIUM ?? (existsSync(testChrome) ? testChrome : undefined);
const b = await (engine === 'webkit' ? webkit : chromium).launch(engine !== 'webkit' && chrome ? { executablePath: chrome } : {});
mkdirSync(OUT, { recursive: true });
for (const [w, h] of SIZES)
  for (const t of THEMES) {
    const p = await seeded(b, { width: w, height: h, dark: t === 'dark' });
    for (const plan of plans) {
      if (only && plan.id !== only) continue;
      const tag = `${engine}-${w}-${t}`;
      const first = plan.areas[0]?.map;
      if (!first) continue;
      await p.goto(`${BASE}/play/world?map=${first}&time=day`);
      await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
      await p.waitForSelector('.wt-menu', { timeout: 30000 });
      await p.waitForTimeout(1800);
      const mini = await p.$('.wm');
      if (mini) await mini.screenshot({ path: `${OUT}/${tag}-mini-${plan.id}.jpg`, quality: 75 });
      // the corner map hides while someone talks (a first visit opens with a line): that is by design
      else if (!(await p.$('.wd'))) problems.push(`${tag} ${plan.id}: no corner map`);
      else console.log(`${tag} ${plan.id}: corner map hidden by a dialogue (as designed)`);
      await p.click('.wt-menu');
      await p.waitForSelector('.mn');
      await p.keyboard.press('3');
      await p.waitForSelector('.wp-plan', { timeout: 5000 }).catch(() => problems.push(`${tag} ${plan.id}: no plan`));
      await p.waitForTimeout(900);
      const m = await p.evaluate(async () => {
        const out = { stale: [], unstamped: [], scroll: document.documentElement.scrollWidth - innerWidth };
        const imgs = [...document.querySelectorAll('.wp-plan image')];
        for (const im of imgs) {
          const href = im.getAttribute('href') ?? '';
          if (!/\?v=/.test(href)) out.unstamped.push(href);
          const box = [Number(im.getAttribute('width')), Number(im.getAttribute('height'))];
          const pic = await new Promise((res) => {
            const i = new Image();
            i.onload = () => res([i.naturalWidth, i.naturalHeight]);
            i.onerror = () => res(null);
            i.src = href;
          });
          if (pic && im.closest('.hp-area') && Math.abs(pic[0] / pic[1] - box[0] / box[1]) > 0.02) out.stale.push(`${href} is ${pic.join('×')}, box ${box.join('×')}`);
        }
        return out;
      });
      for (const s of m.stale) problems.push(`${tag} ${plan.id}: wrong-shaped picture ${s}`);
      for (const s of m.unstamped) problems.push(`${tag} ${plan.id}: no build stamp on ${s}`);
      if (m.scroll > 0) problems.push(`${tag} ${plan.id}: the page scrolls sideways by ${m.scroll}px`);
      await p.screenshot({ path: `${OUT}/${tag}-${plan.id}.jpg`, quality: 75 });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
    }
    await p.context().close();
  }
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
