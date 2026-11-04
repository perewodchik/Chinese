#!/usr/bin/env node
/**
 * Does a reload keep the screen? Each scenario goes somewhere, does something
 * (opens a part of a text, types a search), then reloads and says what came
 * back different: the address, the scroll, what is pressed, what is open.
 *
 *   HANZI_DB=.data/probe.db HANZI_DEV_USER=admin PORT=5199 npm run dev
 *   node scripts/reload-probe.mjs [--base http://localhost:5199] [--browser webkit] [scenario …]
 *
 * Never against the real database: on an empty account it writes two sample
 * texts on a shelf called First shelf (ids t1, t2, s1) and turns the new Speak
 * on. Scoring is answered as if SpeechSuper keys were saved, so Speak opens.
 * "kept" is the answer wanted; "RESET" lists what a reload lost.
 */
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
const B = opt('base', 'http://localhost:5199');
const browserName = opt('browser', 'chromium');
const width = Number(opt('width', '1024'));

let pw;
try {
  pw = createRequire(path.resolve('package.json'))('playwright');
} catch {
  const { execSync } = await import('node:child_process');
  pw = createRequire(path.join(execSync('npm root -g').toString().trim(), '/'))('playwright');
}

/* ------------------------------------------------------------ sample work, on an empty account */

async function seed(request) {
  await request.get(`${B}/api/auth/session`);
  const now = await (await request.get(`${B}/api/workspace`)).json();
  if (now.document) return;
  const at = Date.now();
  const L = [
    ['我叫小明。', 'Wǒ jiào Xiǎomíng.', 'My name is Xiaoming.'],
    ['我喜欢水果。', 'Wǒ xǐhuan shuǐguǒ.', 'I like fruit.'],
    ['我每天吃苹果。', 'Wǒ měitiān chī píngguǒ.', 'I eat apples every day.'],
    ['我的妈妈喜欢喝茶。', 'Wǒ de māma xǐhuan hē chá.', 'My mum likes drinking tea.'],
    ['我们一起去商店。', 'Wǒmen yìqǐ qù shāngdiàn.', 'We go to the shop together.'],
  ];
  const text = (i, title, titleZh, lines) => ({
    id: `t${i}`, setId: 's1', title, titleZh, topic: 'daily', length: 'short', level: 'hsk1', genre: 'story',
    createdAt: at - i * 1000, model: 'Claude', lines: lines.map(([zh, py, en]) => ({ zh, py, en })),
    vocab: [{ w: '喜欢', py: 'xǐhuan', d: 'to like', new: true }, { w: '水果', py: 'shuǐguǒ', d: 'fruit', new: true }],
    questions: [{ zh: '他喜欢什么？', py: 'Tā xǐhuan shénme?', en: 'What does he like?' }],
    grammar: [{ point: '喜欢 + noun', explain: 'to like something', example: '我喜欢苹果。' }],
    note: 'Watch the tones of 喜欢.', teach: ['喜', '欢'], glosses: {}, basis: [],
  });
  const document = {
    version: 11, collections: [], recall: {}, sheets: [], learned: [],
    texts: [text(1, 'Xiaoming', '小明', L), text(2, 'At the shop', '在商店', [...L].reverse())],
    sets: [{ id: 's1', name: 'First shelf', createdAt: at, order: ['t1', 't2'] }],
    settings: { speakV2: true },
  };
  const put = await request.put(`${B}/api/workspace`, { data: { baseRevision: 0, document }, headers: { 'sec-fetch-site': 'same-origin' } });
  if (!put.ok()) throw new Error(`Could not write the sample work: ${put.status()}`);
}

/* ------------------------------------------------------------ the probe */

const browser = await pw[browserName].launch();
const ctx = await browser.newContext({ viewport: { width, height: 800 } });
await seed(ctx.request);
await ctx.route('**/api/eval', (r) =>
  r.request().method() === 'GET'
    ? r.fulfill({ json: { key: { set: true, hint: '…abcd', provider: 'speechsuper' }, strictness: 'common' } })
    : r.continue(),
);
const p = await ctx.newPage();

const snap = () =>
  p.evaluate(() => {
    const main = document.querySelector('.main');
    const seen = (el) => el && el.getClientRects().length;
    const pressed = '[aria-current="true"],[aria-current="page"],[aria-pressed="true"],[aria-selected="true"]';
    return {
      url: location.pathname + location.search + location.hash,
      // A few pixels either way is the page settling, not a lost place.
      scroll: Math.round((main?.scrollTop ?? scrollY) / 20) * 20,
      pressed: [...document.querySelectorAll(pressed)].filter(seen).map((e) => e.textContent.trim().slice(0, 20)).join(' / '),
      open: [...document.querySelectorAll('[role=dialog],dialog[open],.drawer')].filter(seen).length,
      heads: [...document.querySelectorAll('h1,h2')].filter(seen).map((e) => e.textContent.trim().slice(0, 25)).slice(0, 6).join(' / '),
      typed: [...document.querySelectorAll('input[type=search],input[type=text]')].filter(seen).map((e) => e.value).filter(Boolean).join(' / '),
    };
  });
const open = async (url) => {
  await p.goto(B + url);
  await p.waitForTimeout(2000);
};
const tap = async (locator) => {
  await locator.first().scrollIntoViewIfNeeded();
  await locator.first().click({ timeout: 5000 });
  await p.waitForTimeout(900);
};

const scenarios = {
  textWords: async () => (await open('/texts/s1'), tap(p.getByRole('button', { name: /Words/ }))),
  textQuestions: async () => (await open('/texts/s1'), tap(p.getByRole('button', { name: /Questions/ }))),
  copyOut: async () => (await open('/texts/s1'), tap(p.getByRole('button', { name: /Start copying/ }))),
  dictation: async () => (await open('/texts/s1'), tap(p.locator('.rd-more-row', { hasText: 'Dictation' }))),
  secondText: async () => open('/texts/s1?page=2'),
  speakLine: async () => open('/speaking/say/t1?line=3'),
  librarySearch: async () => (await open('/library'), await p.locator('input[type=search]').first().fill('水'), p.waitForTimeout(900)),
  readSearch: async () => (await open('/read'), await p.locator('input[type=search]').first().fill('商店'), p.waitForTimeout(900)),
  shelfWords: async () => (await open('/read/s1'), tap(p.getByRole('tab', { name: /Words/ }))),
};

let lost = 0;
for (const [name, act] of Object.entries(scenarios)) {
  if (args.length && !args.includes(name)) continue;
  try {
    await act();
    const before = await snap();
    await p.reload();
    await p.waitForTimeout(2500);
    const after = await snap();
    // Under something open over the page, the page's own scroll is not seen.
    const diff = Object.keys(before).filter((k) => before[k] !== after[k] && !(k === 'scroll' && before.open && after.open));
    if (diff.length) lost++;
    console.log(`${diff.length ? 'RESET' : 'kept '}  ${name}  ${before.url}`);
    for (const k of diff) console.log(`         ${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
  } catch (err) {
    console.log(`skip   ${name}  (${err.message.split('\n')[0]})`);
  }
}
await browser.close();
process.exit(lost ? 1 : 0);
