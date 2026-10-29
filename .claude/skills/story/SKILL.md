---
name: story
description: Write a story in chapters for the learner to read in the app — their topic and characters (Ash and Pikachu, say), pitched so they know a chosen share of the characters (80–90% by default), opening with a preface of names and key words, its new words coming back chapter after chapter, and its new words put on the shelf's list for Cards. Use when the user types /story or asks for a story, a series or chapters to read for their Chinese.
argument-hint: "<topic, characters, how much known, chapters, tone>"
---

# A story to learn from

The learner (HSK 1–2, a few hundred characters, reading from English, 20–30
minutes a day on an iPhone or iPad) wants stories they choose — "Ash and
Pikachu, at my level, 80–90% of the characters known, three chapters, funny" —
written to teach: easy enough to read, a few new words at a time, those words
met again and again until they stick. The story goes into the app as a reading
session of its own: a preface, then the chapters in order, each with pinyin,
translation, words, grammar and questions, like any generated text.

Talk to the learner in their language (often Russian); everything written into
the app is in English, as the app is.

## 1. The brief

From the arguments (`$ARGUMENTS`) and anything said with them:
- **topic and characters**;
- **how much known**: the share of the characters they can already read,
  counted as read (a character appearing nine times counts nine times) —
  80–90% when not said;
- **chapters**: 3 when not said;
- **chapter length**: 8–12 sentences (about ten minutes) when not said;
- **tone** and anything else asked for.

## 2. The account

Every `npm run texts` command here starts with the same variables as the
`sets` command in step 2 of `.claude/skills/add-text/SKILL.md` — the site, the
account and its password, and `NODE_USE_ENV_PROXY=1` — and fails the same ways,
handled as that step says.

```bash
export PATH=/opt/homebrew/bin:$PATH   # on the Mac; harmless elsewhere
[ -d node_modules ] || npm ci --no-audit --no-fund
<the variables> npm run -s texts -- sets
```

Of what it prints, this uses `knownChars` and `knownWords` (what they have
learned), `met` (what earlier texts taught — counted as known), `due` (what
Review says is due now) and `learning` (what their collections hold that is not
learned yet), and the session names, so the new one does not clash.

## 3. Questions

One AskUserQuestion round, only about what the brief leaves open and what
changes the story — at most four, with a recommended option first. The usual
ones:
- **form**: mostly dialogue (shown as a comic, speech bubbles and all, once
  every line says who speaks), prose, or a chapter where they choose what
  happens;
- **grammar to practise**: one or two HSK 1–2 patterns to thread through every
  chapter (了 for what happened, 在…呢, 比, 会/能, 要…了), or yours to choose;
- **chapter length**, if they might want it shorter for one sitting;
- anything about the characters or the world worth settling now (who else is
  in it, where it happens).

Nothing to ask → go straight on.

## 4. The plan

Show it, short, in their language, and wait for an "ok" or changes:
- the title, in Chinese and English, and one line per chapter — how it ends,
  on something that makes the next one worth opening;
- **the preface**: the names (official Chinese ones: 小智 Ash, 皮卡丘 Pikachu)
  and the few key words the whole story stands on (宝可梦, 精灵球) — they read
  it first and mark these as known, so the story counts them known from chapter
  one;
- **the new words**, by chapter, and where each comes back. Chosen in this
  order: what is `due` and in `learning` first — the story is where they get
  met again; then the next everyday words of HSK 2–3; then what the plot cannot
  do without. With 80–90% known, that is about 8 to 12 new characters a
  chapter;
- the grammar thread.

## 5. Writing it

One JSON file — in the session's scratchpad if it has one, otherwise
`.data/stories/<timestamp>.json` — the preface first, then the chapters, in the
shape of step 3 of `.claude/skills/add-text/SKILL.md` and by its rules for
`py`, `en`, `teach`, `vocab`, `grammar`, `note` and `questions`. The lines are
yours to write:

- **The preface**: `titleZh` 人物和词语, `title` "Before you read". One short
  line per name or key word, in Chinese the learner can read ("小智是一个
  男孩。"), every one of them in `vocab` with pinyin and meaning. No questions.
- **Each chapter**: `titleZh` 第一章 and a few words, `title` "Chapter 1: …".
  Sentences of 6 to 14 characters, `"p": true` on each paragraph's first.
  Dialogue lines carry `"who"` — the speaker's Chinese name — so the app can
  draw it as a comic. Pikachu says only 皮卡、皮卡丘 and the like; the others
  understand him, and that is half the comedy.
- **Funny at this level** comes from situations, timing and characters being
  themselves — not wordplay, which needs characters the learner does not have.
- **New words**: each introduced in a sentence where everything else is known,
  used at least twice in its chapter, and back at least once in a later
  chapter. A chapter after the first opens with one line of where things
  stand.
- 2–3 questions a chapter, and the grammar thread in `grammar` each time.
- **A picture for every paragraph** of every chapter (`pictures`, by the rule
  in `/add-text`); none for the preface. Write the characters down once — what
  each looks like, the clothes, the colours — and use those exact words in
  every prompt they appear in, so Gemini draws the same people each time; the
  pictures already drawn go along as references too. Gemini may refuse a famous
  character by name (Pikachu): describe them instead ("a small round yellow
  electric mouse with red cheeks, long black-tipped ears and a lightning-bolt
  tail") and leave the name out.

## 6. Checking it

```bash
<the variables> npm run -s texts -- check <file> --story --preface
```

It measures each chapter against what the learner knows, counting the
preface's words and the earlier chapters' new ones as known — as they will be
when the chapter is read. Every chapter must land in the range asked for
(80–90%: from 80 to 90). Below it, rewrite the sentences carrying the most new
characters; above it, there is room for a new word or two. The preface is not
measured.

## 7. Onto the shelf

```bash
<the variables> npm run -s texts -- add <file> --new-set "<title>" --story --preface --learn --genre story
```

`--genre dialogue` when the chapters are mostly talk. A new reading session
named after the story, the preface first and the chapters in order. Every
chapter's new words go onto the shelf's own list — as words, and any new
character no new word covers as itself — which Cards ask from, as a word the
learner taps and learns on the text page; the preface's names and words do not:
the learner marks those known. Every word off the HSK lists needs a `vocab`
entry, or `add` refuses (see the `vocab` rule in `/add-text`).

More chapters of a story already on the shelf go into its session with
`--set "<title>"` instead of `--new-set`, and no `--preface`.

Then the pictures are drawn, as step 7 of `/add-text` says — by `add` itself
when `GEMINI_API_KEY` is set, otherwise later with `illustrate --set "<title>"`.

## 8. The report

Short, in their language: the session and its address (`/texts/<id>` of the
preface), a reminder to open the preface first and mark its words as known,
then per chapter its title, what share of it they know and how many new
characters, and how many went onto the shelf's list; how many pictures were
drawn, and any Gemini refused. Not the JSON.
