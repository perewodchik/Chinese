# Dictation — requirements, for review

A part of the text page: the voice says a sentence, the learner writes it in
the notebook, then checks it against the text. Listening and writing at once,
from a text already read — the step after Copy out, which copies from what is
seen.

## Where it lives

- In **写 Write**, next to "Copy out the text": a second button, "Dictation".
  A full-screen sitting like Copy out (same header: close, progress, count).
- Only from a text the learner has opened; nothing on Today until it has been
  used once (then the text's Write tick counts it, see Progress).

## A sitting

1. **Hear.** The sentence is read in the chosen voice (the Listen part's
   choice: the device voice, or the iPhone's own Speak, see below). Nothing of
   it is on screen — only the line number and how many characters it has, as
   empty 田字格 squares, so the learner knows how much to write.
2. **Again, as often as wanted.** "Again" replays the whole sentence; "Slower"
   replays it at 0.75; "Part" splits a long sentence at its commas and plays
   one piece at a time. Help is free: nothing counts against the learner.
3. **Write** in the notebook. The app waits; no timer.
4. **Check.** "Show it" fills the squares with the sentence, pinyin above.
   Each character can be tapped to say "I got this wrong"; tapping it again
   takes it back. Default: all right.
5. **Next** goes to the next sentence. Back returns to the previous one.

Keyboard on an iPad: Space replays, → next, ← back, Enter shows/next.

## Unit

- **By sentence** (default) — a line of the text.
- **By phrase** — the sentence cut at ，、；：, for long lines or a slower day.
- Punctuation is not dictated; it is shown in the check.

## The voice

- The device voice, as in Listen, at the Listen part's speed.
- **The iPhone's own voice (Han etc.)** cannot be started by the page. With
  "Your iPhone's voice" chosen, the sentence is put in a hidden-from-view but
  selectable strip and selected; Speak in the system menu reads it. Ugly but it
  is the only way to Han in Safari. To review: worth it, or device voice only?

## What it records

- Per text: `study.dictated` — the line indexes done, and for each the
  characters marked wrong (as offsets). Merged like the other study fields
  (union of lines; the latest marks per line).
- Characters marked wrong more than once across dictations go onto the text's
  shelf as "learning" (the same as "Learn this word"), so they reach the cards.
  To review: automatic, or a list at the end with "Add these to my cards"?

## End of a sitting

- "The whole text, written from dictation", how many characters marked wrong,
  the wrong ones listed big with pinyin and meaning, each tappable (word
  drawer), and "Add to my cards" for them (if not automatic).
- "From the start again" and "Done".

## Progress

- The Write part's tick becomes thirds: new characters written, copied out,
  dictated. Or dictation gets its own tick in the parts bar (听写). To review.
- Resume where the last sitting stopped, like Copy out.

## Not in the first version

- Typing or handwriting on screen to be checked automatically (the learner
  writes on paper).
- Dictating texts not on a shelf, single words, or the cards' words.
- Recording the learner reading their dictation back.

## Questions for review

1. Button inside Write, or its own part (听写) in the parts bar?
2. Han via selection + Speak inside dictation — keep or drop?
3. Wrong characters to cards: automatically, or offered at the end?
4. By phrase as an option, or always by sentence?
5. Should the sentence's English be shown before hearing (easier) or only in
   the check?
