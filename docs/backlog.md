# Backlog — the app outside the game

Open work and unconfirmed defaults for the learning app's features. The game
走走 keeps its own list in `world-game/STATUS.md`; the ordering games' list is
`ordering-game/plan.md` §13.

## Cards (`/cards`, `/cards/session` — built 2026-10-20)

The cards are the one way to practise. The drills, the daily review and the
lessons of new characters (`/learn`, `/review/session`, `/review/:drill`,
`/review/words`) were removed on 2026-10-21; their addresses go to Cards. What
stayed under /review: marking a printed sheet (linked from Lists to print) and
sorting the HSK words (linked from the Cards tab).

Defaults taken without the learner's answer — confirm or change:
- 20 cards a day, 5 new words a day; the kinds asked chosen on the Cards tab.
- `use` is never asked any more, **but mastery still averages all four skills
  including `use`**, so mastery can lag for items that are never asked `use`.
- Library "mark learned": first check in 1–4 days (was 7–16).
- Streak: one rest day a week allowed. Daily goal: any work that day counts.
- A wrong claim still counts as a lapse (only its first answer's weight is full).

Ideas offered and not started: a text to reread on Today after a few days;
fill-the-gap cards from the learner's own texts; repeat-after-the-voice per
line with the pitch chart; "you know 88% of this one" for the next text.

Later, not started:
- Claude-written mnemonics and known-only example sentences for items without
  them (headless-CLI path, cached, marked "written by Claude", editable).
- More photos for HSK 2 verbs and adjectives (`scripts/images/`).
- A native clip for every HSK 1–2 example sentence (Tatoeba audio).
- Recall sheet "meaning → write the word".

## Videos (`/videos` — built 2026-09-25)

- Whisper transcripts and still frames for Claude (the Mac jobs) are not
  built; a video without YouTube captions needs its text pasted in.
- "From memory" recall was never built (Write and Say it were built, then
  removed at the learner's request on 2026-09-26).
- The voice pack still carries the old shadowing sentences' audio; only the
  screens were removed.
