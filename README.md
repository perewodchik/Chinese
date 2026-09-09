# Hanzi Workshop

Build Chinese handwriting worksheets as PDFs, and keep track of what you have
already learned.

- **3000 characters** — the whole official HSK 3.0 syllabus, bands 1 to 9,
  ordered band by band so that a character never turns up before the parts it
  is made of.
- **214 radicals** — the full Kangxi set, ranked by how often you will actually
  meet them, with the simplified variants and the colloquial names (三点水,
  提手旁, …).
- **Ready-made sets** — every HSK band, the top 50 / top 100 / all radicals, and
  fifteen topics (food, travel, the body, weather, money …) one click away.
- **Real PDFs**, A4, vector, in a 楷体 regular-script hand. One to six
  characters, or three to eight radicals, per page.
- **Nothing gets queued twice by accident.** Every character shows which
  templates it is already in, and whether you have marked it learned.

## Running it

Double-click **`start.cmd`**, or:

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

> Node.js is not installed system-wide on this machine, so a copy lives in
> `.cache/node-v22.20.0-win-x64/` and `start.cmd` puts it on the PATH for you.
> If you install Node properly later (`winget install OpenJS.NodeJS.LTS`, needs
> an admin prompt), plain `npm run dev` will work from any terminal and the
> `.cache` copy can be deleted.

## How you use it

1. **Library** — filter to an HSK band (or all 3000) and browse in teaching
   order, or switch to radicals and browse by how common they are. Filter by
   Everything, Learned or Not learned. Click to select, shift-click for a
   range, the `i` button for everything known about one character — including
   which templates it is in, as links straight to them.
2. A tray appears at the bottom: **add the selection to a template**, new or
   existing. Anything already in another template is skipped, and the toast
   says so.
3. **Templates** — or skip all that and take a ready-made set: an HSK band, a
   radical run, or a topic. **Add** asks how big each template should be, for
   that set only, and shows what you will get before you commit. The parts stay
   grouped as one collection you can collapse or remove in one go, rather than
   fifteen loose cards.
4. In the editor, **Layout** and **Content** control the sheet and the whole
   PDF re-renders as you change things. **Items** is the running order: drag a
   row by the grip at its left to move it, tick characters off as you learn
   them, or select several and mark them in one go.
5. **Download PDF.** It lands in your worksheets folder (Settings → choose one)
   or downloads normally.

## What is on a sheet

A character block is a heading, then two columns, then the squares.

```
┌────┐  hǎo   good, excellent, fine                        100  HSK 1
│ 好 │  ────────────────────────────────────────────────────────
└────┘  RADICAL 女 woman   STROKES 6   FREQUENCY #82

 STROKE ORDER                 │  COMMON WORDS
 [ ][ ][ ][ ][ ][ ]           │    hǎo chī
                              │    好吃   tasty; delicious
 BUILT FROM   side by side    │    hǎo kàn
   女  nǚ  woman              │    好看   good-looking
 + 子  zǐ  son                │
                              │  IN A SENTENCE
 WHERE IT COMES FROM          │    wǒ hǎo pàng ó
 ▏A woman 女 with a son 子     │    我好胖哦。
                              │    I'm so fat.
                              │
                              │  DON'T CONFUSE WITH
                              │    如 rú   她 tā   妈 mā
├──────────────────────────────┴───────────────────────────────┤
│  米字格 squares: a few solid to trace, a few faint, the rest  │
└──────────────────────────────────────────────────────────────┘
```

The left column is the character itself — how it is written, what it is built
from, where it came from. The right column is the character in use, with the
reading set above the hanzi the way a textbook does it. Example sentences carry
pinyin too, generated at build time by matching the longest word CC-CEDICT
knows at each position.

Every block is a toggle in **Content**. Whatever you turn off becomes more
writing room — the page works out how many squares fit and picks a column count
that fills the paper.

Three controls decide how much fits:

- **Density.** *Comfortable* and *Compact* use the same two-column arrangement;
  compact just sets it smaller. Three characters a page with everything on, or
  four with small squares.
- **Square size**, about 15, 13 or 11 mm.
- **Per page**, one to six.

If a block still will not fit, the editor says so by name rather than dropping
it silently. The sentence goes first, then the lookalikes, then the origin note,
then the components. Common words and the stroke order strip are the last to go.

**Colour strokes by component** tints each stroke by which part of the
character it belongs to, in the big glyph and the stroke-order strip. Practice
squares stay grey — they are for tracing, and shouldn't need a colour printer.

## Rebuilding the data

The JSON in `public/data/` and the fonts in `public/fonts/` are generated. To
rebuild them:

```bash
npm run data
```

That runs `scripts/build_data.py` (needs Python) and then
`scripts/build_fonts.py` (needs `fonttools` and `brotli`:
`pip install fonttools brotli`). Raw sources are cached in `.cache/` and
re-downloaded if missing.

`scripts/preview.ts` renders sample worksheets straight to
`.cache/preview/*.pdf` without opening the browser:

```bash
npx tsx scripts/preview.ts
```

## Where everything comes from

| Data | Source | Licence |
| --- | --- | --- |
| HSK 3.0 character and word lists (all nine bands) | [elkmovie/hsk30](https://github.com/elkmovie/hsk30), OCR'd from the 2021 standard by Pleco | MIT |
| Stroke outlines and decompositions | [Make Me a Hanzi](https://www.skishore.me/makemeahanzi/) / [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from Arphic's Kai typefaces | Arphic Public License |
| Definitions and pinyin | [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cedict) | CC BY-SA 4.0 |
| Character frequency, Kangxi radical numbers | [hanziDB](https://github.com/ruddfawcett/hanziDB.csv), after Jun Da | MIT |
| Word frequency | [jieba](https://github.com/fxsjy/jieba)'s dictionary | MIT |
| Example sentences | [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR |
| Chinese text face | [LXGW WenKai 霞鹜文楷](https://github.com/lxgw/LxgwWenKai) | SIL OFL 1.1 |
| Latin text face | [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans) | SIL OFL 1.1 |

The colloquial radical names (三点水, 提手旁 …), the "don't confuse these" notes
and the fifteen topic sets are hand-written in `scripts/build_data.py`; no
dataset carries them. Topic sets are filtered against the syllabus at build
time, so a typo drops a character rather than producing a template that will
not render.

Two things worth knowing if you touch the rendering code. pdf-lib's
`embedFont(..., { subset: true })` silently wrecks these fonts — the text layer
survives but almost every CJK glyph vanishes — so the faces are cut to size by
`build_fonts.py` instead, in two tiers: sheets that stay inside HSK 1–3 embed a
face half the size. And hanzi-writer's outlines use a y-up coordinate system,
so they are mirrored before drawing or every character prints upside down.

## Your data

Templates and progress live in this browser's `localStorage`. **Settings →
Export** writes a JSON backup — worth doing before you clear browser data or
move machines. Worksheet PDFs are written straight to a folder you nominate,
using the File System Access API (Chrome and Edge); elsewhere they download
normally.

## Layout

```
public/data/      generated JSON: characters, radicals, topics, stroke outlines
                  (outlines are split: HSK 1-3 up front, the rest on demand)
public/fonts/     subsetted WenKai + Noto Sans, for the page and the PDFs
scripts/          data and font builds, plus a headless PDF preview
src/pdf/          the worksheet renderer — page geometry, bands, grids
src/store/        templates, progress, folder access
src/components/   library browser, template editor, character detail
printable/        the reference PDFs this design was drawn from
```
