// The dialogue box probe: talk-probe.js at 375 / 768 / 1024 in light and dark,
// in Chromium or WebKit (Safari's engine), with a screenshot of the talk and
// of the phone at each size in <out>/<width>-<theme>-<step>.jpg.
//
// Needs a dev server on a test database with a save whose character is made,
// and Playwright (`npm i --no-save playwright`, `npx playwright install webkit`):
//
//   node scripts/world/talk-probe.mjs [chromium|webkit] [base] [out]

import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, webkit } from 'playwright';

const [engine = 'webkit', BASE = 'http://127.0.0.1:5180', OUT = 'docs/world-game/review/d'] = process.argv.slice(2);
const probe = readFileSync(new URL('./talk-probe.js', import.meta.url), 'utf8');
mkdirSync(OUT, { recursive: true });
const b = await (engine === 'webkit' ? webkit : chromium).launch();
let bad = 0;
for (const [w, h] of [[375, 812], [768, 1024], [1024, 768]]) {
  for (const t of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: t, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('pageerror:', e.message));
    await p.goto(`${BASE}/play/world`);
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), t);
    await p.waitForSelector('.wc-rabbit', { timeout: 30000 });
    let r = 'WAIT';
    for (let i = 0; i < 60 && r === 'WAIT'; i++) {
      await p.waitForTimeout(500);
      r = await p.evaluate(probe);
      if (i === 14) await p.screenshot({ path: `${OUT}/${w}-${t}-talk.jpg`, quality: 70 });
    }
    await p.screenshot({ path: `${OUT}/${w}-${t}-phone.jpg`, quality: 70 });
    const out = JSON.parse(r);
    bad += out.problems.length;
    console.log(`${w}-${t}`, JSON.stringify({ problems: out.problems, want: out.want, again: out.again, paying: out.paying }));
    await ctx.close();
  }
}
await b.close();
console.log(bad ? `${bad} problems` : 'no problems');
