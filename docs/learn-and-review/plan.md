# Learn & Review — analysis and implementation plan

2026-09-27. Two parts: **Learn**, a new lesson flow for meeting new characters and words the way mobile apps do it (picture → sound → parts → sentence → exercises), and a **Review overhaul**. They share one exercise engine, so they are planned together.

Constraints carried over from earlier decisions: native audio only (no TTS in drills), real photos and no hanzi drawn over them, words have one scheduled skill (Read it), tests only ask what has been learned, no layout shift, compact one-line toolbars, check at 375–430 px. Pure logic goes in `src/domain`, screens in `src/features`.

## Status — built 2026-09-27

| Step | What | Commit |
|---|---|---|
| 1–2 | Missed cards come back in the sitting (first answer graded only); Forgot / Got it with timing, four buttons behind a setting | fa2650b |
| 3 | Stats page `/account/stats`; `DayLog.ms` + evening `snap`; workspace format **10**; streak with rest day and minutes goal | e2233a5 |
| 4 | Exercise engine (`src/domain/exercises`, `src/features/exercises`), `WritePad` | 2ec84c0 |
| 5 | Learn `/learn` (meet → practise → check), `DayLog.lesson`, Words review due-only, claims 1–4 days | 45a011b |
| 6 | Daily session `/review/session`, leeches taught first, Today steps, Review card + "Practise one skill", Settings → Learning | 6c973ea |
| 7–8 | Stubborn list on Stats, review-load line in Settings | 4369a84 |

Defaults taken for the open questions: 5 new a day (characters and words together), two-button grading, `use` out of the daily session, claims checked in 1–4 days, Hard mode a switch (off), one rest day a week, goal = any work that day.

Differences from the plan below:
- **No Lightning game in Play**: Play (`src/games`, `src/features/play`) is another session's uncommitted work, so nothing here depends on it; the exercise kit is its own (`src/features/exercises`).
- **"Re-learn tomorrow" is "Meet these again"**, now: `/learn?again=c好,w火车` runs meet → practise → check and grades as reviews.
- **The "Stubborn" row is on the Stats page**, not the progress drawer (that file had another session's edits in flight).
- **A wrong claim still counts as a lapse** (unchanged scheduler); only its first answer's weight is full.
- **Mastery still averages four skills** including `use`, though the daily session no longer asks `use`.
- **No click sounds**: the native recording plays when a card settles.
- One-character words (的, 我) are met once, as the character, and the word is graded with it (`twinWord`).

---

## 0. How it works today

### Meeting something new

| Path | What happens | Problem |
|---|---|---|
| **Characters.** Today's step "Meet new characters" opens the Library at `?show=ready`, where you tick characters as learned | `learned/set` → `reclaimed(…, 7 + i%10)` (`src/store/actions.ts:219`): a **claim**, first due in **7–16 days** | Nothing teaches the character. You tick it and the app doesn't ask about it for a week or more. By then the short-term memory is gone, so the first review is really a first meeting, and it goes in the log as a lapse. |
| Recognise drill, "fresh" | `reviewPool` only holds items that already have a record (`drill.ts: reviewPool → hasRecord`), so almost nothing new for `recognise` ever comes out of `freshCandidates` | New characters can only come in by ticking them. |
| **Words.** The Words sitting adds up to *N*/day from collections (`wordReview.ts`) | A new word shows up **with its answer already visible** and two buttons: "New to me" (hard, 0.5 d) and "Knew it" (good, 1.5 d) | You see it once for a few seconds. No picture before the reveal, no parts, no exercise, and it doesn't come back in the same sitting. |

What we already have but don't use when teaching:

| Content | Coverage (HSK 1 / HSK 2) |
|---|---|
| Etymology / hint (`ety.hint`, "A woman 女 with a son 子") | 218/248 · 111/123 |
| Components with glosses (`parts`, `components`) | all |
| Example sentence per character (`sent`) | 248/248 · 123/123 (but **not filtered to known characters**) |
| Word example sentences (`ex`, 2 each) | 288/294 · 188/197 |
| Words a character is in (`words`) | all |
| Look-alikes (`conf`) | 213 · 103 |
| Real photos (`pictures.json`) | 368 words, mostly HSK 1–2 nouns and verbs |
| Native recordings (voice pack) | 355 words and sentences |
| Stroke data (hanzi-writer) | all |
| Radical families page, compound sums "火 + 车 = 火车" | built |
| Game kit (`src/games/kit`: ChoiceGame, Tiles, Photo, Feedback, useRounds, rng) | built, 12 games |

**We already have most of what a Duolingo/HelloChinese/Skritter lesson needs.** What's missing is a flow that puts it in front of you when you first meet something.

### Review

1. **Things you miss don't come back in the same sitting.** The queue is fixed when the sitting starts (`DrillPage` and `WordsDrillPage` `useState(() => plan…)`). An "Again" gets a 30-minute stability and then waits for a future sitting. Mobile apps loop a missed card back 3–5 cards later until you get it right. That in-session repetition is where most first-day learning happens.
2. **Seven separate sittings.** Recognise, Say it, Tones, Look-alikes, In a word, Write, Words. "Go over what is due" chains them one after another. The due count adds up every skill of every character, so 40 characters can read as "120 due". It feels like a chore list, not a session.
3. **The same character in a row.** Nothing stops 好 from being asked as recognise, then sound, then write back to back. Anki calls the fix "burying siblings". The second and third questions are easier than they should be, so they overrate what you know.
4. **Almost everything is graded by yourself, with 4 buttons.** That's the right call for production (say it, write it), but it's slow on an iPad, the grading is generous, and it's dull. Tones and Look-alikes are the only questions the app checks itself.
5. **The first real answer about a character comes a week after you tick it** (see above). Claims are treated as evidence of recall.
6. **"In a word" (`use`) now overlaps with words.** It was built before words were items. A character's `use` record and the word's own `recognise` record now measure much the same thing, and they are scheduled separately.
7. **No leech handling.** An item missed 5 times keeps coming back the same way. `shaky` is counted and shown, and nothing else happens.
8. **No load control.** New words are capped per day (`newWordsPerDay`), but nothing holds new material back when the backlog is large. Characters have no daily cap because they come in by ticking, which has no cap.
9. **Little feedback while you answer.** A progress bar, then a summary at the end. You don't feel a streak of right answers, and you don't see anything move up a mastery band.

The scheduler itself (`memory.ts`, an FSRS-like power curve, 0.9 retention, weighted evidence, per-skill records) is sound. **The overhaul is about what happens around the scheduler, not the maths.**

---

## 1. Learn: a daily lesson

### What it feels like

Today → step 2 "Learn 5 new" → `/learn`. About 6–8 minutes. Three phases in one screen, full-screen like a drill (`data-focus`):

**Phase A: Meet** (one card per item, swipe/Next)

For a **word** (`w火车`):
1. Big photo (where one exists) plus the word in large hanzi, and the native clip plays on its own. If there's no native clip, only the speaker button shows, and it uses the fallback chain.
2. Pinyin with tone colours, meaning, measure words.
3. **The sum**: 火 fire + 车 car = 火车 train, built from the existing compound parts data. Tapping a part opens its character.
4. One example sentence (`ex[0]`), with its pinyin shown after a tap. A native recording plays if there is one.
5. "I already know this" link (grades Good, skips the exercises for it).

For a **character** (`c好`):
1. The character large, with the stroke animation playing once (hanzi-writer is already loaded).
2. Reading with the native clip, meaning.
3. **How it's built**: the components with glosses, and the `ety.hint` ("A woman 女 with a son 子"). For phono-semantic characters: "女 gives the meaning · 子 …". A link goes to its radical family.
4. The words it's in, first the ones you already know, then the HSK 1–2 ones. A photo shows if one of those words has one.
5. An example sentence, picked by a new `sentenceFor()` that prefers sentences whose other characters are all known.

**Phase B: Practise** (about 3 exercises per item, interleaved across the batch, never the same item twice in a row)

The exercises come from the catalog in **section 3**, and the app checks every one. A lesson opens with a **Match the pairs** board for the whole batch. Then each item gets one Easy exercise, then one Normal one (sentence tiles, tone painting, build the word). With **Hard mode** on, the last exercise for each item is a typed one. The lesson ends with a second, faster match board.

If you miss one, the answer shows, and the same exercise type comes back 2–4 cards later with the distractors shuffled. You finish an item when you've answered 2 exercises in a row right on the first try.

**Phase C: Check** (the next day's first recall, pulled into the lesson)

This is a recall question with no help, the same as review would ask. For a word: see it, say what it means (the one self-graded question). For a character: recognise. This sets the first real grade.

- Right the first time and the practice was clean → **Good** (first interval ~1.5 d)
- Missed once in practice → **Hard** (~0.5 d)
- Missed the check → **Again**, and it comes back once more before the lesson ends

Nothing is stored as a claim. The first record is a real answer, so `isLearned` is earned by the next day's review. Exercises inside the lesson are **not** written to the scheduler one by one. Only the Phase C result is, so being taught doesn't count as spaced evidence.

A new domain rule backs this up: a **learning step**. An item graded Hard/Again on its first meeting is due again **the same evening, or at the start of the next session after 4 h**, not after a flat 0.5 d. That's just `FIRST_INTERVAL` tuning plus the in-session requeue in section 2.

### What goes into today's batch

`src/domain/lesson.ts` → `pickLesson(lib, book, collections, settings, now)`:

1. Size = `settings.newPerDay` (default **5**; options 3/5/8/10). This replaces `newWordsPerDay` and covers characters and words together.
2. **Throttle**: if reviews due today > 60, new items are halved; if > 120, it's 0 and the step reads "Catch up first". This is the usual SRS rule for not going under.
3. Order, following decisions already made (words beside characters):
   - Words waiting in word collections (the sweep's "new/unsure" bands first), as `wordPool.waiting` already does.
   - For each word, any character in it that you don't know yet and that is "ready" (parts known, via `readyToLearn`) comes **just before the word**. So you meet 火 and 车, then 火车. That's the mobile-app "unit" feel, built from data we have.
   - Characters with no pending word: `readyToLearn` in band order.
4. The batch is kept for the day under `activity[day].lesson = { ids, done }` so the lesson opened on the iPad and the phone is the same one. A lesson is resumable, and done-today is read from the activity log.

### What Library ticking becomes

It stays, for **"I already know these"** (placement). The claim's first check moves from 7–16 days to **1–4 days**, spread out. The Today step stops linking to the Library and goes to `/learn` instead.

### Placing it

- **Today**: step 2 "Meet new characters" → **"Learn N new"** (`/learn`), minutes ≈ 1.3 × N. It's done when `activity[today].lesson.done`.
- The Words card in Review no longer introduces new words: new words come only through Learn, and the Words sitting becomes due-only. "New" and "due" are different moods, so they get different screens.
- Settings: "New per day" moves into Settings → Learning (replacing Words → new per day).

---

## 2. Review overhaul

### 2.1 One daily review session

`/review` (and Today step 1) runs **one mixed session** instead of seven sittings:

- **The queue is per item, not per skill.** For each item with anything due, it picks the **one skill most overdue relative to its stability**, and the others wait for tomorrow ("sibling burying"). The due count then counts *items*: "32 to review", not 96.
- **Interleave**: characters and words mixed, no two questions about the same character in a row, and no word right after one of its own characters.
- **Budget, not size**: 5 / 10 / 15 minutes (default 10), using the existing `reviewMinutes` estimate adjusted per exercise type. The oldest overdue items go first. What doesn't fit stays due, and the session says so.
- The drill cards stay under "Practise one skill" (collapsed) for focused work. The six drills keep working exactly as now.

`src/domain/reviewSession.ts`: `planReview(lib, book, collections, now, budget) → Card[]`, where `Card = { id, skill, format }`. Pure and tested.

### 2.2 Missed cards come back in the session

A session keeps a working queue. On **Again**, the item goes back in **3–5 cards later** (or at the end if fewer are left), shown in a lighter format (for example, a choice instead of free recall). It repeats until you get it right. **Only the first answer is graded to the scheduler.** The repeats are for learning, not evidence. Same rule as Learn phase B.

`useDrillRun` gains `requeue` and a `firstAnswer` map. The drills that stay separate use it too.

### 2.3 Exercise formats per skill (variety without new skills)

A card's **format** is chosen per card from the catalog in section 3. The choice depends on the skill, on how established the item is, and on Hard mode:

| Skill | Young (s < 7 d) | Established | Hard mode |
|---|---|---|---|
| recognise (char) | pick meaning, match board | recall meaning, self-grade | type the meaning |
| recognise (word) | picture pick, cloze pick, sentence tiles | the word **inside its sentence**, recall | type the word (hanzi keyboard) from English or audio |
| sound | tone painting, listen pick | say it aloud, tone-checked by the mic | type the pinyin with tones |
| write | build the character from parts | write on the square (existing) | same |

Several due items are grouped into **one match board** when they are all young. That's five reviews in one screen, which is the fast, game-like part of mobile apps.

Words still have **only one scheduled skill (Read it)**. Listening and cloze are just ways of asking it, with lower weight, as decided on 2026-09-24. The `PICK_WEIGHT` idea is extended, not new.

### 2.4 Two-button grading plus time

Self-graded cards get **two buttons, "Forgot" and "Got it"**. With "Got it", response time from reveal-to-answer decides the grade: under ~3 s is Easy, 3–8 s is Good, over 8 s is Hard. For choice cards the app grades itself: first try right → Good (Easy if under 2 s); right on the second try → Hard; wrong → Again. The four-button row stays available behind Settings → Review → "Grade with four buttons" for people who want it.

This makes it quicker on the iPad, stops you agonising between Hard and Good, and gives the scheduler more consistent data.

### 2.5 Retire "In a word" as a scheduled skill

Now that words are items, reading a character inside a word **is** reviewing that word. The plan:
- Remove `use` from the daily session and from the due counts. Keep the records, since the mastery bar reads them.
- Mastery counts `use` from the best word containing the character that you know (its `recognise` hold), so the bar still fills.
- Keep the "In a word" drill card for practice, graded at weight 0.5.

### 2.6 Leeches

An item with **lapses ≥ 4 on one skill** is a leech:
- The next time it comes up, the card opens in **teach mode** (the Learn phase A card, compact): parts, hint, a look-alike side by side ("己 vs 已"), then the question.
- The end-of-session summary lists leeches with "Put on paper" (existing collect flow) and "Re-learn tomorrow" (adds it to tomorrow's lesson batch, and it doesn't count toward the new-item cap).
- The progress drawer gets a "Stubborn" row.

### 2.7 Load control and the forecast

- New items throttle on backlog (section 1).
- When the backlog is more than 3× the budget: a "Catch-up mode" banner. It serves the most at-risk items (lowest retrievability × stability) and not simply the oldest due. Items ticked long ago and never answered go last.
- The Today forecast already exists. Add a line under it: "Learning 5 a day adds ~X reviews a day in two weeks", worked out from the scheduler, so the new-per-day setting is an informed choice.

### 2.8 Feedback while answering

Within the calm style (no confetti, no cartoon owl):
- Right: a short green tick on the card, a soft click, and the native clip plays. Wrong: the correct answer is highlighted, with no shake or buzzer.
- A **combo dot row** in the drill head (the last 10 answers as dots), fixed width so nothing shifts.
- **End summary**: "12 moved up" with a mini list of items that crossed a mastery band (new → holding → solid) as `Seal`s, missed items, leeches, and "Next: Learn 5 new" when today's lesson isn't done.
- The ink wall and streak already exist. Learned-today feeds them.

### 2.9 Claims

- Library ticking → first check in 1–4 days (section 1).
- In the daily session, a claim's first question uses the self-graded format and **full weight** (it's the first real evidence). A miss clears the claim without counting it as a lapse, so ticks that were wrong don't turn characters into leeches.

---

## 3. Exercise catalog

Every exercise is **checked by the app**, fits on a phone screen without scrolling, and works with touch and keyboard. There are three tiers. The tier sets both how hard the exercise is and how much a right answer counts toward the schedule:

| Tier | What you do | Weight | Where |
|---|---|---|---|
| **Easy**: pick | tap one of 3–4 | 0.5 | Learn phase B at the start; young items in review |
| **Normal**: build | tap tiles in order, match pairs, paint tones | 0.7 | Learn phase B; young and mid items |
| **Hard**: type | type pinyin, hanzi or English on the keyboard | 1.0 | Learn's last exercise, established items, and everything when **Hard mode** is on |

**Hard mode** is a switch in the session header and in Settings. It swaps each card for its typed version wherever one exists. You're producing the answer, not recognising it, so it counts as full evidence, like a self-graded recall but checked by the app.

### 3.1 Match the pairs *(Normal)*

The Duolingo board. There are two columns of 4–6 cards. Tap one on the left, then its partner on the right. A right pair fades out and plays its native clip. A wrong pair shows red for a moment and then flips back.

- **Pairings**: hanzi ↔ English · hanzi ↔ pinyin · 🔊 native clip ↔ hanzi · photo ↔ word · character ↔ a word it's in.
- **Scoring**: a pair matched without a wrong tap → Good. Each wrong tap involving an item → Hard for that item. Two or more → Again (the item is requeued as a single card).
- **Speed variant ("Lightning")**: 5 boards against a 60 s timer, with a best time kept. It's in Play as a game, not scheduled.
- Card slots keep their place when a pair fades, so nothing shifts.

### 3.2 Build the sentence *(Normal)*

You see the English, "Will you go by train?", plus tiles holding the sentence's **words** (cut by `segment.ts`) and 2 distractor words. Tap tiles into the answer line in order, and tap a placed tile to send it back. Check → it turns green, the native clip plays if there is one, and the pinyin appears under each tile.

- **Source**: the word's `ex` sentences (HSK 1–4, ~95% coverage) and the character's `sent`. Only sentences where **every word but the one being taught is known**. A new `sentenceFor()` filters by the known set, and when nothing qualifies, a different exercise is used instead.
- **Distractors**: look-alike or same-band words of the same kind (a noun for a noun). They must never also make the sentence correct, so no distractor may appear in the sentence already.
- **Alternate orders**: many Chinese sentences allow two orders (time words before or after the subject). Accept any order that matches one of the stored sentences exactly. If an answer is wrong only in time-word position, show "Also possible" and grade Good.
- **Variants**:
  - **Listen and build**: the native clip plays with no English (only for sentences with a recording).
  - **Reverse**: Chinese sentence → build the English from English word tiles. Easier, and good for the first meeting.
  - **Hard**: type the whole sentence with the Chinese keyboard (3.4).

### 3.3 Tone painting *(Normal)*

The word's syllables are shown without tones: huo che. Under each there are four tone buttons (ˉ ˊ ˇ ˋ, plus · for the neutral tone). Paint all syllables, then Check. The native clip plays, and the pitch contour is drawn with the existing staff visual. It teaches tone patterns across a word (3+1, 2+4…), which the learner profile names as the weakest area. Third-tone sandhi is marked as written (nǐ hǎo = 3+3), with a "said 2+3" note after checking.

### 3.4 Type it *(Hard)*

Three kinds of typed answer, each with an input built for it:

**a. Type the pinyin** (you see 火车 → type `huo3 che1`)
- A plain text input with `autocapitalize=off autocorrect=off spellcheck=false`.
- Tones can be typed as digits (`hao3`), as marks (`hǎo`), or with a **tone bar** above the keyboard (ˉ ˊ ˇ ˋ ·, which applies to the last syllable). `v` and `u:` count as ü. Spaces are optional (`huo3che1` works).
- **Checking** goes syllable by syllable: each syllable is right, wrong tone (amber: "right sound, tone 3 not 1"), or wrong sound (red). A tone-only miss grades Hard, not Again, and feeds the weak-spot tallies in Speaking, so wrong tones show up in the pronunciation practice.
- This replaces self-graded **Say it** in Hard mode. It's the first time the `sound` skill gets evidence the app checks rather than you.

**b. Type the hanzi** (you see "train" or hear 🔊 → type 火车)
- An input with `lang="zh-CN"`, used with the iPad/iPhone **Chinese (Simplified) Pinyin keyboard**. The first time, the app explains how to add it: Settings → General → Keyboard.
- The IME shows candidates, so this checks that you can recall the **reading** and then **recognise** the right character among the candidates. That's real production, and it grades `recognise` for words at full weight.
- **Checking**: an exact string match. When it's wrong, the typed and right versions show side by side, with the wrong characters marked (for example 火东 vs 火车, with 东/车 flagged as look-alikes).
- If no hanzi arrives (Latin letters only), the app says "Switch to the Chinese keyboard 🌐" instead of marking it wrong.

**c. Type the meaning** (you see 火车 → type `train`)
- A forgiving match against every sense in `d`, split on `;` and `,`, with articles and "to " removed, case and one typo tolerated, and synonyms from `alt`.
- When nothing matches: "Not matched: *locomotive* vs *train*" with an **"I was right"** button. That grades Good and logs the pair locally so the matcher learns your phrasings.

**d. Dictation** (hardest): hear a native sentence and type all of it in hanzi. Only sentences with recordings, only in Hard mode, and at most one per session.

### 3.5 Quick-tap exercises *(Easy)*

- **Picture pick**: a photo → pick of 4 words (words with a photo).
- **Listen pick**: a native clip → pick of 4 hanzi (no text shown).
- **Meaning ↔ hanzi**: pick of 4. Distractors are look-alikes first, then the same band and length.
- **True or false swipe**: a photo or English with a word underneath. Swipe right for "match", left for "no", or use the ← → keys. About 1 second a card. Good for a quick warm-up burst of 8 young items.
- **Measure word**: 一___火车 → pick 列 / 本 / 个 (from `cl`, for nouns that take a special measure word).
- **Which word has it**: 好 → which of these contains it, shown as word meanings? It connects a character to its words.

### 3.6 Build-it exercises *(Normal)*

- **Build the word**: character tiles, including look-alikes, tapped in order → 火车.
- **Build the character**: component tiles (女 子 口 木) → pick the parts, and it assembles with a stroke animation. Uses the `build-char` game's data. Counts for `write` at 0.5.
- **Fill the gap**: 你坐___去吗？ → pick 3 words (Easy), or type it (Hard).
- **Speak it**: say the word into the mic. The existing tone analysis (`src/domain/pinyin/analyse.ts`) checks the contour against the native clip. Pass/near/miss → Good/Hard/Again for `sound`. Used only when the mic is allowed. There's always a "Can't speak now" skip, which removes speaking for the rest of the session.

### 3.7 Choosing an exercise

`chooseExercise(item, skill, stability, hardMode, recent, available)`:
1. Filter to exercises whose data exists for this item (photo, clip, sentence known-only, 2+ components…).
2. Pick the tier from stability: s < 2 d → Easy/Normal, 2–21 d → Normal/Hard, > 21 d → Hard or self-graded recall. Hard mode moves it up one tier.
3. Don't repeat an exercise type from the last 2 cards (so a session never becomes 10 picture picks in a row).
4. Seeded by item + day, so reloading shows the same card.

Every exercise is one module: `src/domain/exercises/<type>.ts` (a generator that returns `null` when it doesn't fit, a checker, and tests) and `src/features/exercises/<Type>.tsx`. A registry lists them, like `src/games/registry.ts`. Match and Lightning are also listed as **Play** games, so the Play section gains them for free.

---

## 4. Stats page: `/account/stats`

A page you open to *see progress*. It's calm and legible, with the numbers you'd want to show someone. It's linked from the account menu, the streak on Today, and the progress drawer. (`/account` has no route today. `/account` itself redirects to `/account/stats`, and Settings stays at `/settings`.)

### 4.1 What's on it (top to bottom, one column under 900 px)

1. **Today strip**: four tiles showing *new today* (characters · words), *reviews* with accuracy %, *minutes*, *streak* (current · best). Each has a small delta against your 7-day average ("+3 vs usual").
2. **Known over time**: the main chart. A line for **characters known** and a line for **words known**, with a Day / Week / Month switch (30 days / 26 weeks / 12 months). Dotted horizontal goal lines at HSK 1 (248 characters · 294 words) and HSK 2 (371 · 491). Tap a point → "Sep 20: 132 characters, 88 words (+6, +4)".
3. **Learned per day**: bars for new items each day (characters and words stacked) with reviews done as a thin line over them. Same Day/Week/Month switch.
4. **This week vs last week**: a small table with new characters, new words, reviews, accuracy, minutes and days active, and ▲▼ changes. Below it, the **best week** and **best day** records ("Best day: 14 new, Sep 21").
5. **Where they stand**: one stacked bar of known items by mastery band (just met / shaky / holding / solid), with the same bar from 4 weeks ago underneath, so you can see things moving from "holding" to "solid" even on weeks with few new items.
6. **HSK bands**: a progress bar per band (from `progressOf`) with "at this pace: HSK 2 in ~5 weeks", based on the average new items a day over the last 14 days.
7. **Calendar**: the existing `calendar()` heatmap, widened to 26 weeks.
8. **Milestones**: a quiet row of seals: first 50 / 100 / 250 / 500 characters, 100 / 500 words, HSK 1 characters complete, 7 / 30 / 100-day streaks, 1,000 reviews. Each shows the date it was reached. The next one to reach shows as a faint outline with "12 to go".

### 4.2 The data: what exists and what's added

| Number | Source now | Change |
|---|---|---|
| Reviews, right, texts, spoken, videos per day | `activity` (`DayLog`) | none |
| **New per day** | derivable from `Recall.since` (first-met date) | none; computed |
| **Known on day X** | **not stored**: `isLearned` only knows *now* | add a daily **snapshot** |
| **Minutes** | not stored | add `ms` of active time |
| Mastery bands over time | not stored | include them in the snapshot |

**Additions to `DayLog`**:
```ts
ms: number;          // active time in drills, lessons, games, reader: counted while
                     // answering, pausing after 60 s without input (no inflation from an open tab)
learnt: number;      // items that first got a real answer this day (Learn phase C)
snap?: { chars: number; words: number; solid: number; holding: number; shaky: number; fresh: number };
```
- **The snapshot** is written (overwritten) whenever something is graded that day, so each day that had activity holds its end-of-day count. Days with no activity reuse the last snapshot before them, which is right because nothing was learned.
- **Backfill for the past**: before snapshots existed, "known on day X" is **estimated** as items whose `since` ≤ X and that are known now. It's an under-estimate of what you knew then (it misses things since forgotten) and an over-estimate in one way (items learned then but only confirmed later). The chart shows that stretch as a lighter, dashed line with "estimated before Sep 27". It's honest and still shows the curve from day one.
- **Merging** (two devices on the same day): `ms`, `learnt` and counts use max as now. `snap` keeps the one with more answers behind it. Field-by-field max would mix two different moments.
- **Format**: `activityFrom` drops unknown fields, so an older build would strip `ms` and `snap` and save the result back. **Bump the workspace format to 9** so the server refuses saves from older builds (the same `outdated_app` guard as v7/v8).

### 4.3 Engagement, without the noise

- **Daily goal** (Settings → Learning): "Learn 5 and review what's due" by default, or minutes (10 / 15 / 20). The Today ring and the stats strip fill toward it. Streak days count only when the goal is met, or with any activity if the goal is off.
- **Streak kept for rest**: one missed day a week doesn't break the streak if the week has 5 goal days. It's shown as a hollow square on the calendar, not hidden. This is the mobile-app "streak freeze" without buying anything.
- **Weekly note** on Today each Monday, one line: "Last week: 31 new characters, 22 words, 94% right, best week yet." It links to the stats page.
- No XP, leagues or confetti. The seals and the curve going up are the reward.

### 4.4 Code

```
src/domain/stats.ts        knownSeries, newPerDay, weekCompare, records, milestones,
                           pace, estimate-before-snapshots (+ test)
src/domain/activity.ts     DayLog + ms, learnt, snap; merge rule for snap; format v9
src/platform/activeTime.ts useActiveTime(): counts ms while answering, idles after 60 s
src/features/stats/StatsPage.tsx, stats.css, charts (inline SVG, no chart library)
src/app/router.tsx         account/stats (+ account → account/stats)
src/features/auth/AccountMenu.tsx  "Stats" link
```
The charts are inline SVG using the app's tokens. Load the `dataviz` and `hanzi-design` skills before building. Check at 375 px: charts scroll horizontally inside their card, never the page.

---

## 5. Architecture

```
src/domain/
  lesson.ts            pickLesson, lesson phases, finish → grades   (+ test)
  exercises/           one module per exercise (generate → null if unfit, check), registry,
                       chooseExercise, distractors, pinyin/meaning matchers (+ tests)
  reviewSession.ts     planReview (bury siblings, interleave, budget), requeue (+ test)
  grading.ts           choice/self → Rating from (correct, tries, ms) (+ test)
  leech.ts             isLeech, leech list                               (+ test)
  sentences.ts         sentenceFor(char|word, known) — prefers known-only sentences (+ test)
  memory.ts            FIRST_INTERVAL tweak for learning step; claim dueIn 1–4 d
src/features/learn/
  LearnPage.tsx        /learn — phases A/B/C, resumable
  MeetCard.tsx         word card / character card (shared with leech teach mode)
  learn.css
src/features/exercises/  one component per exercise on src/games/kit: MatchBoard, SentenceTiles,
                       TonePaint, TypePinyin (+ tone bar), TypeHanzi, TypeMeaning, Swipe, …
src/features/stats/    StatsPage at /account/stats (section 4)
src/features/review/
  SessionPage.tsx      /review/session — the mixed daily session
  DrillFrame.tsx       + requeue, combo dots, 2-button RatingRow, timing
  ReviewPage.tsx       session card first, drills under "Practise one skill"
src/features/today/    step 2 → Learn; step 1 → session
src/store/
  state.ts             settings.newPerDay (migrate from newWordsPerDay), fourButtons, hardMode, dailyGoal
  actions.ts           activity lesson {ids, done}, ms, learnt, snap; claim dueIn 1–4 d
  migrations.ts        settings rename; workspace format 9 (activity fields)
```

**Syncing**: Learn and stats write `recall` (existing) and new `activity[day]` fields (`lesson`, `ms`, `learnt`, `snap`). `activityFrom` drops unknown fields, so the workspace format goes to **9** and the server refuses saves from older builds (`outdated_app`). Merge rules: `lesson` takes the union of `done` and keeps the earlier `ids`. `snap` keeps the side with more answers. Everything else uses max.

**Reuse, don't fork**: exercises use `src/games/kit` (`Tiles`, `Photo`, `Feedback`, `useRounds`, `makeRng`, `pictureWords`, `gist`). Distractors reuse `confusionChoices`. Tone and write reuse the logic in `ToneDrill` and `WriteDrill`. The char/word cards reuse pieces from `ItemDrawer`/`WordDrawer` (etymology block, sentence block, `WordPicture`, compound sum). Pull these into shared components rather than copying them.

---

## 6. Build order

Each step ships on its own and leaves the app working.

1. **In-session requeue + first-answer grading** (`useDrillRun`) in every existing drill. Small, and the biggest learning win per line of code.
2. **grading.ts + two-button row + timing** (four buttons stay behind a setting).
3. **Stats page** (`/account/stats`): DayLog `ms`/`learnt`/`snap`, format 9, active-time hook, backfill estimate, charts, milestones. It goes early because it starts collecting snapshots, and every day it runs sooner is a real data point instead of an estimate.
4. **Exercise engine**: `sentences.ts` + the exercise registry with tests. First Match the pairs, Build the sentence, Tone painting, Type the pinyin, Type the hanzi. Then quick-taps, Type the meaning, Build the character, Speak it, Dictation. Match and Lightning go into Play.
5. **Learn page**: MeetCard (word, char), phase B with requeue, phase C check, `pickLesson` with throttle, activity `lesson`, Today step 2, settings `newPerDay`. The Words sitting stops adding new words. Claims move to 1–4 days.
6. **Daily review session**: `planReview` (bury, interleave, budget), formats by stability, `use` retired from the daily session, Today step 1 → session, drills collapsed under "Practise one skill".
7. **Leeches**: teach-mode card, summary actions, "Re-learn tomorrow" into the lesson.
8. **Feedback polish**: combo dots, moved-up summary, forecast line, catch-up mode, daily goal and the Monday weekly note.
9. Phone-width and WebKit pass (`scripts/webkit-probe.swift`) on Learn, Session, Summary and Stats, including the Chinese keyboard on an iPad. Update `README`/memory.

Tests: the domain modules are pure and get unit tests the same way as `drill.test.ts`/`wordReview.test.ts`: batch order (characters before their word), throttle, bury siblings, interleave, requeue positions, rating from time, leech threshold, sentence filtering, pinyin input parsing (digits/marks/v/no spaces), meaning matcher, tile-order acceptance, known-series and backfill estimate, week comparison, milestones.

---

## 7. Later (not in this plan)

- **Claude-written mnemonics and known-only example sentences** for items that lack them. Generate them per lesson batch through the existing headless-CLI path, cache them in the store as the video pack does, show "written by Claude" on them, and let the user edit them. Worth it once the flow exists, but not needed for the first version: HSK 1–2 coverage from data is already ~90%.
- More photos for HSK 2 verbs and adjectives (the pipeline in `scripts/images/`).
- A native clip for every example sentence in HSK 1–2 (Tatoeba audio, fetched with the voice pack pipeline).
- Recall test sheet "meaning → write the word" (an older follow-up).

## 8. Open questions (defaults assumed above)

1. New per day: **5 items (chars + words together)**. Or keep separate caps?
2. Two-button grading by default, with four buttons as an option. Or keep four?
3. Retire `use` from daily review (drill kept for practice). OK?
4. Library "mark learned": first check moves from 7–16 days to 1–4 days. OK?
5. Hard mode: a switch you turn on yourself (default off), or automatic for established items (> 21 d) even when off?
6. Streak: allow one rest day a week (with 5 goal days), or strict?
7. Daily goal: "learn N + clear due" (default), or minutes?
