#!/usr/bin/env node
/**
 * The app as a learner who has just made an account sees it: no texts, no
 * keys, no narrator. Signs a new account in, opens every place in the app at
 * the learner's widths, light and dark, takes a picture of each, and says what
 * looks broken: an error on the page, a script error, a screen still loading
 * after five seconds, anything wider than the screen.
 *
 *   HANZI_DB=.data/fresh.db HANZI_DEV_USER= HANZI_REGISTRATION=open PORT=5197 npm run dev
 *   node scripts/fresh-user-probe.mjs [--base http://localhost:5197] [--browser webkit] [--out .data/fresh]
 *        [--no-mic] [--offline]
 *
 * --no-mic refuses the microphone; --offline cuts the network once each page
 * has loaded, then reloads it. Never against the real database. Exits 1 when
 * it found something; open the pictures as well.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return false;
  args.splice(i, 1);
  return true;
};
const B = opt('base', 'http://localhost:5197');
const browserName = opt('browser', 'chromium');
const out = opt('out', '.data/fresh');
const noMic = flag('no-mic');
const offline = flag('offline');

let pw;
try {
  pw = createRequire(path.resolve('package.json'))('playwright');
} catch {
  const { execSync } = await import('node:child_process');
  pw = createRequire(path.join(execSync('npm root -g').toString().trim(), '/'))('playwright');
}

const PLACES = ['/today', '/read', '/cards', '/library', '/library/hsk-1', '/library/radicals', '/speaking', '/speaking/voices', '/speaking/pinyin', '/speaking/say/everyday?line=1', '/videos', '/play', '/account', '/progress', '/settings'];
const WIDTHS = [375, 768, 1024];

mkdirSync(out, { recursive: true });
const browser = await pw[browserName].launch();
const name = `fresh${Date.now().toString(36)}`;
const made = await (await pw.request.newContext()).post(`${B}/api/auth/register`, {
  data: { username: name, password: 'a fresh learner here' },
  headers: { 'sec-fetch-site': 'same-origin' },
});
if (!made.ok()) throw new Error(`Could not make an account (${made.status()}): is sign-up open on this server? ${await made.text()}`);
const cookie = made.headers()['set-cookie']?.split(';')[0];

let faults = 0;
for (const scheme of ['light', 'dark']) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, permissions: noMic ? [] : ['microphone'] });
    const [k, v] = cookie.split('=');
    await ctx.addCookies([{ name: k, value: v, url: B }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`script: ${e.message}`));
    for (const place of PLACES) {
      errors.length = 0;
      await page.goto(B + place);
      await page.waitForTimeout(2500);
      if (offline) {
        await ctx.setOffline(true);
        await page.reload().catch(() => undefined);
        await page.waitForTimeout(1500);
        await ctx.setOffline(false);
      }
      const seen = await page.evaluate(() => ({
        wide: document.documentElement.scrollWidth > window.innerWidth + 1,
        loading: /Loading…/.test(document.body.innerText),
        broke: /Something broke/.test(document.body.innerText),
        alerts: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim()).filter(Boolean),
      }));
      const said = [
        ...errors,
        ...(seen.broke ? ['the error page'] : []),
        ...(seen.wide ? ['wider than the screen'] : []),
        ...(seen.loading ? ['still loading after 2.5 s'] : []),
        ...seen.alerts.map((a) => `alert: ${a.slice(0, 120)}`),
      ];
      const file = path.join(out, `${place.replace(/[^a-z0-9]+/gi, '_') || 'root'}-${width}-${scheme}.png`);
      await page.screenshot({ path: file });
      if (said.length) faults++;
      console.log(`${said.length ? '✗' : '✓'} ${place} ${width} ${scheme}  → ${file}`);
      for (const s of said) console.log(`    ${s}`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log(faults ? `\n${faults} to look at. Open the pictures as well.` : '\nNothing found. Open the pictures anyway.');
process.exit(faults ? 1 : 0);
