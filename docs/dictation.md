# Dictation

In 写 Write, under "Copy out the text": the device voice says a sentence of
the text, the learner writes it in the notebook without seeing it, then taps
"Show it" to check by eye. Built 2026-10-21 (`src/features/reader/Dictation.tsx`).

Decided on review:
- Inside Write, not a part of its own.
- A sentence at a time (a line of the text); punctuation is not dictated.
- No marking of mistakes: the notebook is where the checking happens.

What there is:
- A square per character, empty until shown, so the learner knows how much to
  write; then the sentence with pinyin and English. The squares never move.
- Say it again as often as wanted, Slow or Normal. The first sentence is said
  by the tap that opens it (iOS speaks only inside a tap).
- Back and Next; Space replays, Enter shows then goes on, arrows move.
- Progress in `study.dictated` (sentences done, merged by max), resumed where
  it stopped; a third of the Write part's tick, beside the new characters and
  the copying out.

Not done: the iPhone's own voice (Han) — Speak needs the text selected on
screen, and dictation hides it.
