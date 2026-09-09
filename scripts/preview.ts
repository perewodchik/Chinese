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
const { renderTemplate } = await import('../src/pdf/render.ts');
const { DEFAULT_CHAR_OPTIONS, DEFAULT_RADICAL_OPTIONS, charId, radId } = await import(
  '../src/store/types.ts'
);
type Template = import('../src/store/types.ts').Template;

const lib = await loadLibrary();

function template(over: Partial<Template>): Template {
  return {
    id: 'preview',
    name: 'Preview',
    kind: 'char',
    items: [],
    options: DEFAULT_CHAR_OPTIONS,
    createdAt: 0,
    updatedAt: 0,
    printedAt: null,
    printCount: 0,
    ...over,
  };
}

const out = path.join(ROOT, '.cache', 'preview');
fs.mkdirSync(out, { recursive: true });

// 1. Characters, teaching order, everything switched on.
const firstChars = lib.characters.slice(0, 6).map((c) => charId(c.c));
const complex = ['影', '慢', '歌', '错'].map(charId);
const a = await renderTemplate(
  lib,
  template({ name: 'HSK 3.0 — Part 1', items: [...firstChars, ...complex] }),
  { footerNote: 'Kirill' },
);
fs.writeFileSync(path.join(out, 'characters.pdf'), a.bytes);
console.log(`characters.pdf  ${a.pages} pages`);

// 2. Radicals, five to a page.
const topRadicals = [...lib.radicals]
  .sort((x, y) => x.rank - y.rank)
  .slice(0, 10)
  .map((r) => radId(r.n));
const b = await renderTemplate(
  lib,
  template({
    name: 'Radicals — Part 1',
    kind: 'radical',
    items: topRadicals,
    options: DEFAULT_RADICAL_OPTIONS,
  }),
);
fs.writeFileSync(path.join(out, 'radicals.pdf'), b.bytes);
console.log(`radicals.pdf    ${b.pages} pages`);

// 3. A minimal sheet: no extras, maximum writing room.
const c = await renderTemplate(
  lib,
  template({
    name: 'HSK 3.0 — Part 1 (plain)',
    items: firstChars.slice(0, 4),
    options: {
      ...DEFAULT_CHAR_OPTIONS,
      memoryAids: false,
      words: false,
      sentence: false,
      confusables: false,
      practiceRows: 8,
    },
  }),
);
fs.writeFileSync(path.join(out, 'plain.pdf'), c.bytes);
console.log(`plain.pdf       ${c.pages} pages`);
