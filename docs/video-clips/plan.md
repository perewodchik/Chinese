# Videos — plan (second version)

Written 2026-09-25, and built the same day. What differs from the plan:

- **Write** (line-by-line player) and **Say it** were built and then removed
  at the user's request (2026-09-26): the video is watched on Watch and the
  notebook checked on Check. *From memory* was never built.
- Whisper transcripts and still frames for Claude (the Mac jobs of phase 4)
  are **not built**. A video YouTube will not give captions for is pasted in,
  or kept as a link that fills itself in when opened where YouTube answers.
- Names are recognised without Claude too: words the captions' pinyin groups,
  and pairs of characters the transcript keeps repeating (`transcriptWords`).
- The voice pack still carries the old shadowing sentences as audio; only the
  shadowing screens were removed.

The learner watches Chinese videos (YouTube: Peppa Pig with learner
subtitles, Mandarin Click's Slow Chinese Stories, Chinese with Mei…) and works
on them with **a paper notebook**: the pinyin is written **by hand**, never
typed. The app's job is everything around the notebook:

- a shelf of videos, each showing **how well it fits my level**;
- adding new ones from a link;
- playing a video line by line while I write;
- afterwards, **the correct pinyin**, on which I **tap what I got wrong** —
  red, with a small box beside it for what I actually wrote — and when I
  finish, everything I did not tap turns **green**;
- scores and weak spots from those marks;
- the new words and characters into my learning lists;
- questions to Claude about the video.

Every activity on a video is **optional**, and progress can be **marked in
several ways**, from a detailed syllable check down to a single tap.

Changes from the first version: a **Videos tab** of its own (not under
Speaking); dictation is checked **against the notebook** instead of typed; the
**old shadowing is removed entirely**; recall-from-memory and shadowing by
line become optional extras, not required steps.

---

## 1. Removing the old shadowing

The 30 native sentences, the *In context* cards and the *Monthly check* go.

| What | Where | Change |
|---|---|---|
| Shadowing page, history, context cards, monthly check | `features/pinyin/ShadowPage.tsx`, `ShadowHistory.tsx`, `ContextCard.tsx`, `BenchmarkCard.tsx`, `benchmark.ts`, `shadow.css` | delete |
| Route `/speaking/shadow` | `router.tsx`, `paths.ts` | redirect to `/videos` |
| "Whole sentences" block and the weekly "understood sentences" number | `PinyinPage.tsx` | remove |
| Weak spot that links to shadowing | `WeakSpots.tsx` | link to the sound lesson instead |
| Today step "say sentences out loud", week stat "sentences said" | `TodayPage.tsx`, `domain/today.ts` | replace with the video step (§9) |
| The pack's sentences | `scripts/voices/build.ts`, `shadowing.json`, `public/voices/sentences.json`, their CREDITS lines | stop building, delete the files |
| Said log (`hanzi.understood.v1`, `progress.ts`) | localStorage | code kept (the optional *Say it* extra writes to it); nothing is erased |

Word recordings, sound lessons, tone lab, weak spots and conversation stay as
they are.

## 2. The Videos tab

- A new top-level tab **Videos**, beside Speaking. Routes:
  - `/videos` — the shelf
  - `/videos/add` — add one
  - `/videos/:id` — one video (`?part=2`, `?do=write|check|words|ask|say`)
- `paths.ts`: `videos()`, `addVideo()`, `video(id, at?)`.
- Checked at phone width (tab bar still fits) and in WebKit.

## 3. A video, as stored

A new synced field `videos` in the workspace (**format 9**; migration adds an
empty list), so the iPad and the Mac share the shelf.

```ts
interface Video {
  id: string;                          // `yt:<videoId>` or `own:<uuid>`
  source: { kind: 'youtube'; videoId: string } | { kind: 'other'; url?: string };
  title: string; channel?: string; seconds?: number; thumb?: string;
  added: number;
  lines: VideoLine[];
  textFrom: 'captions' | 'captions-auto' | 'pasted' | 'machine';
  /** the lines split into sittings; a 5-minute video is usually two or three parts */
  parts: Array<{ from: number; to: number }>;
  status: 'want' | 'working' | 'done' | 'shelved';
  marks: VideoMarks;                   // §7
  checks: DictationCheck[];            // §6, every check kept
  asks: Array<{ q: string; a: string; at: number }>;
}
interface VideoLine { at: number; end: number; zh: string; py: string; en?: string }
```

A 5-minute transcript is a few KB; the workspace limit is 16 MB.

## 4. Fits my level

`src/domain/videoFit.ts` — pure, tested — worked out from the transcript and
the current memory on every render, never stored, so a video's fit improves as
words are learned.

- Words from `segment()` (the reader's cut); known / learning / new via
  `wordKnowledge()`; names and interjections (佩奇, 哈哈) not counted.
- **Coverage**: the share of running words known or learning.
- **New words**: distinct unknown words, *in my band or the next* (worth
  learning) and *above it* (story words like 魔法棒). New characters the same.
- **Speed**: Han characters per second of speech, from the caption times —
  *slow* (< 3), *natural* (3–5), *fast* (> 5).
- **Verdict**: **Easy** ≥ 95% · **Good stretch** 88–95% · **Hard** 75–88% ·
  **Too hard for now** < 75%.

Shelf card: thumbnail, title, fit chip + coverage bar, "12 new words", speed
chip, length, status and marks (§7) as small icons. Sort **Best fit** ·
**Recent** · **In progress**; filter by status.

## 5. Adding a video

`/videos/add`: paste a link (watch, youtu.be, `&list=…&index=…`, shorts).

1. The server fetches the captions (`GET /api/videos/youtube/:id`): manual
   `zh-Hans`, then `zh`, `zh-Hant`, then auto-generated Chinese (flagged). An
   English track fills `en`. Captions that carry `汉字 / pinyin / English` in
   one line (the Peppa channel) are split.
2. **Pinyin for every line**: from the captions when they have it; otherwise
   from the word list's readings through `segment()` (which settles most
   polyphones, 行 in 银行 vs 不行), and the character's reading otherwise.
   Shown with **dictionary tones** (see §6 for sandhi). A line's pinyin can be
   corrected by hand, or by asking Claude.
3. **Preview**: the fit (§4) and the first lines, then *Add* / *Not now*.
4. **No Chinese captions** (Mandarin Click burns them into the picture):
   paste the text or load an `.srt`/`.vtt`; later, transcription on the Mac
   (§11).
5. **Parts**: split automatically into sittings of about 25 lines, breaking at
   pauses; editable.

Starter suggestions on an empty shelf: the Peppa episodes and Mandarin Click
stories looked at on 2026-09-25.

**Risk, tried first:** YouTube often refuses caption requests from cloud
servers (Vercel). The Mac will work. If Vercel is refused, a link added on the
iPad is kept as *waiting for text* and the Mac fills it in when its server
next runs — or the text is pasted.

## 6. Writing it out in the notebook, and checking it

The core of the method, and entirely optional.

### 6.1 Writing
- The part's lines are **numbered** (1, 2, 3…), and the same numbers are used
  when checking, so the notebook and the screen line up. Tip on first use:
  number the lines in the notebook too.
- The player (embedded YouTube, §8) plays **one line at a time**: big ▶ for
  the current line, ↻ to hear it again, → next line. No text on screen, and no
  keyboard — the pen is the input.
- Or *Play the whole part* for those who write while it runs.
- **I've finished writing** → checking.

### 6.2 Checking — the screen that matters most
The part's correct pinyin, line by line, each syllable a tappable chip, the
line number on the left; hanzi small above (can be hidden), English hidden
behind a tap.

1. **Tap a syllable I got wrong** → it turns **red** and a small box opens
   right beside it: *What did you write?* I type what is in the notebook
   (`ji`, `zhi2`, `jì`, or nothing if I left a gap) and press **Enter**. The
   box closes; my version shows under the red syllable in small letters.
   Tapping a red syllable again reopens its box or clears it.
2. **Tap a line number** → the whole line is red (*I missed this line*).
3. A small **+** between syllables for something I wrote that is not there
   (an extra syllable).
4. **Done** → every syllable I did not tap turns **green**, and the summary
   appears.

The box floats over the text (no reflow — the lines never jump), stays inside
the screen at phone width, and is sized for the iPad keyboard. Enter moves the
focus back to the text, not to another box.

### 6.3 What the app makes of it
`src/domain/dictation.ts`, pure and tested. For each red syllable with what I
wrote:

- **tone** — same sound, wrong tone (`shi4` for `shì`… written `shi2`)
- **initial** — `ji` for `zhi`, `c` for `ch`
- **final** — `-n` for `-ng`, `u` for `ü`
- **missed** — nothing written
- **extra** — written, not there
- **unknown** — red with nothing typed in the box

Tone sandhi is not held against me: writing 2 for a 3rd tone before another
3rd tone (你好 → ní hǎo), or the changed tones of 一 and 不, counts as *heard
right* and is shown in grey, with a line saying why.

Summary: *43 of 52 syllables right (83%) · 4 tones · 3 initials · 2 missed*,
and the confusions by name — **zh → j ×2**, **-ng → -n ×1** — each linked to
its sound lesson. They are also added to the **weak spots**
(`domain/pinyin/weakSpots.ts`), so a confusion found in the notebook shows up
on Today and in Speaking like one found by the microphone.

A part can be checked again later (a second go in the notebook a week on);
every check is kept, and the video shows the first and the latest score.

### 6.4 Other ways to mark (§7)
The same checking screen, with less detail, for days when there is less time:

| Way | What I do | What is kept |
|---|---|---|
| **Detailed** (default) | tap wrong syllables, write what I wrote | kinds of mistakes, weak spots |
| **Quick** | tap wrong syllables, no box | score, which syllables |
| **By line** | each line: ✓ right · ~ nearly · ✗ wrong | line scores |
| **Overall** | one tap: *all · most · half · little · none* | a rough score |

A chip at the top of the checking screen picks the way; the choice is
remembered.

## 7. Marks on a video

Each video carries marks I can set by hand, and that the app fills in itself
when an activity shows them:

| Mark | Set by hand | Set by itself when |
|---|---|---|
| **Watched** (count) | + | the whole part has been played |
| **Understood** | 1–5 after watching | — |
| **Written out** | ✓ | a dictation check is saved |
| **Words taken** | ✓ | new words were added or waved off |
| **Can say it** | ✓ | *Say it* (§10) got every line understood |
| **Status** | Want to watch · Working on it · Done · Put aside | *Working* once anything is marked |

Nothing requires anything else: a video can simply be watched and marked
*Understood 4/5* and *Done*.

## 8. The player

YouTube embedded (`youtube-nocookie.com`, IFrame API) so one line can be
played exactly (`at` → `end`) and repeated. Natural speed only. Needs the CSP
in `vercel.json` and the server's static headers to allow
`frame-src https://www.youtube-nocookie.com`, `script-src https://www.youtube.com`
and `img-src https://i.ytimg.com`. Also a link *Open in YouTube* for watching
there.

## 9. Words, Today, the rest of the app

- **Words** (`?do=words`): the part laid out like the reader's passage — pinyin
  over each word, unknown words marked, tap a word for its card. A strip
  *New in this video* lists the new words in my band first, each with **+**
  (add) and **✕** (not now). Added words go to one collection, **Words from
  videos**; *Select* mode picks words and characters in the text for the same.
  Words not on the HSK lists (魔法棒) become custom word items with the line as
  their example and the CC-CEDICT meaning.
- **Today**: the old "say sentences out loud" step becomes *"Your video: check
  part 2"* — shown only while a video is *Working on it*, ticked off from that
  video's own marks. Week stat: *parts checked*.
- **Conversation**: *Talk about this video* on a done video starts a talk with
  its words as the learning words.

## 10. Optional extras on a video

- **Say it** — line by line: hear it, say it, speech recognition says whether
  it was understood (`compareHeard`, the said log). The only piece of the old
  shadowing that survives, and only here, on the video's own lines.
- **From memory** — the English of a line, say the Chinese.

Both stay out of the way: a link on the video page, not steps.

## 11. Claude and the video

### 11.1 What Claude can and cannot see
Claude cannot watch a YouTube video: headless Claude Code runs with its tools
off, and a claude.ai chat cannot play one either. So **the app gives Claude
the video as text**: title, channel, description, and the full caption
transcript with line numbers and times. That is everything that is *said*,
which is what the notebook work is about.

**Pictures, later and optional** (Mac only): a few still frames, one per scene
at the line times (yt-dlp + ffmpeg on the Mac), attached to the prompt, so
Claude can tell who is speaking and what is on screen. On the iPad relay I can
attach screenshots to the chat myself.

### 11.2 The study pack — one ask per part
When a part is first opened (or with **Prepare with Claude**), Claude is asked
once for a **study pack**. It is stored on the video and synced, and the rest
of the video page is built from it:

| In the pack | Used for |
|---|---|
| `lines`: checked pinyin, English, who speaks, doubtful captions | the **checking screen's** pinyin (better than the dictionary: polyphones in context), English under a tap, *caption may be wrong* marks |
| `sandhi`: where what I hear differs from the written tones | forgiving 3-3, 一, 不 and neutral tones when checking (§6.3) |
| `words`: new words, *learn now / later / skip*, meaning here, lines | the **New in this video** strip, in that order; *skip* hidden (names, sound effects) |
| `grammar`: 2–5 patterns with lines and a new example | a **Grammar** card; tap a line reference to jump to it |
| `notes`: particles, set phrases, culture, how people really say it | a **Good to know** card |
| `listening`: the hardest lines to write and why, for my weak sounds | shown **before writing** as "listen for…" |
| `questions`: 6 comprehension questions easy → *why*, with answers | a **Questions** step: answer out loud or on paper, show the answer |
| `extra`: everyday sentences using the new words, a talk topic | **Use it** card; *Talk about this video* starts the conversation with that topic |
| `level`: Claude's own verdict and why | next to the computed fit (§4) |

On the Mac the pack is asked through `/api/ask` (new kind `video`, 5-minute
limit). The server keeps each answer for an hour by the prompt's hash, so
leaving the page while Claude writes does not lose it. On the iPad it is the
relay: copy the prompt, paste into Claude, paste back the JSON block, the same
as the reading sessions (`parse.ts`'s tolerant fence/JSON reading). A new
`src/domain/videoPrompt.ts` + `videoPack.ts` (parser with a check that every
line number exists and every pinyin has one syllable per character; bad
entries dropped, not the pack).

### 11.3 The study-pack prompt

```text
I'm learning Mandarin Chinese and want to study a video I've just watched. I work with a paper notebook: I write down the pinyin of each line by hand while it plays, then check it, learn the new words and talk about it. Please prepare a study pack for one part of it.

## Me
- Level: HSK {band} (2026 syllabus), 20–30 minutes a day. My first language is Russian; explain in simple English.
- Words I know: {known words}
- Words I'm learning: {learning words}
- Characters I can read ({n}): {characters}
- Sounds I often get wrong: {weak spots, e.g. zh heard as j; -ng as -n; 3rd tone in pairs}

## The video
- "{title}" by {channel}, {length}. Description: {description, first 500 characters}
- Captions: {made by the channel | auto-generated, may contain mistakes | pasted by me}
- The part I'm working on: lines {from}–{to}. The numbers are the ones in my notebook, so keep them.

Transcript (number · start time · Chinese | pinyin from the captions, if any | English from the captions, if any):
{n} {mm:ss} {zh} | {py} | {en}
…

## Rules
- Work only from the transcript (and any pictures I attach). Don't add events that aren't in the video.
- Always refer to lines by their numbers.
- If a caption line looks mis-transcribed, say so in caption_doubt; don't change the Chinese.
- Pinyin: tone marks, dictionary tones (not the changed ones), one syllable per Han character, spaces between words, neutral tone unmarked.

## What I need
1. lines — for every line in the part: pinyin; a natural English translation; who says it, if you can tell; caption_doubt if needed.
2. sandhi — lines where what I'll hear differs from the written tones (3rd + 3rd, 一, 不, neutral tones, syllables merged at speed), with what I'll actually hear.
3. words — words in this part that aren't in my known list: word, pinyin, meaning here, HSK level or "off-list", line numbers, and one of learn_now (useful at my level, at most 15, most useful first), later, skip (names, sounds, one-off story words). Also known words used here in a new sense.
4. grammar — 2–5 patterns this part uses: the pattern, line numbers, one sentence of explanation, and one more example that uses only words I know.
5. notes — short and useful things that aren't grammar: what particles like 啊 吧 呢 do here, set phrases, culture, how people say it in daily life, anything surprising.
6. listening — the 3–5 lines hardest to write down and why, especially for my weak sounds: what to listen for.
7. questions — 6 questions in simple Chinese (with pinyin and English), from easy (who / what / where) to one "why", each with a short answer and its line numbers; plus one retelling task: tell it in 3–4 sentences using named learn_now words.
8. extra — 3–5 everyday sentences for the same situation, made from my known words plus the learn_now words; and one topic for a conversation about this video.
9. level — easy, good stretch, hard or too hard for me, and one sentence why.

## Answer format
One JSON code block and nothing else — I paste it straight into my app:
{schema: lines[{n, py, en, who?, caption_doubt?}], sandhi[{n, heard, why}], words[{w, py, en, hsk, lines, verdict}], new_senses[…], grammar[{pattern, lines, explain, example{zh, py, en}}], notes[{text, lines?}], listening[{n, why}], questions[{zh, py, en, answer{zh, py, en}, lines}], retell{zh, en, words}, extra{sentences[{zh, py, en}], talk_topic}, level{verdict, why}}
```

Sizes: a 25-line part plus the word inventory is about the size of a reading
session's prompt (≈15k characters); the pack comes back in 1–3 minutes.

### 11.4 Smaller asks, on demand
All carry the part's transcript and my level, and are kept in the video's
thread (`asks`):

- **Explain this line** — from a line's ⋯: word by word, the grammar, how it
  sounds at speed.
- **After checking** — sent my marks from §6 (what I wrote vs the right
  syllable): the pattern in my mistakes, why, and 3–4 minimal pairs from this
  video's words to listen for (*zhī / jī*).
- **Check my answer** — for a Questions item I said or wrote: right, nearly,
  wrong, with the fix (as the reader's Check Answer, kind `check`).
- **Ask anything** — a free box, with the pack's notes included so it doesn't
  repeat itself.
- **Fix the pinyin of line n** — when I think the pack is wrong; the answer
  replaces that line's pinyin after I confirm.

Nothing is sent to Claude unless I open a part or press a button.

## 12. Phases

| # | What |
|---|---|
| 0 | Try the risky parts: captions from the Mac and from Vercel for the four videos looked at; the embedded player looping one line on the iPad under the CSP |
| 1 | Remove the old shadowing (§1); Videos tab; store (format 9); `videoFit.ts`; adding with preview and paste fallback; the shelf |
| 2 | Video page: player line by line, parts, **writing and checking** (§6) with all four ways of marking, `dictation.ts` with sandhi, weak spots, marks (§7); **the study pack** (§11.2–11.3), since the checking screen reads its pinyin and sandhi |
| 3 | Words (§9) from the pack, Grammar / Good to know / Questions / Use it cards, Today step, progress across videos |
| 4 | Smaller asks (§11.4); Say it / From memory; Mac jobs (fill waiting videos, Whisper for burned-in subtitles, still frames for Claude) |

## 13. Defaults taken (say if wrong)

- New words go to one shared **Words from videos** collection.
- If Vercel cannot fetch captions, the Mac fills them in later, or the text is
  pasted.
- Checking shows dictionary tones; sandhi is forgiven, not required.
