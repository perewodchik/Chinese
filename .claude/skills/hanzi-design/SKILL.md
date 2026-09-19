---
name: hanzi-design
description: The visual language of Hanzi Workshop — tokens, type, components, touch rules and the pronunciation visuals. Load before building or restyling any screen in src/features or src/ui, so a new section looks like the rest of the app and not like a template.
---

# Hanzi Workshop — design

The app looks like **good paper with one red stamp on it**: warm off-white, ink
greys that lean brown, one cinnabar accent, and Chinese set in a brush-like 楷体
(WenKai). It is calm, dense where it helps, and made for an iPad held in one
hand. A new screen is right when a user cannot tell it was added later.

Read `src/styles.css` (tokens at the top, sections marked `/* --- name */`) and
one existing page of the same kind before writing anything. Reuse before you
invent: most things a new screen needs already have a class.

## The rules that hold it together

1. **One accent, one job.** `--accent` (cinnabar) means *pronunciation* —
   pinyin, the sound, the newest stroke — and primary actions. Nothing
   decorative is red. Rules, labels and panels stay neutral.
2. **Right and wrong have fixed colours.** Right = `--jade` on `--jade-soft`,
   wrong = `--accent` on `--accent-soft`, "shaky / nearly" = `--gold` on
   `--gold-soft`. Use the existing `[data-state='right'|'wrong']` pattern.
3. **No rainbow.** Never colour-code the four tones. Tones are told apart by
   *shape* — the contour, the mark (ā á ǎ à), the number — which also works
   for colour-blind users and in the Graphite print style.
4. **Tokens only.** Every colour is a `var(--…)` from `:root`, which is
   redefined under `:root[data-theme='dark']`. A hard-coded hex breaks dark
   mode. For tints use `color-mix(in srgb, var(--accent) 40%, var(--line))`.
5. **Few sizes.** Body 14px/1.55; `.small` 12.5px; `.tiny` 11.5px; card
   titles 14.5–15px weight 620; `h1` 21px, letter-spacing −0.015em. Big
   hanzi 44–132px in `var(--han)`; pinyin display 24–30px in `--accent`.
   Weights used: 500, 520, 600, 620, 640 — not 700/bold.
6. **Labels index the page.** Small, tracked uppercase (`letter-spacing:
   0.04em`), `--ink-3`. They are never the loudest thing on a card.
7. **Surfaces.** Page `--paper`; cards `--card` with `1px solid var(--line)`,
   `--radius-lg` (16px), `--shadow-sm`; hover lifts to `--line-2` +
   `--shadow` + `translateY(-1px)`. Inset wells use `--card-2`. Small controls
   `--radius` (10px) or 8px.
8. **Motion is small.** 0.12–0.14s on background/border/transform. No
   bouncing, no spinners where a skeleton or a line of text will do.

## Parts to reuse

| Need | Use |
| --- | --- |
| Page frame | content sits in `.page` via `AppLayout`; start with a `.row` holding `h1` + `.small.muted` subline, `.spacer`, controls |
| Buttons | `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.sm`, `.btn.danger` |
| Choice of 2–5 | `<Seg>` (`src/ui/Seg.tsx`, `.seg`) |
| Filters / toggles | `.chips` > `.chip[aria-pressed]` |
| Grid of big tappable options | `.drill-grid` > `.drill-card` (mark hanzi + name + blurb + figures) |
| A drill screen | `DrillFrame` layout: `.drill`, `.drill-head`, `.drill-stage`, `.prompt-card` |
| Five answer tiles | `.tone-row` > `.tone` (b = mark, span = name, i = hint) |
| Big options with glyphs | `.choice-row` > `.choice` |
| Hear it | `<Say text=… />` (`src/ui/Say.tsx`) — hides itself when there is no voice |
| Character | `<Glyph>` (`src/ui/Glyph.tsx`) |
| Empty state | `.empty` with `.big` single hanzi in `--line-2` (e.g. 空), one sentence, one action |
| Card with header | `.card` > `header` (h2) + `.body` |
| Notice | `.notice` |
| Toast | `useToast()` |

## Touch and small screens (the iPad is the main device)

- Everything reachable only by hover must also work under
  `@media (hover: none), (pointer: coarse)` — iPadOS can report hover.
- Tap targets ≥ 44px for anything used mid-exercise; ≥ 36px for chips.
- Breakpoints the app already uses: 1080 (split → one column), 1024, 860
  (bars wrap), 640 (phones; inputs 16px so Safari does not zoom).
- Grids use `minmax(0, 1fr)` so nothing pushes the page wider than the phone.
- Respect `env(safe-area-inset-*)` on anything pinned to an edge.
- Keyboard: digits for choices, Space/Enter for the main action — and hide
  the printed hints on touch (`.key-hint` is already hidden there).

## Pronunciation visuals (the Pinyin section)

- **The pitch staff.** Tone contours are drawn on a five-line Chao scale
  (1 = lowest, 5 = highest): four hairlines in `--line`, labels 1–5 in
  `.tiny` `--ink-3` on the left. The reference contour is a dashed
  `--ink-3` line, 2px; the learner's is a solid `--accent` line, 3px, round
  caps. Where a syllable was judged, a thin band under it carries the verdict
  colour (jade / accent / gold) — the line itself keeps its own colour.
- **Syllables as tiles.** A syllable is a tile: hanzi (han font) over pinyin
  (accent). The verdict goes on the tile border/background via `data-state`,
  never by recolouring the pinyin.
- **Recording.** One big round record button (≥ 64px), `--accent` fill while
  recording with a soft pulsing ring (opacity only), a live level meter as a
  thin bar. Always show a text state: "Listening…", "Too quiet", "Got it".
- **Honesty.** When a judgement is uncertain (long phrase, noisy input), say
  so in `.tiny.muted` next to it rather than showing a confident score.
- **Explanations** of a sound are short cards: *mouth* (what the tongue/lips
  do), *like English* (the nearest English sound, and how it differs), *the
  usual mistake*. Example words in hanzi + pinyin, each with a `<Say>`.

## Writing style on screen

Plain sentences, second person, no exclamation marks, no emoji in UI text
(the 🔊 on `<Say>` is the one exception). Headings say what is there ("12 to
go over"), not what the feature is called. Code comments follow the file
they are in: prose paragraphs explaining *why*.

## Checking your work

Open the page in the preview at tablet (768×1024) and phone (375×812) sizes
and in dark mode (`data-theme='dark'` via Settings, or `resize_window`
`colorScheme`). Look for: text wider than the screen, a hard-coded colour that
vanishes in dark mode, a control you could only reach by hovering, and more
than one red thing competing for attention.
