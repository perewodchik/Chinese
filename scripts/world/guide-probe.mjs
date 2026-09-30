// The "Take me there" probe (M6), in Chromium or WebKit at a given width: from a start map it
// sets the goal from the 🗺 place card, screenshots the footprints and the corner map, then taps
// the board (or the tracks), takes every marked train, gets off where it says, goes out where it
// says, and checks 兔儿爷's "Here we are" and the goal cleared at the end. Screenshots:
// <out>/<engine>-<w>-<step>.jpg.
//
//   HANZI_DEV_USER=admin PORT=5181 HANZI_DB=.data/words-test.db node --import tsx server/src/dev.ts
//   node scripts/world/guide-probe.mjs [chromium|webkit] [base] [out] [width] [start map] [goal map] [hood of goal]

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://127.0.0.1:5181', OUT = 'docs/world-game/review/m6', W = '1024', START = 'stop-xizhimen', GOAL = 'stop-yiheyuan', HOOD = '颐和园'] = process.argv.slice(2);
const width = Number(W);
const height = width < 700 ? 812 : 768;
const testChrome = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = process.env.CHROMIUM ?? (existsSync(testChrome) ? testChrome : undefined);
const b = await (engine === 'webkit' ? webkit : chromium).launch(engine !== 'webkit' && chrome ? { executablePath: chrome } : {});
const p = await (await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
p.on('pageerror', (e) => !/access control/.test(e.message) && console.log('pageerror:', e.message));
mkdirSync(OUT, { recursive: true });
const shot = (name) => p.screenshot({ path: `${OUT}/${engine}-${width}-${name}.jpg`, quality: 75 });
const log = (s) => console.log(s);
const problems = [];

// seed chapter-6's save (upgraded by the game's own migration), then open the start map
await p.goto(`${BASE}/today`);
const save = { ...JSON.parse(readFileSync('content/world/test-saves/chapter-6.json', 'utf8')), created: true, deviceId: 'probe' };
await p.evaluate(async (save) => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
  const { readSave } = await import('/src/world/core/migrate.ts');
  const up = readSave(save);
  await fetch('/api/auth/session');
  const cur = await (await fetch('/api/world')).json();
  await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...up.save, created: true, updatedAt: Date.now() } }) });
}, save);
await p.goto(`${BASE}/play/world?map=${START}&time=day`);
await p.waitForSelector('.wt-menu', { timeout: 30000 });
await p.waitForTimeout(1800);
// a first-visit line: close it
for (let i = 0; i < 6 && (await p.$('.wd')); i++) {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const done = await p.$('.wd button.primary, .wd .btn.primary');
  if (done) await done.click().catch(() => {});
  await p.waitForTimeout(300);
}

// the goal, from the place card
await p.click('.wt-menu');
await p.keyboard.press('3');
await p.waitForSelector('.wp-plan');
await p.evaluate(async (hood) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const seg = [...document.querySelectorAll('.wp-maphead button')].find((x) => /Neighbourhood/.test(x.textContent));
  seg?.click();
  await wait(300);
  const next = document.querySelector('[aria-label="The next neighbourhood"]');
  for (let i = 0; i < 20 && document.querySelector('.wp-hoodpick b')?.textContent !== hood; i++) {
    next?.click();
    await wait(120);
  }
}, HOOD);
await p.waitForTimeout(500);
await p.evaluate((goal) => {
  const g = [...document.querySelectorAll('.hp-area, .hp-room')].find((x) => x.querySelector('image')?.getAttribute('href')?.startsWith(`/world/minis/${goal}.png`));
  g?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, GOAL);
await p.waitForTimeout(300);
const take = await p.$('.wp-take');
if (!take) problems.push('no Take me there on the place card');
const w0 = await take?.evaluate((x) => x.getBoundingClientRect().width);
await take?.click();
await p.waitForTimeout(300);
const w1 = await take?.evaluate((x) => x.getBoundingClientRect().width);
if (w0 !== w1) problems.push(`the button changed width ${w0} → ${w1}`);
await shot('1-card');
await p.keyboard.press('Escape');
await p.click('.mn-close').catch(() => {});
await p.waitForTimeout(900);
if (!(await p.$('.wm-guide'))) problems.push('no chip under the corner map');
await shot('2-footprints');

// to the board: a tap on it walks there and reads it (the ride sheet)
const board = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? [c.getBoundingClientRect().width, c.getBoundingClientRect().height] : null;
});
log(`canvas ${board}`);
// a tile's middle on the page, from the camera's view in tiles (window.__world, the page's probe handle)
const tapTile = async ([x, y]) => {
  const at = await p.evaluate(([x, y]) => {
    const w = window.__world;
    const v = w?.view();
    const c = document.querySelector('canvas')?.getBoundingClientRect();
    if (!v || !c) return null;
    const px = c.left + ((x + 0.5 - v.x) / v.w) * c.width;
    const py = c.top + ((y + 0.5 - v.y) / v.h) * c.height;
    return px > c.left + 4 && px < c.right - 4 && py > c.top + 60 && py < c.bottom - 4 ? [px, py] : null;
  }, [x, y]);
  if (!at) return false;
  await p.mouse.click(at[0], at[1]);
  return true;
};
const trail = () => p.evaluate(() => window.__world?.trail() ?? null);
/** follow the footprints to their end: tap the furthest print on screen, wait, again */
async function walkTrail() {
  for (let i = 0; i < 20; i++) {
    const t = await trail();
    if (!t || !t.path.length) return true;
    let tapped = false;
    for (let k = t.path.length - 1; k >= 0 && !tapped; k--) tapped = await tapTile(t.path[k]);
    if (!tapped) return false;
    for (let j = 0; j < 40; j++) {
      await p.waitForTimeout(250);
      const n = await trail();
      if (!n || n.at.join() === t.at.join() ? j > 4 : false) break;
      if (n && n.path.length === 0) break;
    }
  }
  return false;
}
async function openSheet() {
  await walkTrail();
  // the prints end beside the board: tap round where they ended until it opens
  const t = await trail();
  const [x, y] = t?.at ?? [0, 0];
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 2]]) {
    if (await p.$('.wr')) break;
    await tapTile([x + dx, y + dy]);
    await p.waitForTimeout(1800);
  }
  return !!(await p.$('.wr'));
}
// follow the way: walk the prints; where they end at a board, ride; again — until the chip goes (arrived)
// a story scene (cutscene) or a first-visit line may start on the way: let it play out, then go on
async function sitThrough() {
  for (let i = 0; i < 80; i++) {
    const cs = await p.$('.cs-layer');
    const wd = await p.$('.wd');
    if (!cs && !wd) return;
    if (i === 0) log(cs ? 'a cutscene plays' : 'someone speaks');
    if (cs) await cs.click().catch(() => {});
    else {
      const done = await p.$('.wd .btn.primary');
      if (done) await done.click().catch(() => {});
      else await p.keyboard.press('Escape');
    }
    await p.waitForTimeout(600);
  }
}
const chip = async () => {
  await sitThrough();
  return p.$('.wm-guide');
};
let legs = 0;
for (let hop = 0; hop < 16 && (await chip()); hop++) {
  const before = await p.evaluate(() => window.__world?.trail()?.path.length ?? 0);
  await walkTrail();
  await sitThrough();
  // stepping on the last print's door or street end carries you to the next map
  await p.waitForTimeout(1500);
  if (!(await chip())) break;
  const t = await trail();
  if (t && t.path.length) continue;
  if (!(await openSheet())) {
    // no board beside you: the trail had nothing left (a door you stand in front of) — try one step on
    if (before === 0) {
      problems.push('stuck: no prints, no board');
      break;
    }
    continue;
  }
  if (!legs++) await shot('3-board');
  const ride = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (let i = 0; i < 600; i++) {
      await wait(120);
      const sign = document.querySelector('.wr-sign')?.textContent;
      const on = !!document.querySelector('.wr-train');
      const g = document.querySelector('.wr-acts .btn[data-guide]');
      if (!on) {
        const t = [...document.querySelectorAll('.wr-train-btn')].find((x) => x.hasAttribute('data-guide'));
        if (t) {
          out.push(`${sign}: take ${t.textContent.slice(0, 12)}`);
          t.click();
          await wait(300);
          continue;
        }
        if (g) {
          out.push(`${sign}: out (${g.textContent})`);
          return out;
        }
        out.push(`${sign}: nothing marked`);
        return out;
      } else if (g && !g.disabled) {
        out.push(`${sign}: get off`);
        g.click();
        await wait(300);
      }
    }
    return out;
  });
  for (const l of ride) log(l);
  if (!ride.at(-1)?.includes('out')) {
    problems.push('no way out marked at the end of the ride');
    break;
  }
  await shot(`4-out-${legs}`);
  await p.click('.wr-acts .btn[data-guide]').catch(() => {});
  await p.waitForTimeout(2500);
}
const end = await p.evaluate(() => ({ chip: document.querySelector('.wm-guide')?.textContent ?? null, here: document.querySelector('.wm-head')?.textContent ?? null }));
log(`after: ${JSON.stringify(end)}`);
if (end.chip) problems.push(`not arrived: ${end.chip}`);
await shot('5-arrived');
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
