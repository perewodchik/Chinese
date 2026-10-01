// The metro ride probe (MT7): from 王府井's platform, walk to a side (the train comes in at once),
// get on, ride a stop, and get off — at 375 / 768 / 1024, light and dark. It reports a scene that
// changed size between steps (layout shift), sideways scroll, and a step that did not happen.
// Screenshots: <out>/<width>-<theme>-<step>.jpg.
//
// Needs the dev server on a test database (never the production one) and Playwright:
//
//   HANZI_DEV_USER=admin PORT=5179 HANZI_DB=.data/world-test.db node --import tsx server/src/dev.ts
//   node scripts/world/metro-ride-probe.mjs [chromium|webkit] [base] [out]

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'webkit', BASE = 'http://127.0.0.1:5179', OUT = 'docs/world-game/review/mt'] = process.argv.slice(2);
const SAVE = 'content/world/test-saves/chapter-6.json';

async function seeded(b, { width, height, dark }) {
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => (/access control/.test(e.message) ? null : console.log('pageerror:', e.message)));
  await p.goto(`${BASE}/`);
  const save = { ...JSON.parse(readFileSync(SAVE, 'utf8')), created: true, deviceId: 'probe' };
  await p.evaluate(async (save) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(save);
    save = { ...up.save, created: true, place: { map: 'station-wangfujing', tile: [8, 11], facing: 'down' } };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
  }, save);
  await p.goto(`${BASE}/play/world`);
  await p.waitForSelector('.wt-menu', { timeout: 30000 });
  await p.waitForTimeout(1500);
  return p;
}

mkdirSync(OUT, { recursive: true });
const problems = [];
const b = await (engine === 'webkit' ? webkit : chromium).launch();
for (const [w, h] of [[375, 812], [768, 1024], [1024, 768]]) for (const t of ['light', 'dark']) {
  const tag = `${w}-${t}`;
  const p = await seeded(b, { width: w, height: h, dark: t === 'dark' });
  await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
  // down to the platform edge and on towards the track: the board's trains (the platform opens)
  for (let i = 0; i < 4 && !(await p.$('.mr')); i++) {
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(700);
  }
  if (!(await p.$('.mr'))) {
    problems.push(`${tag}: the platform never opened`);
    await p.context().close();
    continue;
  }
  const sizes = new Set();
  const shot = async (name, expect) => {
    const m = await p.evaluate(() => {
      const st = document.querySelector('.mr-stage')?.getBoundingClientRect();
      return { stage: st ? `${Math.round(st.width)}x${Math.round(st.height)}` : '', side: document.documentElement.scrollWidth - innerWidth, text: document.querySelector('.mr')?.textContent ?? '' };
    });
    sizes.add(m.stage);
    if (m.side > 0) problems.push(`${tag} ${name}: page scrolls sideways by ${m.side}px`);
    if (expect && !expect.test(m.text)) problems.push(`${tag} ${name}: expected ${expect}`);
    await p.screenshot({ path: `${OUT}/${tag}-${name}.jpg`, quality: 70 });
  };
  await shot('1-platform', /Walk to a side/);
  await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(2900);
  await shot('2-doors-open', /上车/);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(2200);
  await shot('3-running', /Next station/);
  await p.waitForTimeout(4400);
  await shot('4-stopped', /Doors open|terminal/);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1300);
  await shot('5-off', /出站|Walk to a side|上车/);
  if (sizes.size > 1) problems.push(`${tag}: the scene changed size: ${[...sizes].join(' → ')}`);
  console.log(tag, [...sizes].join(' '));
  await p.context().close();
}
await b.close();
console.log(problems.length ? `\n${problems.length} problems:\n${problems.join('\n')}` : '\nno problems');
