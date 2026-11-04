# The new Speak (Phrases), behind Settings › Speak

Switched by `settings.speakV2` (the account's, so the iPad and the iPhone
agree). Off, `/speaking` and `/speaking/say/:source` are Phrases as they were
(`src/features/pinyin/PhrasesPage.tsx`, `LineStudio.tsx`); on, they are
`src/features/speak/`. The other tabs (Voices, Talk, Tones, Your tries) are
the same either way.

## What the section is for

One learner, HSK 1–2, 20–30 minutes a day: say real lines from the texts they
read, find out which sounds and tones were off, and fix them — the loop is
*hear → say → fix*, many times a sitting, mostly with the thumb on a phone.

## What was wrong with Phrases

- **Hearing depended on a whole-text reading.** A text no narrator had read
  (the everyday phrases, a new text) had no example until the whole text was
  read (up to a minute). Slowly was the reading stretched by `playbackRate`.
- **Too much on the line screen**: Repeat/Shadow, Slowly, Marks, a "which
  saying is shown" line, Score the voice, a Tries drop-down, then the verdict
  and a strip of cards with three numbers each. The work left — which words
  to fix — was the hardest thing to see.
- **Seeing a fault was the end of it**: nothing to practise one word with.
- **The line opened on the best try from before**, so "what I just said" and
  "my best" were mixed up; "Mine" was greyed for any try from before.
- **What keeps going wrong** on the first screen could be read, not done.

## What the new one does

- **Any line, any word, in the narrator's voice** (MiniMax). A text read whole
  is cut by its timings; anything else is read on its own as a one-line text,
  which the server keeps (`POST /api/narration/texts`, keyed by the narrator
  and the words) — paid once. **Slowly** is MiniMax reading it at 0.7 of the
  narrator's speed (`speed` on that request, kept apart), so the tones keep
  their shape. The current and next line are fetched as a line opens.
- **A line plays as it opens** after a tap (Next, Back, a segment, Start):
  Next is all it takes. Off in the voice sheet. Never into a recording.
- **The result is a number, a sentence, and the words to fix** — only those,
  in the order of the line (`fixesOf` in `src/domain/speak.ts`), each with the
  example word (a native recording from the voice pack when there is one, else
  the narrator), the learner's own syllables, and **Practise**: a sheet that
  scores the word alone (SpeechSuper) until it is green, every try's number in
  a row. Word tries are kept as drill tries (`fix:<word>`), not lines.
- **The line itself** marks the wrong part of each pinyin in red with a short
  tag (zh→z, tone 3→2) in a row that is there before any result. A tap on a
  character opens its word in the drawer, as everywhere.
- **Pace** from SpeechSuper: the pauses inside the line, a very slow or quiet
  recording, said in a sentence.
- **The best before** is the number to beat ("6 up on your best before"); the
  best try itself opens with *Show it*.
- **The first screen** leads with Carry on, then *To work on*: the lines not
  yet green, and each fault that keeps coming back — each a sitting of its own,
  its lines frozen when it starts (`keepSet`) so a line turning green does not
  shift the rest. The end of a text offers the lines not yet green again.

## Checked

`npm test`, `npm run vercel-build`; Playwright in Chromium with the APIs
stubbed (the scoring, MiniMax) at 375, 768 and 1024, light and dark: home,
a line before and after scoring, Practise, the voice sheet, the drawer from a
character, Next with the example fetched, the end of a text, the lines to say
again, no narrator, MiniMax refusing the key, Shadow. **Not seen in Safari**:
the example is played through Web Audio woken in the tap, as the learner's own
recording already was — worth a look on the iPhone and iPad before the switch
becomes the default.

## To remove the old one later

Delete `PhrasesPage.tsx`, `LineStudio.tsx` and what only they use, route
`/speaking` and `/speaking/say/:source` to `SpeakHome` / `SpeakSay`, and drop
`speakV2` from the settings (and its toggle).
