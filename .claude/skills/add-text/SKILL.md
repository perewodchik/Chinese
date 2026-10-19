---
name: add-text
description: Put Chinese text from a real book (十万个为什么 and the like) on the learner's Texts shelf, in the reading session they choose — with pinyin, English, words, grammar, a note and questions, the same as a generated text. Use when the user types /add-text, pastes Chinese to add to Texts or a reading session, or sends a photo of a page of Chinese with nothing else asked of it.
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

## 3. The session

The learner named one → match it to a session's `name` (or say it will be new)
and do not ask. Otherwise ask once with AskUserQuestion, header "Session":
`suggested` first, marked (Recommended), then up to two other recent sessions,
then "New session" named after the book (e.g. 十万个为什么). Put the count in
each description ("12 texts, 9 from the book"). Their own words under "Other"
are a session name: an existing one is used, a new one is made. No sessions at
all → a new one named after the book, without asking.

The book: the learner's word for it, else the chosen session's `books[0]`, else
ask along with the session.

## 4. The study material

Write one JSON file — in the session's scratchpad if it has one, otherwise
`.data/book-texts/<timestamp>.json` — shaped as the generation prompt's answer:

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
      "note": "The heading asks; the last sentence answers — look for 所以."
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
  name is one word; 了, 的 and 吗 stand alone; the neutral tone unmarked. The
  reader finds the words from this grouping, so it matters as much as the tones.
- **`en`**: a natural translation of the whole sentence.
- **`teach`**: every character in the passage that is in neither `knownChars`
  nor `met`, in order of first appearance, with its reading here and a short
  meaning. The script recounts the list itself; your glosses are what it keeps.
- **`vocab`**: every word the passage uses that is not in `knownWords` and is
  worth learning — up to 14, words with new characters first (`"new": true`),
  names and places included. `d` is the sense it has here.
- **`grammar`**: 1–3 patterns the passage really uses that matter at HSK 1–3
  (把, 是…的, 因为…所以, 越来越…), each with its sentence from the passage.
- **`note`**: one or two sentences in English: what to watch for.
- **`questions`**: 2–3 comprehension questions in plain Chinese (HSK 1–2 words
  where you can), each with `py`, `en` and `a`, a short answer from the passage.

Valid JSON only — the script refuses a file that needs repairs.

## 5. Onto the shelf

```bash
<the same variables as in step 2> npm run -s texts -- add <file> --set <session id> --source "<book>" --genre description
<the same variables as in step 2> npm run -s texts -- add <file> --new-set "<name>" --source "<book>" --genre description
```

Each starts with the same `HANZI_SITE=… HANZI_USER=… HANZI_PASSWORD=…
NODE_USE_ENV_PROXY=1` as the `sets` command in step 2.

`--genre` is `description` for an explanation, `story` for a narrative,
`dialogue` for a conversation. `--dry-run` shows what would happen without
saving. An error about the JSON → fix the file and run it again. A passage
already on the shelf (same title, same first line) is left alone and said so.

It saves the way a device does, so an iPad open at the time keeps its own
changes and picks these up on its next sync.

## 6. The report

Short, in the learner's language: the session, then per passage its title, how
many sentences, what share of its characters they already know, how many new
ones, and its address (`/texts/<id>`). Any corrected typo and any character you
were unsure of. Not the JSON.
