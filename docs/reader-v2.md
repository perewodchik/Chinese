# The text page as a book (reader v2)

The mockups: the "Reading a chapter" design canvas (phone row and iPad row),
approved on 6 November 2026 with three page colours.

## Brief

- **Who and when:** the learner, reading a chapter of a story or a book's text,
  mostly on the iPad (landscape on a table, portrait in the hand) and on the
  iPhone, often in the evening.
- **The job:** reading feels like reading a book: a quiet page in the colour
  they like, the chapter's name at its head, new words explained in the margin
  where there is room, and at the end of the chapter what there is to do with
  it and the next chapter.
- **Done looks like:** a chapter on the iPad in landscape reads in one centred
  column with its new words in the right margin; Aa offers Paper, Sepia and
  Night; the end of a chapter has its parts and one button to the next
  chapter.
- **Not in it:** what the parts do (Words, Questions, Copy it out, Listen,
  More), comics' page photos, stories with choices, the PDFs. They keep
  working as they are and only move.
- **Open questions:** none left; the word opens in the drawer from the right,
  as the mockup shows.

## States

| Ask | Here |
|---|---|
| What the page is | a chapter of a book (a set with several texts), a text on its own, the easier retelling or the book's own text of one chapter, every text on one page (`?mode=all`) |
| Page colour | Paper (follows the app: light or dark), Sepia (always light, warm), Night (always dark); remembered on the device |
| Width | 375–430 phone; 597 Split View; 768–834 iPad portrait; 1024–1194 iPad landscape |
| Text | paragraphs or lines; a comic with page photos; a story with choices; pictures off, beside or large; traditional characters |
| Pinyin and English | pinyin off, over new words, over all; English off, a sentence held, every paragraph |
| Narrator | none; one; playing, paused, at the end |
| End | not read, read, read again; the last chapter (no next one); a text on its own (no book) |
| Longest real content | 天官赐福 chapter titles, 十万个为什么 long English titles, 西游记 with 30+ texts |

## Steps

Each is built, checked at every width in all three colours, and committed
before the next.

1. **Page colours.** Aa gets Paper, Sepia and Night. Sepia and Night are the
   page's: they set the app's tokens while a text is open and give them back
   when it closes.
2. **The bar and the chapter's head.** The bar says the book and the chapter
   (‹ book, chapter 3 of 12) with Aa and ⋯ in it and a hairline of how far
   down the chapter you are. The head: 第三章, the title, its English, and
   minutes, how much you know and new words in one quiet line. Paragraphs
   read as a book's: indented, justified.
3. **The end of the chapter.** The parts bar at the top goes; the chapter
   ends with 第三章 · 完, the parts as rows with their state (each opens its
   part below), and the next chapter with its cover and the page's one
   button, which also marks this one read.
4. **The margin.** On a wide page the column is centred and new words sit in
   the right margin beside their paragraph; English shown "beside each" goes
   there too. On a narrower page they sit under their paragraph. Holding a
   sentence shows its English.
5. **Chapters.** The list button in the bar opens the book's chapters in a
   panel from the left, with where you are and what is new in each.
6. **The player.** Previous and next sentence beside play, and "Reading along
   · sentence 3 of 9".

## Where it stands (6 November 2026)

All six steps are in. The word opens in the word drawer as before (from the
right on an iPad, a bottom sheet on a phone), which is what the mockup drew.

Open:
- Checked in Chromium at 375–1194 in Paper, Sepia and Night; **not yet in
  Safari** (WebKit is not installed where it was built). Look at: holding a
  sentence on the iPad (no callout, no selection), the Aa panel dropping from
  the bar, the contents panel's edge, the status bar's colour in Sepia.
- A picture in Night is as bright as by day; the mockup dimmed it.
- On a phone the narrator's name is cut short beside the clock until it
  plays ("Pikachu story narr…"); while it plays the row says the sentence.

## Later the same day

- The narrator moved up: a slim row under the bar, pinned with it. The
  bottom edge is the text's, and a tapped word's.
- A tapped word opens a small card instead of the whole drawer: pinyin,
  meaning, hear it, its level (one tap steps it), and Learn this word. A
  phone has it as a strip on the bottom edge; a page with a margin (an iPad
  on its side) puts it in the margin level with the word; anywhere else it
  is a popover by the word, above it when the word is low. A tap on the card
  opens the word drawer, unchanged. Another word changes the card; a tap
  elsewhere or Escape closes it.

## The day after

- The book page: the chapter being read is a card in blue ink (the
  highlighter was mud on the dark page); words and characters come grouped
  by the chapter each first comes in, closed but for the one being read,
  with one tap to put a chapter's unknown words on the list.
- The narrator only while it reads: a headphones button by the book's name
  opens a one-row player (back, play, next, slider, speed, ✕).
- A chapter's tabs: Read, Write (copy it out, translate, dictation), Speak
  (each line's best score, the next line to say), Words, Quiz. Along the
  bottom on a phone, in the bar on a wider page (characters only under
  1100px). The tab is kept in the address (#speak).
