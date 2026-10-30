---
name: add-text
description: Put Chinese text from a real book (十万个为什么 and the like) on the learner's Texts shelf, in the reading session they choose — with pinyin, English, words, grammar, a note and questions, the same as a generated text — after a summary of how hard it is, offering an easier retelling when it is too hard. Also a comic (漫画, manga such as 天官赐福): a chapter's photographed pages become a chapter to read bubble by bubble, an easier version bubble for bubble, the page photos above their bubbles, and a primer of who is who before the first chapter. Use when the user types /add-text, pastes Chinese to add to Texts or a reading session, or sends a photo of a page of Chinese (or of a comic) with nothing else asked of it.
argument-hint: "[session] <the Chinese text, or a photo of the page>"
---

# A book passage onto the Texts shelf

The learner (HSK 1–2, reading from English) is working through a real Chinese
book — short passages of one kind, like 十万个为什么's "why" pieces — and wants
each one in the app to study: the same reader, pinyin, translation, word drawer
and practice sheets as a passage Claude wrote. You write the study material;
`scripts/texts/book.ts` puts it into the admin account's workspace the way the
"Paste back" step would, in the reading session the learner picks.

Talk to the learner in their language (often Russian); everything written into
the app is in English, as the app is.

## 1. The text

It comes as text in the arguments (`$ARGUMENTS`), as photos of the book's
pages, or both. Neither → ask for it and stop.

Photos of a comic — panels, speech bubbles, captions — are a chapter of a
comic, not passages: read **A comic** at the end of this file before going on.
It changes steps 1, 3, 5, 6 and 7 and adds a primer.

From a photo, transcribe — from the photo, not from memory of the book:
- the Chinese exactly, in reading order (columns right to left on a vertical
  page);
- only the passages: no page numbers, running heads, picture captions, or
  pinyin printed over the characters;
- several photos are pages in the order sent, and a passage running from one
  onto the next is one passage;
- a passage cut off at the edge of the last photo is not added: add the whole
  ones and ask for the next page for that one;
- a character you could not read with confidence gets your best reading, and
  goes in the report with what else it might be.

Then it is the same as typed text. One paste or page may hold several
passages: each heading with its text is one passage (in 十万个为什么 the heading
is the question, 为什么…？). A short phrase beside the text or the photo that
names a session ("в сессию 十万个为什么", "into Evening") is the session, not
text.

## 2. The account

The learner has given standing permission: sign in to their account on the
site — **admin / adminadmin** at https://chinese-inky.vercel.app — and add the
texts there, without asking first. They chose to keep the password here, in a
public repository, knowing anyone can read it. Every `npm run texts` call
carries the site and the account, since shell variables do not survive from
one command to the next:

```bash
export PATH=/opt/homebrew/bin:$PATH   # on the Mac; harmless elsewhere
[ -d node_modules ] || npm ci --no-audit --no-fund
HANZI_SITE=https://chinese-inky.vercel.app HANZI_USER=admin HANZI_PASSWORD=adminadmin NODE_USE_ENV_PROXY=1 npm run -s texts -- sets
```

It prints JSON: `account`, `sessions` (most recently added to first — `id`,
`name`, `texts`, `fromBook`, `books`, `latest`), `suggested` (where the last
book passage went), `knownChars`, `knownWords`, and `met` (characters generated
passages taught — not new to the learner).

When it fails, tell the learner in a few lines and stop:
- **The site cannot be reached** (a 403 or a refused connection through the
  proxy, `fetch failed`): the cloud environment's network policy blocks
  `chinese-inky.vercel.app`. It goes under Network access → Allowed domains in
  the environment's settings (the cloud environment menu in the session's
  title bar → Edit), then a new session. On the Mac, the same command without
  `HANZI_SITE=…` goes through `POSTGRES_URL` in `.env` instead.
- **Signing in is refused**: the password has changed. Say so, and that this
  file holds the one to update.

## 3. The study material

Write one JSON file for the book's passages — in the session's scratchpad if it
has one, otherwise `.data/book-texts/<timestamp>.json` — shaped as the
generation prompt's answer:

```json
{
  "texts": [
    {
      "title": "Why is the sky blue?",
      "titleZh": "天为什么是蓝色的？",
      "teach": [{ "c": "蓝", "py": "lán", "d": "blue" }],
      "lines": [
        { "zh": "晴天的时候，天空是蓝色的。", "py": "qíngtiān de shíhou tiānkōng shì lánsè de", "en": "On a clear day, the sky is blue.", "p": true }
      ],
      "vocab": [{ "w": "蓝色", "py": "lánsè", "d": "blue", "new": true }],
      "questions": [{ "zh": "天是什么颜色的？", "py": "tiān shì shénme yánsè de", "en": "What colour is the sky?", "a": "天是蓝色的。" }],
      "grammar": [{ "point": "把 + thing + verb + result", "zh": "空气把蓝色的光散开了。", "en": "The air scatters the blue light." }],
      "note": "The heading asks; the last sentence answers — look for 所以.",
      "pictures": [{ "para": 0, "prompt": "A child lies in green grass looking up at a bright blue summer sky with a few small white clouds." }]
    }
  ]
}
```

Rules — the book's text is the point, so it is never rewritten:
- **`lines`**: the book's Chinese exactly, its own punctuation, one sentence per
  entry (split after 。！？, and after ； or ， only when a sentence runs past
  about 40 characters). `"p": true` on the first sentence of each of the book's
  paragraphs. The heading is not a line. A character that is plainly a typing
  slip (an IME homophone: 在 for 再) is corrected and named in the report;
  nothing else is touched.
- **`titleZh`**: the book's heading; none → a short one from what it answers.
  **`title`**: the same in English.
- **`py`**: tone marks, lower case, no punctuation, one group per word — the
  syllables of a word together, words apart (`wǒ de péngyou zài chī zǎofàn`); a
  name is one word; 了, 的 and 吗 stand alone; the neutral tone unmarked. A word
  on the HSK lists is read as the dictionary reads it (暖和 nuǎnhuo, not nuǎnhé).
  The reader finds the words from this grouping, so it matters as much as the
  tones.
- **`en`**: a natural translation of the whole sentence.
- **`teach`**: every character in the passage that is in neither `knownChars`
  nor `met`, in order of first appearance, with its reading here and a short
  meaning. The script recounts the list itself; your glosses are what it keeps.
- **`vocab`**: every word the passage uses that is not in `knownWords` and is
  worth learning — up to 14, words with new characters first (`"new": true`),
  names and places included. `d` is the sense it has here. Beyond those, and
  with no limit: **every word off the HSK lists** the passage uses (热汤, 雪地,
  a name), with `py` and `d` — the app explains such a word from here wherever
  it turns up, and keeps them all in the library as a set of their own.
  `check` names any that are missing, and `add` refuses to save without them.
- **`grammar`**: 1–3 patterns the passage really uses that matter at HSK 1–3
  (把, 是…的, 因为…所以, 越来越…), each with its sentence from the passage.
- **`note`**: one or two sentences in English: what to watch for.
- **`questions`**: 2–3 comprehension questions in plain Chinese (HSK 1–2 words
  where you can), each with `py`, `en` and `a`, a short answer from the passage.

- **`pictures`**: one a paragraph — `para` is the paragraph's number from 0
  (the first line, then each `"p": true`), `prompt` an English description of
  one scene a painter can draw: who is there, what they are doing, where, the
  light and the mood, in two or three sentences. What the paragraph *shows*,
  not what it explains: for "why is the sky blue", a child under a blue sky,
  not a diagram. No words, letters or Chinese in the picture.

Valid JSON only — the script refuses a file that needs repairs.

## 4. How hard it is

Every command below starts with the same `HANZI_SITE=… HANZI_USER=…
HANZI_PASSWORD=… NODE_USE_ENV_PROXY=1` as the `sets` command in step 2.

```bash
<the same variables as in step 2> npm run -s texts -- check <file>
```

It saves nothing. Per passage: sentences, characters and the share of them
already known — counted as read, each time a character appears — then the
distinct characters, how many are new, and the new ones themselves.

Then give the learner a summary, in their language, before anything is saved:
- what the passage says, in one or two sentences;
- how long it is, and how much of it they can read: "из 210 иероглифов знакомы
  62%, новых — 48";
- the three to five words it hangs on (面包, 二氧化碳, 酵母菌…), with meanings;
- a verdict: **comfortable** (85% or more known), **with help** (65–85%, up to
  about 20 new characters), or **too hard** (below 65%, or more new characters
  than that). The learner knows a few hundred characters, so these are set low
  on purpose: most of a book page should still go in as it is.

Comfortable or with help → go on to the session. Too hard → offer an easier
version in the same question as the session (step 5).

## 5. The session, and an easier version

Ask everything still open in one AskUserQuestion — no second round.

**Session** (header "Session"): the learner named one → match it to a
session's `name` (or say it will be new) and do not ask. Otherwise `suggested`
first, marked (Recommended), then up to two other recent sessions, then "New
session" named after the book (e.g. 十万个为什么). Put the count in each
description ("12 texts, 9 from the book"). Their own words under "Other" are a
session name: an existing one is used, a new one is made. No sessions at all →
a new one named after the book, without asking.

**Easier version** (header "Simplify"), only when the verdict was too hard:
- "Easier version first, then the book's" (Recommended) — both go in the
  session, the retelling before the original: read the easy one, then the real
  one with most of it already met;
- "Only the easier version";
- "Only the book's text, as it is".

The book: the learner's word for it, else the chosen session's `books[0]`, else
ask it in the same question round.

## 6. An easier version

A retelling of the same passage for this learner — the book's facts, in the
book's order, in Chinese they can nearly read. A second JSON file, the same
shape and the same rules as step 3, except for `lines`:
- built from `knownChars`, `met` and `knownWords` first; short sentences (6 to
  14 characters), one idea each, still flowing like a paragraph;
- new characters only where the subject cannot do without them (面包, 小孔) —
  about 10 at most, each introduced in a sentence where everything else is
  known, and used at least twice;
- a detail that would cost several new characters (酶, 淀粉) is said more
  simply or left out — never explained in yet more new words;
- `titleZh` the book's heading, `title` the English one with " (easier)".

Check it with `npm run -s texts -- check <file> --adapted`: aim for 90% of the
characters known, and rewrite the sentences that carry the most new ones until
it is at least 80%.

## 7. Onto the shelf

```bash
<the same variables as in step 2> npm run -s texts -- add <file> --set <session id> --source "<book>" --genre description
<the same variables as in step 2> npm run -s texts -- add <file> --new-set "<name>" --source "<book>" --genre description
```

Only what the learner chose. The easier version goes first, with `--adapted`
added; the book's text after it, without. In that order the retelling teaches
its new characters as a generated passage does, and the book's passage counts
them as met. Keep the same `titleZh` on both: the reader shows them as one
text with a 简 / 原 switch, which it finds by that title.

`--genre` is `description` for an explanation, `story` for a narrative,
`dialogue` for a conversation. `--dry-run` shows what would happen without
saving. An error about the JSON → fix the file and run it again. A passage
already on the shelf (same title, same first line) is left alone and said so.

It saves the way a device does, so an iPad open at the time keeps its own
changes and picks these up on its next sync.

Then it draws the pictures, with Gemini, when `GEMINI_API_KEY` is set in the
environment (the cloud environment's settings, or `.env` on the Mac): each
paragraph's picture is drawn beside the ones already drawn in the session, so
the people in it look the same, made small, kept on the site and put above its
paragraph. A minute or so for a chapter. A picture Gemini refuses (it will not
draw some famous characters) is named and left; without the key it says so and
draws nothing. Either way, later:

```bash
<the same variables as in step 2> npm run -s texts -- illustrate --set "<session>"           # what is not drawn yet
<the same variables as in step 2> npm run -s texts -- illustrate --text <id> --redo           # one text drawn again
```

`--style "…"` changes the look (a watercolour picture book unless said);
`--dry-run` lists what would be drawn.

## 8. The report

Short, in the learner's language: the session, then per passage — the easier
version marked as such — its title, how many sentences, what share of its
characters they already know, how many new ones, and its address
(`/texts/<id>`) and how many of its pictures were drawn. Any corrected typo and
any character you were unsure of, and any picture that was refused. Not the
JSON.

## A comic

Photos of a comic's pages (天官赐福's 漫画 and the like) are read as one
chapter. Everything above holds, with these differences. Do not ask whether it
is a comic: the panels say so.

**What the learner gets.** The chapter as a text, a line per bubble. The
easier version is the same chapter told bubble for bubble in Chinese they can
nearly read, and it opens first. 简 / 原 at the top of the text page switches
the whole chapter.

Each page's photo sits large above that page's lines, cleaned up to look like
a scan. Every piece of writing on it is a faint spot; in the easier version
each bubble and caption on the photo is covered with its easier line. A tap on a spot says
under the photo what is written there, with its pinyin and meaning, and
lights its line. Sound effects and signs drawn into the art, which have no
bubble, get their meaning this way. Aa → "Dialogue as a comic" draws the
bubbles with the speakers' faces, without the photos.

Before the first chapter of a book comes a primer of who is who.

### Reading the pages (step 1)

- The learner photographs a whole chapter, in order. Read the photos in the
  order sent. If the chapter stops mid-scene at the last photo, ask whether
  to add what is there or wait for the rest.
- A photo lying on its side or upside down (the second page of a spread is
  often shot that way) is read the right way up. It is turned the right way up
  when the page is cleaned (**The photos** below).
- A photo of a whole spread is two pages: clean each one out of it on its own.
- On each page, read the panels in the book's order: left to right and top to
  bottom for a horizontal Chinese comic, right to left for vertical text. In
  each panel, read the bubbles in the order they are spoken.
- Transcribe every piece of Chinese writing on the page:
  - speech and thought bubbles;
  - captions (narration boxes);
  - the book's own footnotes (※通灵阵：…);
  - writing drawn into the art: sound effects (轰隆隆, 砰, 哗), shouts drawn
    as lettering, signs, plaques, banners, letters.

  Brush lettering is hard to read: take it from the strokes and the scene
  (thunder over a stormy sky is 轰隆隆), and list it in the report when you
  were unsure. Leave out page numbers, running heads and credits.
- Leave out a page with no words at all, and its photo. Say so in the report.

### The chapter (step 3)

- One chapter is one text. **`titleZh`** is the chapter as the book numbers
  it: 第一话, plus its name when the page gives one. **`title`** is "Chapter 1",
  with the English name when it has one.
- **`lines`**: one bubble is one line, and so is each caption, footnote, sound
  effect and sign. Never split a bubble even when it holds two sentences, and
  never join two bubbles. `"p": true` goes on the first line of each page: a
  page is a paragraph, and that is what puts the page's photo above its lines.
- **`kind`** on every line: `bubble` (speech or thought), `caption`, `sfx` (a
  sound effect), `sign` (other writing in the art), or `note` (the book's
  footnote).
- **`box`** on every line: where the writing is on the cleaned page, in % of
  its width and height: `[left, top, width, height]`. Read it off the cleaned
  page with `page.mjs grid` (**The photos** below). Box the whole bubble or
  the whole lettering, a little generously, since it is what a finger taps.
  Boxes may touch, but should not overlap.
- **`who`** on every line: the speaker as the book names them (谢怜, 灵文). Use
  旁白 for a caption, 注 for a footnote, 音效 for a sound effect, and 字 for a
  sign. When the panel does not show who speaks (by the tail, the face beside
  the bubble, a name in it), take the likeliest from the story and list it in
  the report as a guess.
- **`en`** gives the sense of the bubble. For a 成语 or a line of poetry
  (偷得浮生半日闲), give its sense here and put it in `vocab` as one word. For
  a sound effect or sign, say what it is as well as what it means, since this
  is what the tap shows: "Boom, rumble: thunder. A sound effect drawn into the
  sky." Put each sound effect in `vocab` too.
- **`vocab`**: every name, and every title a person goes by, with who it
  is in `d` ("帝君 — the Lord Emperor: 君吾"). A comic calls people by title
  more often than by name.
- **`note`**: who is speaking to whom on the pages, and anyone new who comes
  in under more than one name.
- **`grammar`**: the written-Chinese patterns HSK 1–2 do not teach that the
  chapter leans on (看来, 怕是, 并不, 如 for 像, 名 for 个).
- **No `pictures`.** The photos go in at step 7. A described picture would
  have Gemini draw over the book's own page.

### The easier version (steps 5 and 6)

A comic's chapter is nearly always too hard as it is, and the easier bubbles
are the point. Ask the Simplify question for every first chapter of a book,
whatever the verdict, with "Easier version first, then the book's" marked
(Recommended). For the next chapters, do what was chosen for the first
(the session shows it), without asking.

The easier version goes **line for line**: the same number of lines, line n
retelling bubble n, and the same `who`, `kind`, `box`, and `"p": true` in the
same places. So 简 / 原 swaps a bubble for the same bubble, and each page photo
has the same spots in both. A sound effect stays as the book draws it, with
the same `en`. Within a bubble, step 6's rules apply:
- short sentences;
- a 成语 said plainly (地大物博 → 国家很大，东西很多);
- a dropped subject given back (劈钟伤了手 → 他砍钟的时候手受伤了).

Names and titles stay as the book has them; the primer teaches them. Check it
with `--adapted` and aim for 90% known, as step 6 says.

### Before you read: the primer

When the session has no chapter of this book yet, write a primer and put it
first in the easier file, before the chapter. It is written from what you
know of the book, and nothing in it goes past the chapter being added.
- `titleZh` 人物和词语; `title` "Before you read: <the book in English>".
- **`lines`**: one paragraph per person, in Chinese the learner can nearly read,
  one sentence per name they go by: 谢怜是仙乐国的太子。大家叫他"太子殿下"。
  No `who`.
- **`note`**: the story's start in English, three to five sentences: who the
  hero is and where things stand when the book opens. Keep hidden what the
  book means the reader to find out, such as a character's real identity.
- **`vocab`**: every name, every title, and the 10 to 15 words the book stands
  on (神官, 飞升, 香火, 通灵阵), with `py` and `d`.
- **`grammar`**: the patterns from the chapter's `grammar`, each with its
  sentence from the chapter.
- **`questions`**: who is who (太子殿下是谁？ — 谢怜。).
- No pictures.

A later chapter gets no primer. A new person in it with several names goes in
that chapter's `note` and `vocab`.

### Onto the shelf, with the photos (step 7)

Use one session per volume, named after it (天官赐福 1), with `--genre story`.
Make two adds per chapter, in this order: the easier file (the primer, if
there is one, then the chapter) with `--adapted`, then the book's chapter
without it. `add`'s report gives each text's id (`/texts/<id>`).

Then put the photos in, one per page with words, in order. They go into both
texts of the chapter, never into the primer:

```bash
<the same variables as in step 2> npm run -s texts -- put <easier text id> page-1.jpg page-2.jpg …
<the same variables as in step 2> npm run -s texts -- put <book text id> page-1.jpg page-2.jpg …
```

- **Where the photos are.** The photos attached to the message are saved as
  files, and their paths come with the message. If no paths come, ask the
  learner to put the photos in `.data/comic/<book>/` and say when they are
  there.
- **Never the raw photos.** Each page goes in cleaned, as below.
- **The photos stay in the learner's account.** They are pages of a book the
  learner bought: never commit them to the repository.

### The photos

Every page goes in looking like a scan of the book, and every page of a book
looks the same. To do that:
- square up the angle the photo was taken at;
- cut away the table, fingers, the next page and the spine's shadow;
- make the paper white and the ink black, in the book's own colours;
- give every page the same width, shape and margins.

`scripts/texts/page.mjs` does it, with Chromium as `art/render.mjs` does. Run
it from the repository, with the files in the scratchpad.

1. **The grid.** Turn the photo upright and draw a grid on it, to read the
   corners off:
   ```bash
   node scripts/texts/page.mjs grid <photo> <scratch>/grid-1.jpg --turn 90
   ```
   `--turn` is 0, 90, 180 or 270 degrees clockwise. Look at the grid: is the
   page upright?
2. **The corners.** Read off the outer corners of all the page's panels taken
   together, in the grid's pixels: top left, top right, bottom right, bottom
   left. These are the outer corners of the block the panels make, not of the
   paper. The book printed those lines straight, so pulling them square undoes
   the angle. Read them to within 10 px; zoom into each corner (crop the grid
   image) if the line is not plain.
3. **The page.**
   ```bash
   node scripts/texts/page.mjs fix <photo> <scratch>/page-1.jpg --turn 90 \
     --corners 129,186 1351,156 1399,1930 104,1927 --margin 0.12,0.035,0.07,0.035
   ```
   - `--margin` is the space kept around the panels, as a fraction of the
     width: top, right, bottom, left. It has to take in the captions outside
     the panels and the page number.
   - On the first page, set a margin that does that, and note the ratio the
     command prints. On every later page of the book, pass the same
     `--ratio` and `--margin`, so the pages match. Change them only for a page
     laid out differently (a full-bleed spread, a title page), and say so.
4. **Look at it** before it goes in:
   - the panels' frames are straight and square;
   - nothing is cut off: captions, the outer panels, the page number;
   - no finger, no table, no edge of the next page;
   - the paper is white, not grey or yellow, and the colours are not
     overdone;
   - no glare over the writing.

   The command says when part of the page lay outside the photo, and stretches
   the edge into it: check that corner. A wrong corner shows as a bent frame:
   read it again and redo the page. If the photo itself fails (blurred
   writing, glare across a bubble, the page cut off), do not put it in. Ask
   for that page again, and say what to do differently: straight over the
   page, light from the side, a step back and 2×.
5. **The boxes.** Draw a grid on the cleaned page
   (`page.mjs grid <scratch>/page-1.jpg <scratch>/grid-page-1.jpg`) and read
   each line's `box` off it, as % of the cleaned page's width and height.
   A box found wrong after the chapter is on the shelf (in the easier version
   a patch leaves the book's lettering showing round it) is fixed in place, in
   both texts: `npm run -s texts -- boxes <text id> <file>`, the file
   `{ "<line number from 0>": [left, top, width, height] }`.

### The report (step 8)

Add these to the report:
- the pages read and the pages left out as wordless;
- how many bubbles, and how many sound effects and signs;
- lettering you were unsure of;
- any page you asked to have photographed again, and why;
- the speakers taken as guesses;
- whether the primer went in;
- how many photos each text got.

Then tell the learner how the chapter opens: in the easier version, with 简 /
原 to switch.
