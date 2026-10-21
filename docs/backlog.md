# Backlog — the app outside the game

Open work and unconfirmed defaults for the learning app's features. The game
走走 keeps its own list in `world-game/STATUS.md`; the ordering games' list is
`ordering-game/plan.md` §13.

## Cards (`/cards`, `/cards/session` — built 2026-10-20)

The cards are the one way to practise. The drills, the daily review and the
lessons of new characters (`/learn`, `/review/session`, `/review/:drill`,
`/review/words`) were removed on 2026-10-21; their addresses go to Cards. What
stayed under /review: marking a printed sheet (linked from the top of the Library) and
sorting the HSK words (linked from the Cards tab).

Defaults taken without the learner's answer — confirm or change:
- 20 cards a day, 5 new words a day; the kinds asked chosen on the Cards tab.
- `use` is never asked any more, **but mastery still averages all four skills
  including `use`**, so mastery can lag for items that are never asked `use`.
- Library "mark learned": first check in 1–4 days (was 7–16).
- Streak: one rest day a week allowed. Daily goal: any work that day counts.
- A wrong claim still counts as a lapse (only its first answer's weight is full).

## Library (`/library`, `/library/:set` — rebuilt 2026-10-21)

Every set in one place (your lists, HSK bands, topics) with one page for a
set; Lists to print folded in, /collections redirects to /library. Plan and
reasoning: `docs/library-concept.md`.

Open:
- A topic's character shows the character's own first sense (面 "face" in
  Food & drink, 包 "wrap"): the word sense would be better, but a character
  belongs to several words and there is no rule yet for which one a topic
  means.
- The word lists made from a band's words (`wordset-hsk-N`) show as lists of
  their own rather than under their band.
- Full screen walks the characters of the set page underneath; opened from
  anywhere else it holds the one character.
- Not seen in Safari: the full-screen square (container query units), swipe.

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
