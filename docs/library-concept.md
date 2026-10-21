# Library: one place for every set

Agreed and built 2026-10-21 (`src/features/library/LibraryHome.tsx`,
`SetPage.tsx`, `sets.ts`, `RadicalShelf.tsx`, `CharViewer.tsx`). On review the
learner asked for Print and Sort to go under ⋯ and for a full-screen view of
a character with buttons for its stroke order.

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
- No buttons under the title: Print, Sort what you know and the rest are
  under ⋯ (see Built).
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

## Built

- ⋯ on a set's page: Print, Full screen, Sort what you know (bands 1–4), Pick
  some out, Change what is in it (your lists), and the order.
- Picking: a bar says how many are picked; a tray adds them to a list and
  marks them learned (or not learned, when all of them already are).
- Full screen (`?view=好`, from ⋯ or the drawer's corner): the character in a
  米字格 square as large as the screen allows; from the first stroke, back,
  play, on, the whole; the count above the buttons so they never move; the
  characters either side of it in the set as buttons, a swipe, or ↑ ↓.
- Radicals at `/library/radicals` as squares, search and "Several shapes"; the
  reference sheet under ⋯. Blank paper at `/library/paper` as rows.
- "Made from texts" folded under your lists, with Move them onto their shelves.
- Old addresses: `/collections`, `?kind=`, `?band=radicals`, `?show=` go to the
  new pages. LibraryPage, BandSeg, WordsShelf, CollectionsPage and
  NewCollectionDialog removed.
- Not done: a topic character's word sense (see `docs/backlog.md`).
