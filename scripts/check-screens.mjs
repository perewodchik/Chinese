#!/usr/bin/env node
/**
 * Every screen asked for, at every width the learner's devices have, light and
 * dark: a screenshot of each, and a list of what a person would see is wrong
 * before they see it — the page wider than the screen, a control past its
 * edge, a button whose label went onto two lines, a row of buttons that wrapped,
 * text cut off, more than one primary button.
 *
 *   node scripts/check-screens.mjs [--base http://localhost:5199] [--browser chromium|webkit]
 *        [--widths 375,390,430,768,1024,1194] [--out .data/shots] [--wait 1500]
 *        /read /texts/<id> "/speaking/say/<id>?line=5" …
 *
 * A path can carry a step to run before the picture, after a `#`:
 *   "/speaking/say/<id>?line=5#click=Tries"      taps the first button named Tries
 *   "/read/<id>?tab=words#click=.shelf-word .level-step"   taps the first match of a selector
 *
 * Run it against a dev server on a copy of the database (HANZI_DB=.data/<copy>.db,
 * HANZI_DEV_USER=admin). WebKit is the learner's browser: on the Mac run it with
 * `--browser webkit` as well. It finds; it does not judge — open the pictures.
 * Exits 1 when it found a fault (lines with ~ are only to look at), so it can sit
 * in front of a commit.
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
const base = opt('base', 'http://localhost:5199');
const browserName = opt('browser', 'chromium');
const widths = opt('widths', '375,390,430,768,1024,1194').split(',').map(Number);
const out = opt('out', '.data/shots');
const wait = Number(opt('wait', '1500'));
const pages = args.length ? args : ['/'];

// Playwright from the project, else the one installed globally (the cloud container has that).
let pw;
try {
  pw = createRequire(path.resolve('package.json'))('playwright');
} catch {
  const { execSync } = await import('node:child_process');
  pw = createRequire(path.join(execSync('npm root -g').toString().trim(), '/'))('playwright');
}
const launcher = pw[browserName];
if (!launcher) throw new Error(`No browser called ${browserName}`);
const browser = await launcher.launch();
mkdirSync(out, { recursive: true });

/** Runs in the page: what is wrong with it, in words. */
function audit() {
  const found = [];
  const vw = window.innerWidth;
  const name = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  const seen = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Inside something that scrolls sideways on purpose (a strip of cards), past the edge is fine.
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };

  const STACKS = /^(block|flex|grid|table|list-item|flow-root)$/;
  // Laid out on two lines by design: a word with its pinyin over it. Mark others with data-wraps.
  const STACKED = '.rd-zh .w, .ph-tile, [data-wraps]';
  const isLabel = (el) => {
    const own = getComputedStyle(el);
    if (/column/.test(own.flexDirection) && /flex/.test(own.display)) return false;
    if (/grid/.test(own.display) && el.children.length > 1) return false;
    for (const d of el.querySelectorAll('*')) if (STACKS.test(getComputedStyle(d).display)) return false;
    return true;
  };

  if (document.documentElement.scrollWidth > vw + 1) found.push(`the page is ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`);

  for (const el of document.querySelectorAll('button, a, input, select, [role="button"], [role="radio"], .chip, .btn')) {
    if (!seen(el) || inScroller(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) found.push(`past the edge: ${name(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
    // A label on two lines: its text sits on more than one line box. Only for a label,
    // a run of words: a button laid out as rows or stacked (a list row, an icon over a
    // word, pinyin over a character) is meant to have more than one line.
    if (el.matches('button, .btn, .chip, [role="button"], [role="radio"]') && el.innerText.trim() && isLabel(el) && !el.closest(STACKED)) {
      // Line by line from the visible text alone: room kept for hidden pinyin is not a second line.
      const tops = new Set();
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (!t.textContent.trim() || getComputedStyle(t.parentElement).visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        for (const x of range.getClientRects()) if (x.width > 1) tops.add(Math.round(x.bottom / 6));
      }
      if (tops.size > 1 && !el.closest('[data-wraps]')) found.push(`label on two lines: ${name(el)}`);
    }
  }

  // A row of controls that wrapped: two buttons meant side by side, one under the other.
  // A row that may wrap on purpose (a list of tags) says so with data-wraps.
  for (const row of document.querySelectorAll('body *')) {
    const st = getComputedStyle(row);
    if (!/flex/.test(st.display) || st.flexWrap !== 'wrap' || /column/.test(st.flexDirection) || !seen(row) || row.closest('[data-wraps]')) continue;
    const kids = [...row.children].filter((k) => seen(k) && k.matches('button, a, .btn, .chip, select, input'));
    if (kids.length < 2) continue;
    const rows = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top / 8)));
    if (rows.size > 1) found.push(`controls on ${rows.size} rows: ${name(row)}`);
  }

  // Text cut off: a box that hides what it holds, holding more than it shows.
  for (const el of document.querySelectorAll('body *')) {
    // A label for a screen reader only is clipped on purpose.
    if (!seen(el) || !el.childNodes.length || el.closest('.sr-only')) continue;
    const s = getComputedStyle(el);
    const hides = s.overflowX === 'hidden' || s.overflowX === 'clip' || s.textOverflow === 'ellipsis';
    if (!hides || !(el.innerText || '').trim()) continue;
    if (el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis' && !el.closest('[data-clips]')) found.push(`cut off: ${name(el)}`);
    else if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) found.push(`~ ellipsised, check it still says enough: ${name(el)}`);
  }

  const primaries = [...document.querySelectorAll('.btn.primary')].filter(seen);
  if (primaries.length > 1) found.push(`${primaries.length} primary buttons: ${primaries.map(name).join(', ')}`);
  return [...new Set(found)];
}

let problems = 0;
for (const raw of pages) {
  const [where, step] = raw.split('#');
  for (const width of widths) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 1024 }, colorScheme: scheme });
      await page.goto(base + where, { waitUntil: 'networkidle' }).catch(() => page.goto(base + where));
      await page.waitForTimeout(wait);
      if (step?.startsWith('click=')) {
        const what = step.slice(6);
        const target = /^[.#[]/.test(what) ? page.locator(what) : page.getByRole('button', { name: what });
        await target.first().click().catch((e) => console.log(`  could not tap ${what}: ${e.message.split('\n')[0]}`));
        await page.waitForTimeout(600);
      }
      const file = path.join(out, `${where.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'home'}${step ? `-${step.replace(/[^\w]+/g, '_')}` : ''}-${width}-${scheme}-${browserName}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const found = await page.evaluate(audit);
      // A line starting with ~ is to look at, not a fault.
      const faults = found.filter((f) => !f.startsWith('~'));
      problems += faults.length;
      console.log(`${faults.length ? '✗' : found.length ? '~' : '✓'} ${where}${step ? ` (${step})` : ''} ${width} ${scheme}  → ${file}`);
      for (const f of found) console.log(`    ${f}`);
      await page.close();
    }
  }
}
await browser.close();
console.log(problems ? `\n${problems} things to look at. Open the pictures as well: this finds overflow, not ugliness.` : '\nNothing found by the audit. Open the pictures anyway.');
process.exit(problems ? 1 : 0);
