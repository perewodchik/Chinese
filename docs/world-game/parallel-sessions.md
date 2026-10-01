# 走走 — what's left, in parallel sessions

Paste-ready prompts for the §13 work still open in `STATUS.md`. Waves 1 (S1,
the bike, city sounds, the map plan) and S2–S4 have landed.

**On hold: chapters 5–10 are frozen** until the learner has reviewed chapters
1–4 (2026-09-30). Don't start these sessions until they say go.

| Wave | Start when | Sessions (run at the same time) |
|---|---|---|
| **2** | the learner unfreezes chapters 5–10 | **F** S5 · **G** S6 + S7 · **H** S8 |
| **3** | F–H have landed (L: after I) | **I** S9 + S10 · **J** U5 + U6 · **K** U7 + U8 · **L** U9 + U10 |
| **4** | everything above has landed | **N** V5, then Z9 (one session, in order) |
| — | with the learner | X12 play-through |

**Why this order**
- **S tracks are split by district.** Each chapter's content lives in its own `content/world/<district>/` files, so two sessions never write the same `scenes.json`.
- **U waits for the chapters it lives in.** Substory episodes sit on chapter routes (story.md's tables), in the same district files the S tracks write. Each finale (ep. 5) goes into ch. 9 after I lands.
- **V5 and Z9 look over everything**, so they come last.

**Riskiest shared spots** (every prompt names them): the save version (`WORLD_SAVE_VERSION` in `src/world/core/migrate.ts`), `WorldPage.tsx`, and the built files in `public/world/` (atlases, content JSON), which are regenerated, never hand-merged.

## How to start a session

Start each one in the Code tab **in its own worktree** (the app's worktree option). If you can't, the prompt tells the session to make its own worktree. Paste the **common part** first, then the track's own part.

---

## Common part — paste at the top of every prompt

```
You are one of several Claude sessions building 走走 (the Beijing walking game in this repo) at the same time. Each session owns one track; you own the track described below.

Read first, in this order:
- /Users/perewodchik/.claude/projects/-Users-perewodchik-Documents-projects-Chinese/memory/MEMORY.md and every memory file it links to. They are the learner's standing rules: HSK 1–2; native voices; stable, compact UI; check at phone width; the shared git tree. Read them by path even if your session didn't load them.
- CLAUDE.md and src/world/CLAUDE.md (how to work here).
- docs/world-game/STATUS.md, then docs/world-game/s13-plan.md: 13.0 and your task's section.
- docs/world-game/spec.md: the content rules (word budget, dialogue, formats).
- docs/world-game/story.md: the chapter tables, cast sheet and conventions.
- docs/world-game/facts.md: every real-world claim you write must be in this register, with a source.
- content/world/README.md

Where you work:
- Work in your own git worktree on your own branch, never directly in /Users/perewodchik/Documents/projects/Chinese.
- If the app didn't give you a worktree, make one: git worktree add .claude/worktrees/<track> -b track/<track>, run from the main checkout. Then work there.
- node_modules resolves from the repo root.
- Always export PATH=/opt/homebrew/bin:$PATH. The project needs Node 25; the default node is too old.
- A worktree has no .env, so the dev server uses SQLite. Keep it on a test DB and never point it at the production database.

Browser checks:
- Start your dev server with preview_start using the launch config named in your track.
- Use your own hostname in the pane (e.g. http://<track>.localhost:<port>) so sessions don't share cookies.
- The pane is Chromium. For Safari's engine, run the Playwright WebKit probes (node scripts/world/*-probe.mjs webkit http://localhost:<port> …). Playwright WebKit is installed; headless Chromium is not.
- Seed saves from a non-game page (/today), since an open /play/world tab writes its own save back over yours.

Files:
- Stay inside your track's files.
- The files you may have to share are listed in your track. Keep edits there small and local, and never reformat or re-dump a whole shared file. If you rewrite JSON with a script, keep the file's existing indentation (the content files use indent 1).
- Save version: Read WORLD_SAVE_VERSION on main (17 on 2026-10-01). If you need a bump, take the next number above main's at the time you land. If someone landed one before you, renumber yours on top; UPGRADES must stay sequential.
- Files under public/world/ (atlases, maps, content JSON, voice index) are built. Never hand-merge them: on a conflict, take either side, then rerun the matching npm run world:art / world:maps / world:content / world:minis, and commit the result.
- STATUS.md: tick only your own boxes. Put your morning note (in Russian, like the others) as its own paragraph at the top. Add your calls to the end of "Decisions" in docs/world-game/decisions.md (append; don't read the whole file), prefixed with your track letter. On a conflict, keep both sides.
- Books, cutscenes and scene ids: namespace new ids by your track or chapter so nobody collides.

Before you land each task:
- npm test, npm run world:check, npx tsc -b and npm run vercel-build all pass.
- Anything visible is checked in the pane and in WebKit at 375 / 768 / 1024, light and dark.

Landing (do it after every ticked task, not once at the end, so the others build on your work):
1. Commit on your branch. End the message with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
2. Bring main in: use the sync_with_base_branch tool if the app made your worktree, else git merge main. Resolve conflicts, rebuild the generated files, rerun every check.
3. Fast-forward main from the main checkout:
   git -C /Users/perewodchik/Documents/projects/Chinese merge --ff-only track/<track>
   (or the name of your branch). If it refuses because main moved, go back to step 2. If it refuses because of uncommitted files in the main checkout, stop and tell the user.
- Never force-push, never git update-ref main directly, never push to GitHub. The user pushes.

Report at the end: what landed, what was checked and how, what wasn't, and anything another track has to know.
```

---

## Wave 2 — start when the learner unfreezes chapters 5–10

Each of these works the same way. Paste the common part, then its block.

```
All of wave 2: follow docs/world-game/S-howto.md (written by S1) and the rules for all of S in docs/world-game/s13-plan.md.
- ~12–20 main steps per chapter along story.md's route, so every map in the chapter's districts is on the route (coverage).
- Keep existing scene, quest and step ids.
- One book per chapter, given on the route, with the next step needing something it says. Facts go in facts.md with sources first.
- Opening and finale cutscenes plus 2–4 between.
- A 鼓楼 friend appears in the chapter.
- No step may need money the player can't have (the solver's spendAll check).
- Don't change another chapter's start condition; only your own chapter's quests start and end where S-howto says.
- Substory episodes (U) are NOT yours. Where story.md puts one on your route, leave the place free; the U sessions add them in wave 3.
- Golden saves at your chapters' starts still finish.
```

### F — S5 香火 (new)

```
Your track: F — §13 S5 (branch track/s5). S4 has landed. Launch config: hanzi-workshop-mac-world-5182 (port 5182; if session B still has it running, add a config with your own port and a test DB).
- Your districts: yonghegong (the 雍和宫 courtyards and 万福阁) and xianghuo (白云观, 东岳庙). 天坛 and 国子监 are S4's, already built.
- S5 is a new chapter, quest id ch-xianghuo, told with respect: nothing mocks belief, and the jokes are about people.
- Book 10 《三教》 (books 8 and 9 came with S4).
- Add a golden save at the start of ch. 5.
- Tick S5 in STATUS.md.
```

### G — S6 新北京 + S7 故事

```
Your track: G — §13 S6 and S7 (branch track/s6-s7). Launch config: hanzi-workshop-mac-world-5183 (port 5183; add your own config if session C still has it running).
- Your districts: content/world/sanlitun, aoyun (国贸 too, whichever district holds it), yiheyuan, panjiayuan.
- Books: 11 《数字》 (8 发, 4 死, 貔貅, 红包), 12 《长廊的画》 (check the count), 13 《年》.
- Tick S6, S7 in STATUS.md.
```

### H — S8 龙

```
Your track: H — §13 S8 (branch track/s8). Launch config: add a config like hanzi-workshop-mac-world-5183 with PORT=5184 and HANZI_DB=.data/world-test-5184.db.
- Your district: content/world/tiananmen (天安门, 故宫 by the axis T4 built, 神武门 one-way).
- Book 14 《故宫》 (the colours of power; check the 9,999½ rooms legend against the real count, and 东华门's 门钉 rows; a step chooses a door by its 门钉 count).
- Book 15 《画龙点睛》: the game's biggest cutscene. After it, 王阿姨 says 小军 is coming home for 春节; that is the hook into ch. 9, so name the flag in S-howto.
- Tick S8 in STATUS.md.
```

---

## Wave 3 — start after F–H have landed

### I — S9 过年 (new) + S10 尾声

```
Your track: I — §13 S9 and S10 (branch track/s9-s10). Launch config: hanzi-workshop-mac-world-5180 (port 5180).

Do S9 and S10 as s13-plan.md describes:
- 小年 with 灶王爷 and 糖瓜 (book 16, check 腊月二十三)
- 年货 at 前门 and 王府井 (a list to read)
- 春联 with 老刘 (the 地书 brush)
- 大扫除
- 小军 arrives (a station cutscene)
- 包饺子: fold side-jiaozi in
- the 年夜饭 cutscene, 守岁, fireworks
- 初一 拜年 with 红包
- the 地坛 or 白云观 庙会
- book 17 《团圆》 (check the 春运 scale)
- Q2's 睡到… to 腊月 when away from 春节
- 尾声: the 长城 train with 小军, the last panel on the Wall, book 18 《长城》, 元宵 night in the courtyard (joined with the 天官赐福 finale if that line is done), credits over every district.
- New quest id ch-guonian. Add a golden save at ch. 9's start.

Leave named hooks for the U finales at the 庙会 and the toast: 胡半仙 ep5, the 煎饼 contest (老马 & 老牛 ep5), 米沙 ep5. Write their scene and flag ids into S-howto so J–M can add them.

Ch. 9 touches many districts; the other wave-3 sessions (U) write in the same folders. Add your scenes with ch-guonian-* ids, append only, and never reformat a file.

After S10, WORLD_COVERAGE=strict npm run world:check must pass. Tick S9, S10 in STATUS.md.
```

### J / K / L — substory episodes, by chapter

Paste the common part, this shared block, then the session's line. The U
tasks are one per chapter (s13-plan.md U, the table); U1–U4 are built.

```
Your track: the §13 U substory episodes of your chapters (s13-plan.md U: the table and the characters; story.md's chapter tables put each episode on the route).
- Each episode on its chapter's main route, 3–6 minutes, with ≥ 1 cutscene; Q1-style marks with the character's portrait badge.
- Keep each character's catchphrase and voice as U1–U4 set them (story.md §3.2); the books 《属相》, 《煎饼果子》, 《声调》 exist — add pages, don't start new ones; 甜甜's book per s13-plan.md.
- The finales (U9) each end in a warm cutscene with the character's own 4–6-note motif in src/world/audio/music.ts.
- Kind humour: laugh with people, never at a culture, a belief or an accent.
- Namespace every id: hu-*, ma-niu-*, tiantian-*, misha-*; quest ids start sub-.
- Append to the district files; never reformat them.
- The solver plays every episode with its hints. Tick your U boxes in STATUS.md; the last one of you to land does U-check (each character ≥ 4 episodes, each with a cutscene; the motifs render offline).
```

- **J** — `Your tasks: U5 (ch. 5) + U6 (ch. 6), after S5 and S6 have landed (branch track/u56). Launch config: PORT=5185, HANZI_DB=.data/world-test-5185.db.`
- **K** — `Your tasks: U7 (ch. 7) + U8 (ch. 8), after S7 and S8 have landed (branch track/u78). Launch config: PORT=5186, .data/world-test-5186.db. 米沙 has no recorded voice; keep U1–U4's choice.`
- **L** — `Your tasks: U9 (the finales at the 庙会 and 年夜饭) + U10 (甜甜 on the Wall), after session I (S9 + S10) has landed — use the miaohui hook (S-howto) (branch track/u910). Launch config: PORT=5187, .data/world-test-5187.db.`

---

## Wave 4 — after everything above

### N — V5, then Z9

```
Your track: N — §13 V5, then Z9 (branch track/final). Launch config: hanzi-workshop-mac-world-5180.

1. V5: the final look pass over every map, as s13-plan.md V5 describes. Renders go in review/.
2. Z9:
   - The solver plays the whole game from the start to the 元宵 credits with only its hints, every substory included.
   - Golden saves at every chapter start; every old golden save upgrades and finishes.
   - WORLD_COVERAGE=strict world:check passes.
   - WebKit and Chromium probes: the cutscene, the reader, the bike shop, Journal → Side, at 375 / 768 / 1024 in light and dark.
   - review/ folders k/ t/ v/ l/ b/.
   - Morning notes in Russian: what to play first, what's unchecked, which facts are still marked ?.
   Tick V5 and Z9 in STATUS.md. After that, only X12 (playing it with the learner) is left.
```
