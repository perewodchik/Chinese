# Library: one place for every set

A concept, 2026-10-21, with a working prototype on the `library-concept`
branch (`src/features/library/LibraryHome.tsx`, `SetPage.tsx`, `sets.ts`,
`home.css`). Not on `main` until it is agreed.

## What was wrong

- The library opened on 248 boxed tiles, all tinted green, under four rows of
  controls on a phone (kind, search and order, band strip, count and Select,
  chips that ran off the edge). A grid of identical boxes giving everything
  the same weight.
- The same thing lived in three places: a band in the library's band strip,
  the same band as a ready-made set under Lists to print, and the list made
  from it beside them.
- Lists to print and Families sat in More, away from what they are about.

## The idea

The library is a shelf of **sets**: some characters and some words to look
through, learn from and print. A set is a band of the syllabus, a topic, or a
list you made. Every set has the same page.

**/library**
- Search across characters, words and set names (`好, hao or good`).
- A sheet printed and not yet marked, at the top while it waits.
- Your lists, with their characters as a strip and how much is learned.
- HSK 1 to 7–9, a row each: the number in a 田 square, how many characters are
  learned, a jade line; your level marked.
- Topics (four, then "All 16").
- Look things up: Radicals, Families, Blank paper.
- Two columns from 1000px wide.

**/library/:set**
- Back to Library; the name, a line about it, what is learned of it.
- One primary action, Print; for a band, "Sort what you know" beside it.
- 字 / 词 switch with counts, and two filters ("To learn", "Learned"; tap
  again to let go), no "All" chip.
- Characters as squares from the exercise book: the 田 guide, the character
  in WenKai, pinyin and the first sense under it. Learned is a jade frame and
  a dot, not a green fill. Four across a phone, six to eight on an iPad.
- Words as rows (one column on a phone, two on an iPad), with a dot for
  known and "Learning" in blue ink.
- Order and editing a list behind ⋯.

**Printing** a ready-made set makes it one of your lists (the sheet design is
kept there) and the set and the list stay one row, not two.

## Fewer places

- More loses "Lists to print"; /collections and /families light the Library
  tab.
- The library's Characters / Words / Radicals switch, band strip and five
  status chips go; a set's page has two filters.

## Left to do after agreement

1. Select mode and its tray on a set's page (mark learned, add to a list).
2. Radicals as a set page (`/library/radicals`), replacing `?kind=radicals`;
   radical search in the library's search.
3. Blank paper on a page of its own (`/library/paper`); the list editor
   (`/collections/:id`) reached only from a list's Print; /collections
   redirected to /library.
4. A topic character's gloss from its word (面 is "noodles" in Food, not
   "face"), as `leadWithUse` does for bands.
5. "Made from texts" lists: offered once to move onto their shelves, then gone.
6. Old addresses (`?kind=words`, `?band=`) redirected to the set pages; the
   old LibraryPage, BandSeg and WordsShelf removed.
7. README, router table, guidelines; checks at 375/768/1024, light and dark,
   and in WebKit.
