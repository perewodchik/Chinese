---
name: hanzi-design
description: The visual language of Hanzi Workshop — 练习本, the exercise book: tokens, type, page parts, components, touch rules and what never to do. Load before building or restyling any screen in src/features or src/ui, so a new section looks like the rest of the app and not like a template.
---

# Hanzi Workshop — design: 练习本, the exercise book

Everything on screen is a thing on the desk of someone learning Chinese from
a book: the page, ink, a pencil, the teacher's red pen, a highlighter, and an
exercise book ruled in 田字格. Each colour has one job, so a screen reads
without a legend. The boldness is spent in one place — the Chinese itself, in
the brush 楷体 (WenKai); everything around it is quiet. A new screen is right
when a user cannot tell it was added later.

Read the tokens at the top of `src/styles.css`, the **page parts** section in
it, and one redesigned page of the same kind (`src/features/reader/`,
`src/features/cards/`, `src/features/today/`) before writing anything.

## Colour: roles, not decoration

| Role | Token | Job |
| --- | --- | --- |
| Ink | `--ink`, `--ink-2` | the text; headings |
| Pencil | `--ink-3` | help that recedes: captions, glosses, hints |
| Pinyin | `--py` | pinyin anywhere (a darker pencil). Never blue, never red |
| Blue ink | `--accent`, `--accent-soft`, `--on-accent` | what you do (buttons, links, the current tab) and your own marks (words you are learning) |
| Red pen | `--red`, `--red-soft` | the teacher: new to you, wrong, an error. Thin and rare |
| Highlighter | `--hl` | where you are now: the line being read, the word open in a drawer. Background only |
| Grid | `--grid` | structure: 田字格 squares, the frame of an exercise |
| Jade | `--jade`, `--jade-soft` | right, known, done (progress lines too) |
| Gold | `--gold`, `--gold-soft` | nearly / shaky |
| Surfaces | `--paper` (page), `--card`, `--card-2` (a well), `--line`, `--line-2` | |

- Right / wrong / nearly use the `[data-state='right'|'wrong'|'nearly']`
  pattern with jade / red / gold. Wrong is **red**, not `--accent`.
- Every colour is a `var(--…)`: `:root[data-theme='dark']` redefines them all.
  Text on a filled blue button is `var(--on-accent)`, never `#fff`.
- Never colour-code the four tones. Tones are told apart by shape: the
  contour, the mark (ā á ǎ à), the number.

## Type

- **WenKai** (`var(--han)`, class `.hanzi`): all Chinese. Reading 25–28px on a
  phone, 28–32 on an iPad; a text's title 24 / 28; a card's character 72–84.
- **Fira Sans** (`var(--sans)`): everything the app says, and pinyin. Body 15px
  /1.5 (`.small` 13.5, `.tiny` 12). Headings 600: page 26–30, section 19.
  Weights 400, 500, 600 only.
- **Literata** (`var(--read)`): what is read rather than operated —
  translations, notes, grammar explanations, ledes of a part.
- Labels are sentence case. **No uppercase tracked labels**, ever.

## Shape and space

- Phone gutter `var(--gutter)` (20px) on every page; a 4px grid. Related things
  8–12px apart, groups 24–32.
- Radii by size: a sheet or a big block 20–24, a block 14–16, a control 12, a
  田字格 square 4.
- Depth is a fill (`--card-2`) and a hairline (`--line`), **not a shadow**.
  Only what floats casts one (`--shadow`: a menu, the Aa panel, More).
- Lists are rows divided by hairlines (`.list`), not a grid of boxed cards.
  Never a card inside a card.

## Page parts (in `src/styles.css`)

| Need | Use |
| --- | --- |
| Top of a page | `.page-head` with `h1`, `.spacer`, then `.icon-btn` (`.accent` for an add) |
| Back to the parent | `.back-link` with `<Icon name="back" />` and the parent's name |
| A section | `.block` > `.block-title` (or `.block-head` with a quiet button) |
| Rows | `.list` with rows inside; hairlines come by themselves |
| The page's one action at the end | `.page-foot` > `.btn.primary.lg` |
| Search | `.search` > `<Icon name="search" />` + `input[type=search]` |
| Icons | `<Icon name=…>` (`src/ui/Icon.tsx`): line icons that take the text colour. **No emoji** as icons |

## Controls

- `.btn` (40px), `.btn.sm` (34), `.btn.lg` (50). **One `.btn.primary` per
  screen**; the second action is `.btn.tonal`, a third `.btn.quiet` (a text
  button in blue ink). `.btn.danger` is red text.
- Choice of 2–5: `<Seg>` / `.seg`. Filters: `.chip[aria-pressed]` (pressed is
  blue tonal). Counts inside go in `<span class="count">`.
- Add / chosen: `.rd-add` — a 40px square with `+`, filled blue with a check
  once chosen, jade when already known.
- Bottom sheets and panels: the More sheet and the word drawer are the models.
- Changing labels keep a fixed width (the dock's buttons are grid cells; text
  that can grow is ellipsised), and the room for pinyin is kept whether it is
  shown or not. Nothing moves when something is switched.

## Navigation

Four places and More: Today 今, Read 读, Cards 卡, Library 字. Along the
bottom edge under 700px, a rail on the left above it. A sitting
(`data-focus`) has the whole screen; a text page (`data-immersive`) hides the
bar on a phone and has its own bar and dock.

## Never — the tells of a generated page

- Cream background with a terracotta accent (what this app used to be).
- Gradients, glow, glass, blurred blobs, coloured side stripes.
- Uppercase tracked eyebrows over every heading; "A · B · C" meta strings;
  `→` appended to buttons; emoji for icons.
- A grid of identical boxed cards giving everything the same weight; a 1px
  border plus a wide soft shadow on the same box; cards in cards.
- Pulsing dots and status circles where a word would do; bouncing motion.
  Motion is 120–160ms and only in answer to something the learner did.

## Touch and small screens (iPad and iPhone are the main devices)

- Tap targets ≥ 44px for anything used mid-exercise, ≥ 36px for chips.
- Everything reachable by hover also works under `(hover: none)`.
- Grids use `minmax(0, 1fr)`; nothing pushes the page wider than the phone.
  A word with pinyin over it is one unbreakable `inline-block`; punctuation is
  held to the word before it.
- `env(safe-area-inset-*)` on anything pinned to an edge; inputs ≥ 16px on a
  phone so Safari does not zoom.

## Writing on screen

Plain sentences, second person, sentence case, no exclamation marks, no
emoji. Headings say what is there ("20 for today"), buttons say what happens
("Learn this word", "Show the answer"). Never show a debt ("520 due"): show
what is for today. Code comments follow the file they are in: prose
paragraphs explaining *why*.

## The craft around it

`docs/guidelines.md` holds what the redesign learned the hard way: keeping
room for what can appear, sizing cards to their content, whole-row links,
touch sizes, copy, overflow, speech on iOS, and how to check a change. Read it
with this.

## Checking your work

Look at 375, 768, 1024 and 1194 wide, light and dark. Look for: anything
wider than the screen or cut off, a padding that is not the gutter, a
hard-coded colour that vanishes in dark mode, a control you can reach only by
hovering, more than one primary button, and anything from the Never list.
