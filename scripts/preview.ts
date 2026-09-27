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
const { charId, wordId } = await import('../src/domain/ids.ts');
const { defaultSheet, printSheet } = await import('../src/domain/sheet.ts');
const { DEFAULT_SCOPE } = await import('../src/domain/collection.ts');
const { loadRadicals } = await import('../src/data/radicals.ts');
const { renderRadicals } = await import('../src/pdf/radicals/render.ts');
const { RADICAL_TEMPLATE } = await import('../src/domain/radicals/sheet.ts');

type Collection = import('../src/domain/collection.ts').Collection;
type SheetOptions = import('../src/domain/sheet.ts').SheetOptions;
type SheetChoice = import('../src/domain/sheet.ts').SheetChoice;

const lib = await loadLibrary();

function collection(name: string, items: string[], sheet: Partial<SheetChoice> = {}): Collection {
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


// Words of two and three characters, mixed in with characters: the page has
// to give every one of them the same rows.
const mixed = [
  charId('好'),
  wordId('朋友'),
  charId('我'),
  wordId('出租车'),
  wordId('喜欢'),
  charId('慢'),
  wordId('早上'),
  wordId('对不起'),
];

const jobs: Array<[string, Collection]> = [
  ['chars-study', collection('Study — characters', sample)],
  ['mixed-study', collection('Study — words and characters', mixed)],
  ['mixed-drill', collection('Drill — words and characters', mixed, { layout: 'drill', palette: 'pine' })],
  ['chars-drill', collection('Drill — characters', sample, { layout: 'drill', palette: 'plum' })],
];

for (const [file, c] of jobs) {
  const { bytes, pages } = await renderCollection(lib, c, c.items, {
    footerNote: 'Kirill',
  });
  fs.writeFileSync(path.join(out, `${file}.pdf`), bytes);
  console.log(`${file}.pdf`.padEnd(24), `${pages} pages`);
}

// The radical reference sheet: heart and water are written three ways, mouth
// one, and all of them should come out as the same block.
const rlib = await loadRadicals();
const radicals = [61, 85, 30, 9, 75, 64].map((n) => rlib.radicals.find((r) => r.n === n)!);

for (const [file, palette] of [
  ['radicals', 'cinnabar'],
  ['radicals-indigo', 'indigo'],
] as const) {
  const { bytes, pages } = await renderRadicals(
    rlib,
    radicals,
    { ...RADICAL_TEMPLATE, palette },
    { title: 'Radicals', footerNote: 'Kirill' },
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

const readingSheet = printSheet('drill', 'indigo');
const readingOpts = { footerNote: 'Kirill', practice: true };

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
const recallItems = [...lib.characters.slice(0, 20).map((c) => c.c).map(charId), ...mixed];

for (const [file, rows, answers, sheet] of [
  ['recall-1row', 1, 'foot', {}],
  ['recall-2rows', 2, 'foot', { palette: 'graphite' }],
  ['recall-key-at-end', 1, 'end', { palette: 'pine' }],
] as Array<[string, number, 'foot' | 'end', Partial<SheetOptions>]>) {
  const { bytes, pages } = await renderRecall(
    lib,
    recallItems,
    { ...printSheet('study', 'cinnabar'), ...sheet },
    { title: 'From memory — HSK 1', footerNote: 'Kirill', rows, answers },
  );
  fs.writeFileSync(path.join(out, `${file}.pdf`), bytes);
  console.log(`${file}.pdf`.padEnd(24), `${pages} pages`);
}
