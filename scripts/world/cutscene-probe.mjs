// The §13 K1 probe: every cutscene in the built content, played in the page with
// ?cutscene=<id>; six frames spread over its run are stitched into one strip,
// docs/world-game/review/k/<id>.png, so the learner can see each without playing.
// Lines are tapped on as they come. It also reports: the canvas moving when the
// letterbox comes in (it must be a transform), a line box off the screen, a tapped
// word not opening the word drawer, and ⏭ held not ending the cutscene.
//
// Needs the dev server on a test database (never the production one) and Playwright:
//
//   HANZI_DEV_USER=admin PORT=5183 HANZI_DB=.data/world-test-5183.db node --import tsx server/src/dev.ts
//   npm i --no-save playwright
//   node scripts/world/cutscene-probe.mjs [chromium|webkit] [base] [out] [id …]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'chromium', BASE = 'http://k1.localhost:5183', OUT = 'docs/world-game/review/k', ...only] = process.argv.slice(2);
const GOLDEN = JSON.parse(readFileSync('content/world/test-saves/chapter-1.json', 'utf8'));
const all = readdirSync('public/world/content')
  .filter((f) => f.endsWith('.json') && f !== 'index.json' && f !== 'clothes.json')
  .flatMap((f) => JSON.parse(readFileSync(`public/world/content/${f}`, 'utf8')).cutscenes ?? []);
const list = only.length ? all.filter((c) => only.includes(c.id)) : all;
const problems = [];
mkdirSync(OUT, { recursive: true });

const b = await (engine === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const [width, height] = [1024, 768];

async function seed(p, cs) {
  await p.goto(`${BASE}/today`);
  const st = await p.evaluate(async ({ golden, map }) => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zouzou:save')) localStorage.removeItem(k);
    const { readSave } = await import('/src/world/core/migrate.ts');
    const up = readSave(golden);
    if (!up.ok) return `unreadable: ${up.message}`;
    const save = { ...up.save, created: true, deviceId: 'probe', place: { map, tile: [8, 8], facing: 'down' } };
    await fetch('/api/auth/session');
    const cur = await (await fetch('/api/world')).json();
    const r = await fetch('/api/world', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRevision: cur.revision, save: { ...save, updatedAt: Date.now() } }) });
    return `${r.status}`;
  }, { golden: GOLDEN, map: cs.map });
  if (st !== '200') problems.push(`${cs.id}: seed ${st}`);
}

for (const cs of list) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => !/access control checks/.test(e.message) && problems.push(`${cs.id}: pageerror ${e.message}`));
  await seed(p, cs);
  await p.goto(`${BASE}/play/world?cutscene=${encodeURIComponent(cs.id)}`);
  await p.waitForSelector('.cs-layer', { timeout: 30000 }).catch(() => problems.push(`${cs.id}: never started`));
  const canvasAt = await p.evaluate(() => JSON.stringify(document.querySelector('.world-canvas')?.getBoundingClientRect()));
  const frames = [];
  let wordChecked = false;
  const t0 = Date.now();
  // six frames over about 12 s of play (longer ones are sampled wider), tapping lines on
  for (let i = 0; i < 40 && frames.length < 6; i++) {
    await p.waitForTimeout(600);
    const on = await p.$('.cs-layer');
    if (!on) break;
    if (i % 3 === 1) frames.push((await p.screenshot({ type: 'png' })).toString('base64'));
    const box = await p.$('.cs-box');
    if (box) {
      const r = await box.boundingBox();
      if (r && (r.x < 0 || r.x + r.width > width || r.y + r.height > height)) problems.push(`${cs.id}: the line box is off the screen`);
      const word = !wordChecked && (await p.$('.cs-zh .wd-w'));
      if (word) {
        wordChecked = true;
        await word.click();
        await p.waitForTimeout(400);
        const drawer = await p.$('[role="dialog"]:not(.cs-box)');
        if (!drawer) problems.push(`${cs.id}: a tapped word opened no drawer`);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(200);
      }
      await p.click('.cs-body').catch(() => undefined);
    }
  }
  const canvasNow = await p.evaluate(() => JSON.stringify(document.querySelector('.world-canvas')?.getBoundingClientRect()));
  if (canvasAt !== canvasNow) problems.push(`${cs.id}: the canvas moved (${canvasAt} → ${canvasNow})`);
  // hold ⏭ to skip what is left
  const skip = await p.$('.cs-skip');
  if (skip) {
    const r = await skip.boundingBox();
    await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(800);
    await p.mouse.up();
    await p.waitForTimeout(800);
    if (await p.$('.cs-layer')) problems.push(`${cs.id}: holding ⏭ did not end it`);
  }
  // the strip: the frames side by side, each at a third of its size
  if (frames.length) {
    const png = await p.evaluate(async (frames) => {
      const imgs = await Promise.all(frames.map((f) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = `data:image/png;base64,${f}`; })));
      const w = Math.round(imgs[0].width / 3);
      const h = Math.round(imgs[0].height / 3);
      const c = document.createElement('canvas');
      c.width = w * imgs.length + 4 * (imgs.length - 1);
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#22202e';
      g.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, i) => g.drawImage(im, i * (w + 4), 0, w, h));
      return c.toDataURL('image/png').slice(22);
    }, frames);
    writeFileSync(`${OUT}/${cs.id}.png`, Buffer.from(png, 'base64'));
  } else problems.push(`${cs.id}: no frames`);
  console.log(`${cs.id}: ${frames.length} frames, ${Math.round((Date.now() - t0) / 1000)} s`);
  await ctx.close();
}
await b.close();
console.log(problems.length ? problems.join('\n') : 'no problems');
