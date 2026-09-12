/**
 * Renders sample worksheets straight to PDF from the command line, so the page
 * layout can be checked without driving the browser.
 *
 *   npx tsx scripts/preview.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The renderer fetches its data and fonts by relative URL; in Node we serve
// those out of public/ instead.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!/^https?:/.test(url)) {
    const file = path.join(ROOT, 'public', url);
    const buf = fs.readFileSync(file);
    return new Response(new Uint8Array(buf), { status: 200 });
  }
  return realFetch(input, init);
}) as typeof fetch;

const { loadLibrary } = await import('../src/data/load.ts');
const { renderCollection, renderReading, renderRecall, renderTextSet } = await import(
  '../src/pdf/render.ts',
);
const { charId } = await import('../src/domain/ids.ts');
const { defaultSheet } = await import('../src/domain/sheet.ts');
const { DEFAULT_SCOPE } = await import('../src/domain/collection.ts');
const { loadRadicals } = await import('../src/data/radicals.ts');
const { renderRadicals } = await import('../src/pdf/radicals/render.ts');
const { DEFAULT_RADICAL_SHEET } = await import('../src/domain/radicals/sheet.ts');

type Collection = import('../src/domain/collection.ts').Collection;
type SheetOptions = import('../src/domain/sheet.ts').SheetOptions;

const lib = await loadLibrary();

function collection(name: string, items: string[], sheet: Partial<SheetOptions> = {}): Collection {
  return {
    id: 'preview',
    name,
    items,
    sheet: { ...defaultSheet(), ...sheet },
    scope: { ...DEFAULT_SCOPE },
    createdAt: 0,
    updatedAt: 0,
  };
}

const out = path.join(ROOT, '.cache', 'preview');
fs.mkdirSync(out, { recursive: true });

// A mix of easy and complex characters: 影 and 慢 are the ones that overflow
// a block if the measuring is wrong.
const sample = [
  ...lib.characters.slice(0, 4).map((c) => c.c),
  '影',
  '慢',
  '歌',
  '错',
].map(charId);


const jobs: Array<[string, Collection]> = [
  ['chars-2-classic', collection('Two a page — Classic', sample)],
  [
    'chars-3-workbook',
    collection('Three a page — Workbook', sample, {
      perPage: 3,
      palette: 'indigo',
      style: 'workbook',
    }),
  ],
  [
    'chars-4-card',
    collection('Four a page — Card', sample, {
      perPage: 4,
      palette: 'pine',
      style: 'card',
    }),
  ],
  [
    'chars-2-card',
    collection('Two a page — Card', sample, {
      palette: 'plum',
      style: 'card',
    }),
  ],
  [
    'chars-2-quiet',
    collection('Two a page — Quiet', sample, {
      palette: 'graphite',
      style: 'quiet',
    }),
  ],
];

for (const [file, c] of jobs) {
  const { bytes, pages } = await renderCollection(lib, c, c.items, {
    footerNote: 'Kirill',
  });
  fs.writeFileSync(path.join(out, `${file}.pdf`), bytes);
  console.log(`${file}.pdf`.padEnd(24), `${pages} pages`);
}

// Radical sheets: the same eight radicals at every size, because what changes
// with the size is how many of a radical's forms get a row of their own.
const rlib = await loadRadicals();
const radicals = rlib.radicals.slice(0, 8);

for (const [file, sheet] of [
  ['radicals-3', {}],
  ['radicals-2-workbook', { perPage: 2, palette: 'indigo', style: 'workbook' }],
  ['radicals-4-card', { perPage: 4, palette: 'pine', style: 'card' }],
  ['radicals-6-quiet', { perPage: 6, palette: 'graphite', style: 'quiet' }],
] as Array<[string, Partial<SheetOptions>]>) {
  const { bytes, pages } = await renderRadicals(
    rlib,
    radicals,
    { ...DEFAULT_RADICAL_SHEET, ...sheet },
    { title: 'Radicals — the first eight', footerNote: 'Kirill' },
  );
  fs.writeFileSync(path.join(out, `${file}.pdf`), bytes);
  console.log(`${file}.pdf`.padEnd(24), `${pages} pages`);
}

// A reading sheet, from a passage shaped like one Claude would return.
type GeneratedText = import('../src/domain/text.ts').GeneratedText;

const passage: GeneratedText = {
  id: 'preview',
  title: 'A day at home',
  titleZh: '在家的一天',
  topic: 'A day at home',
  length: 'medium',
  level: 'edge',
  genre: 'diary',
  createdAt: 0,
  model: 'preview',
  read: false,
  // Two characters the passage sets out to teach: they get the panel at the
  // top, an underline where they fall, and practice squares at the back.
  teach: ['雨', '汉'],
  glosses: {},
  grammar: [
    {
      point: '了 for something that has happened',
      zh: '下午下雨了。',
      en: 'It started raining in the afternoon.',
    },
  ],
  note: 'Watch 了 in the last two sentences: it closes an action, it is not a past tense.',
  basis: lib.characters.slice(0, 300).map((c) => c.c),
  lines: [
    { zh: '今天我在家。', py: 'jīn tiān wǒ zài jiā.', en: 'Today I am at home.' },
    {
      zh: '早上我看了一本书。',
      py: 'zǎo shang wǒ kàn le yī běn shū.',
      en: 'In the morning I read a book.',
    },
    {
      zh: '中午我和妈妈一起吃饭。',
      py: 'zhōng wǔ wǒ hé mā ma yī qǐ chī fàn.',
      en: 'At noon I ate with my mother.',
    },
    {
      zh: '下午下雨了，我们没有出去。',
      py: 'xià wǔ xià yǔ le, wǒ men méi yǒu chū qù.',
      en: 'It rained in the afternoon, so we did not go out.',
    },
    {
      zh: '晚上我写了几个汉字。',
      py: 'wǎn shang wǒ xiě le jǐ gè hàn zì.',
      en: 'In the evening I wrote a few characters.',
    },
  ],
  vocab: [
    { w: '早上', py: 'zǎo shang', d: 'morning' },
    { w: '一起', py: 'yī qǐ', d: 'together' },
    { w: '出去', py: 'chū qù', d: 'to go out' },
    { w: '汉字', py: 'hàn zì', d: 'Chinese character', isNew: true },
  ],
  questions: [
    {
      zh: '他今天去哪儿了？',
      py: 'tā jīn tiān qù nǎr le?',
      en: 'Where did he go today?',
    },
    {
      zh: '下午天气怎么样？',
      py: 'xià wǔ tiān qì zěn me yàng?',
      en: 'What was the weather like in the afternoon?',
    },
  ],
};

const readingSheet = {
  ...defaultSheet(),
  palette: 'indigo' as const,
  style: 'classic' as const,
};
const readingOpts = { footerNote: 'Kirill', practice: true, perPage: 3 };

const reading = await renderReading(lib, passage, readingSheet, readingOpts);
fs.writeFileSync(path.join(out, 'reading.pdf'), reading.bytes);
console.log('reading.pdf'.padEnd(24), `${reading.pages} pages`);

// ...and the same passage as part of a set, which adds a contents page and
// gathers every new character onto one run of practice sheets at the back.
const second: GeneratedText = {
  ...passage,
  id: 'preview-2',
  title: 'The letter that came late',
  titleZh: '来晚了的信',
  topic: 'A letter',
  level: 'stretch',
  genre: 'letter',
  teach: ['信', '晚'],
};
const set = await renderTextSet(
  lib,
  'Reading, week one',
  [passage, second],
  readingSheet,
  readingOpts,
);
fs.writeFileSync(path.join(out, 'set.pdf'), set.bytes);
console.log('set.pdf'.padEnd(24), `${set.pages} pages`);

// Recall sheets: the same characters with the answers taken away, which is the
// arrangement that is easiest to get wrong — the key has to clear the last row
// of squares, and the squares have to stay writable at twelve prompts a page.
const recallItems = lib.characters.slice(0, 26).map((c) => c.c).map(charId);

for (const [file, rows, answers, sheet] of [
  ['recall-1row', 1, 'foot', {}],
  ['recall-2rows', 2, 'foot', { palette: 'graphite', style: 'quiet' }],
  ['recall-key-at-end', 1, 'end', { palette: 'pine', style: 'workbook' }],
] as Array<[string, number, 'foot' | 'end', Partial<SheetOptions>]>) {
  const { bytes, pages } = await renderRecall(
    lib,
    recallItems,
    { ...defaultSheet(), ...sheet },
    { title: 'From memory — HSK 1', footerNote: 'Kirill', rows, answers },
  );
  fs.writeFileSync(path.join(out, `${file}.pdf`), bytes);
  console.log(`${file}.pdf`.padEnd(24), `${pages} pages`);
}
