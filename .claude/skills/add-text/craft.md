# The craft of a book chapter: what the steps leave unsaid

SKILL.md says what goes in the JSON. This file says how to get it right the
first time, from the chapters already added. Read it once before step 3.

## Before writing anything

1. **Read the book's file**, `books/<book>.md`, if there is one: its sessions,
   titles, names, picture descriptions and what the learner settled. A book
   with no file yet gets one when its first chapter goes in (step 9 below).
2. **Look at the last chapter as it is on the site**, read-only: sign in, GET
   `/api/workspace`, and print that text's `title`, `titleZh`, `genre`, the
   first lines with their `p`, `py` and `en`, the size of `vocab`, `grammar`,
   `note` and a picture prompt. Match it. "In the same style" means exactly
   this, not a fresh idea of what a chapter should be.
3. **"In the same style" answers the questions** of step 5: the same
   sessions, the easier version first. Do not ask.

## Transcribing the photos

- Read every line from the photo where it is whole. A spread shot with the
  next page's edge shows the same lines twice, the second time cut off.
- Leave out what is not the text: the pinyin printed over it, running heads,
  page numbers, captions, the editor's moral or questions in a box. Say in
  the report what you left out, and offer it.
- A paragraph is what the book indents. A drop capital starts the first one.

## Lines

- Split after 。！？. Inside a quotation, keep it whole unless it runs past
  about 40 characters; then split after its 。or ！ and let the closing ” go
  with the last part.
- A long narrative sentence (60 characters and more) splits after the ，
  nearest the middle, where the sense breaks ("…高山上，" / "从一打柴人…").
- The first line of each of the book's paragraphs has `"p": true`, and
  nothing else does. Count them: the pictures are numbered by them.

## Pinyin

- Mark the tone changes of 一 and 不 as spoken: yí gè, yì tiān, yí cì, yì tīng,
  bú duì, búyào, búliào; but bù xué, bùjué.
- One group a word. A 成语 is one group (fēngcānlùsù, shǒuwǔzúdǎo).
- A name is one group, or two for a surname and given name (Sūn Wùkōng); it
  goes in `vocab` either way, which is what keeps it one word in the reader.
- `check` names the groups it cannot find a meaning for, and some are only
  your grouping (七十 out of qīshí'èr, 来到, 听到, 指着): give each one a
  `vocab` entry rather than fight the grouping.

## Vocab and teach

- `teach` is single characters only. A word in it (学会) is a mistake.
- `vocab` has the learnable words first, `"new": true` on those with new
  characters, then every word off the HSK lists the text uses, names and
  成语 included. Chapter 2's book text had 151. Run `check` until it names
  none missing.
- `d` is the sense here, short: "to blame", not every dictionary sense.

## The easier version

- It is the book's story, in the book's order, paragraph for paragraph with
  the original. Same number of paragraphs, so the same pictures fit both.
- Write it from `knownChars`, `met` and `knownWords` (print them from `sets`).
  Then `check --adapted`, and for each new character it lists ask: is it a
  name or something the story stands on? If not, say it with known words.
- Names repeat, and every repeat counts against the share known. A chapter
  can have only ten new characters and still sit at 87%. 80% is the floor.
- Keep the book's grammar where it is easy to keep, so the original reads as
  something met before.

## Pictures

- A prompt is one scene a painter can draw: who, doing what, where, the light
  and the mood, in two or three sentences. What the paragraph shows, not what
  it explains.
- The same person is described in the same words in every prompt of every
  chapter: the book's file keeps those words. That, more than anything, keeps
  the drawings looking like one book.
- No words, letters or Chinese in the picture.
- Where the easier version changed a detail, its prompt changes too.
- When `add` cannot draw (no key, or a free-tier key: it says "draws no
  pictures"), the prompts are kept with the texts and `illustrate` draws them
  later. Say so in the report with the command; it is not a failure of the
  text.

## Checking before it goes in

- `check` on both files: no words missing, the shares as expected.
- Read the JSON once more for the classic slips: a word in `teach`, a
  paragraph count that differs between the versions, a quotation mark lost
  when a line was split, an English line that translates the next sentence.

## After it goes in

- The report as SKILL.md step 8 says, in the learner's language, with both
  addresses.
- **Step 9: update the book's file** in `books/`: the chapter's row, any new
  name, any new person's picture description, anything the learner asked for
  or decided. Commit it (the repository's commit rules, CLAUDE.md). The book's
  text and photos never go into the repository: only these notes.
