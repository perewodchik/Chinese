# 走走 — what's left, in parallel sessions (2026-09-30)

Everything open in STATUS.md, sorted by which tasks can run side by side.

## The plan

| Wave | Start when | Sessions (run at the same time) |
|---|---|---|
| **1** | now | **A** S1 (ch. 1 + the save and renumbering all S work needs) · **B** L1–L4 your own bike · **C** N1–N2 city sounds · **D** M6–M8 map plan fixes |
| **2** | A has landed on main (it writes `docs/world-game/s13/S-howto.md`) | **E** S2 + S3 · **F** S4 + S5 · **G** S6 + S7 · **H** S8 |
| **3** | E–H have landed | **I** S9 + S10 · **J** U1 胡半仙 · **K** U2 老马 & 老牛 · **L** U3 甜甜 · **M** U4 米沙 |
| **4** | everything above has landed | **N** V5, then Z9 (one session, in order) |
| — | with you | X12 play-through |

B, C and D don't depend on the story and can still be running during wave 2.

**Why this order**
- **S1 goes first and alone.** It carries the save upgrade (steps added before a save's current step count as done) and the chapter renumbering (new ch. 5 香火 and ch. 9 过年 shift 5–7 up by one). Every other chapter builds on that.
- **S tracks are split by district.** Each chapter's content lives in its own `content/world/<district>/` files, so two sessions never write the same `scenes.json`.
- **U waits for the chapters it lives in.** Substory episodes sit on chapter routes (story.md's tables), in the same district files the S tracks write. Episodes 1–4 can be written as soon as wave 2 has landed; each finale (ep. 5) goes into ch. 9 after I lands.
- **V5 and Z9 look over everything**, so they come last.

**Riskiest shared spots** (every prompt names them):
- the save version (`WORLD_SAVE_VERSION`, now 15)
- `WorldPage.tsx`
- `MetroMap.tsx` (B and D)
- the 鼓楼东大街 map (A and B)
- the built files in `public/world/` (atlases, content JSON), which are regenerated, never hand-merged

## How to start a session

Start each one in the Code tab **in its own worktree** (the app's worktree option). If you can't, the prompt tells the session to make its own worktree. Paste the **common part** first, then the track's own part.

---

## Common part — paste at the top of every prompt

```
You are one of several Claude sessions building 走走 (the Beijing walking game in this repo) at the same time. Each session owns one track; you own the track described below.

Read first, in this order:
- /Users/perewodchik/.claude/projects/-Users-perewodchik-Documents-projects-Chinese/memory/MEMORY.md and every memory file it links to. They are the learner's standing rules: HSK 1–2; native voices; stable, compact UI; check at phone width; the shared git tree. Read them by path even if your session didn't load them.
- docs/world-game/prompt.md §0 and §13.0, then your task's sections of §13.
- docs/world-game/STATUS.md
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
- Save version: WORLD_SAVE_VERSION is 15 on main today. If you need a bump, take the next number above main's at the time you land. If someone landed one before you, renumber yours on top; UPGRADES must stay sequential.
- Files under public/world/ (atlases, maps, content JSON, voice index) are built. Never hand-merge them: on a conflict, take either side, then rerun the matching npm run world:art / world:maps / world:content / world:minis, and commit the result.
- STATUS.md: tick only your own boxes. Put your morning note (in Russian, like the others) as its own paragraph at the top of "For the learner". Prefix your "Decisions" and "Problems" lines with your track letter. On a conflict, keep both sides.
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

## Wave 1

### A — S1 · chapter 1 新家 deepened, and the ground for all S work

```
Your track: A — §13 S1 (branch track/s1). Launch config: hanzi-workshop-mac-world-5180 (port 5180, .data/world-test-5180.db).

Do §13 S1 as prompt.md describes (rules for all of S, and the S1 beats), plus the shared pieces every later chapter needs:
1. Save upgrade (next version after 15): a save in the middle of a chapter keeps its place. New steps inserted before its current step count as done, dated like J2's skipped steps; new steps after it are ahead. Do the chapter renumbering now for all quests, even though chapters 5 and 9 are written later: 1 新家 · 2 水与山 · 3 书 · 4 回声 · 5 香火 (new, quest id ch-xianghuo) · 6 新北京 (quest id stays ch5) · 7 故事 · 8 龙 · 9 过年 (new, ch-guonian) · 尾声. Only the `chapter` numbers change in the other districts' quests.json; quest and step ids stay. Every golden save in content/world/test-saves upgrades and still finishes.
2. Chapter 1 to ~12–20 main steps along story.md's route. Include the xiaomaibu list step, both 钟楼 and 鼓楼, and a friend at every stop. Keep every existing scene id.
3. Books 2 《石狮子》 and 3 《晨钟暮鼓》, written in the book format (see src/world/core/books.ts and content/world/books/denglong.json). Put the facts in facts.md with sources first (`lions-pair`, the drum/bell hours). Each book is given on the route, and the next step needs something it says (兔儿爷 answers too, pointing at the page). 《灯笼》 is already given in `lantern-rabbit`.
4. The opening and finale cutscenes (K3) and the 2–4 between them from story.md.
5. Write docs/world-game/s13/S-howto.md for the wave-2 sessions. Cover: how to add steps, books and cutscenes; the chapter hand-off contract (which flag or quest end starts the next chapter; they must not change another chapter's start condition); how the solver and golden saves prove a chapter; the id namespaces per chapter; the hooks ch. 9 needs from other chapters.

Your files: content/world/gulou/*; content/world/books/ (new books only); the `chapter` fields in other districts' quests.json; src/world/core/{save,migrate,merge,types,journal}.ts for the upgrade; test-saves; the solver and chapter tests.

Shared with others:
- Session B adds a bike shop door on the 鼓楼东大街 map, so leave that map's objects apart from your own additions.
- Session C adds sounds to src/world/audio/mix.ts.
- Keep WorldPage.tsx edits small.

Tick S1 in STATUS.md when done. In your report, say clearly that wave 2 (S2–S8) can start.
```

### B — L1–L4 · your own bike

```
Your track: B — §13 L1–L4 (branch track/bike). Launch config: hanzi-workshop-mac-world-5182 (port 5182, .data/world-test-5182.db).

Do §13 L1–L4 exactly as prompt.md describes:
- The 自行车行 on 鼓楼东大街 and the 修车摊 (real brands 永久 / 凤凰 / 飞鸽 by name only, our own pixel art, second-hand, test ride).
- Riding: the 🚲 top-bar button, ×2 speed, the bell, 兔儿爷 in the basket.
- The no-ride rules taught by signs you read: doors, 「禁止骑车」 park and palace gates, no bikes in the subway.
- 骑车去 on the metro map for districts within ~6 km, using real distances in a table, each with a short skippable ride cutscene.
- The parked bike on the minimap and the map, and fetching it by phoning the 修车摊.
- The flat tyre, the lock, photos, diary lines and friends noticing (L3); the side-bike ending pointing to the shop.
- Book 19 《自行车王国》 in the book format, facts in facts.md first.
- The save bump for `bike`, with merge.
- L4's checks, including renders of every model and colour in review/l/ and the shop at 375 / 768 / 1024.
Check every real-world claim marked (check) in prompt.md, e.g. which parks forbid riding and the station wording.

Your files:
- New: src/world/core/bike.ts (and tests), the shop map and its content, art generators for the bike layer (the W1 composer).
- Shared: engine movement and door code, TopBar, Minimap, save/migrate/merge/types.
- MetroMap.tsx is shared with session D (map fixes): add the 骑车去 option as a separate small piece.
- The 鼓楼东大街 map is shared with session A (chapter 1): only add the shop door and its signs.
- Don't edit main-story quests or scenes. Side-quest `side-bike` is yours.

Tick L1–L4 in STATUS.md as each lands.
```

### C — N1–N2 · real Beijing sounds

```
Your track: C — §13 N1–N2 (branch track/sounds). Launch config: hanzi-workshop-mac-world-5183 (port 5183, .data/world-test-5183.db).

Do §13 N1–N2 as prompt.md describes:
- Metro announcements on every ride: check today's real wording, and use the Chinese plus the English line.
- 吆喝 street cries by place and hour.
- Life sounds: the 鼓楼 drums at the show hours (check them), the 钟楼 bell, temple chanting and 木鱼 at 雍和宫, 京剧 radio, 麻将, 广场舞 18–21, cicadas, winter crows, 春节 firecrackers in short bursts, the 外卖 rider, 倒车 scooters.
- Each sound placed in audio/mix.ts by map, hour, season and festival (pure and tested).
- Lines with words get a tappable 4-second caption at the screen edge (tap → English and the word drawer). Keep it compact, with no layout shift.
- ⚙ "City voices: on / off".
- Speech is always our own voices: pre-render with the voice worker (scripts/world/build-voices.ts, .cache/tts-venv) and fall back to the system voice. CC0 recordings are allowed only for non-speech ambience, credited.
- While the worker is up, also render the book pages' narrator clips: build-voices already knows books; it just hasn't been run.
- N2's checks: mix tests for every rule, offline renders, loudness matched to the music, ducking in talks.

Your files: src/world/audio/*, the ride announcements (src/world/core/ride.ts and RideSheet), a new caption component, the settings row, build-voices, public/world/voice/.

Shared:
- WorldPage.tsx: keep edits small.
- Session B (bike) may call the bell and ride sounds, so keep the ambient API stable.
- Don't touch story content.

Tick N1, N2 in STATUS.md.
```

### D — M6–M8 · the neighbourhood plan and "take me there"

```
Your track: D — M6, M7, M8 in STATUS.md's P/J section (branch track/maps). Launch config: hanzi-workshop-mac-words-5181 (port 5181, .data/words-test.db — a test database).

Do, in this order:
- M8 — the learner's screenshot fixes on 南锣鼓巷:
  - A content-hash or build stamp on every /world/minis/<map>.png URL and on hoods.json.
  - A wrong-shaped image drawn letterboxed, never stretched.
  - Every map reworked in T1–T4 checked the same way.
  - Room cards level with their doors, with gaps and lead lines from the door.
  - The loose white circles explained or placed.
  - The station card at the street's south end.
  - Visible joins where streets meet.
- M7 — entrances on the plan and the minimap:
  - a door mark on the street tile of each shop, room and station door, joined to its card;
  - a mark where a street runs on into the next one;
  - an arrow with a name at the plan's edge for an exit into another neighbourhood.
- M6 — "Take me there": a footprint trail to the next step, with the right train marked.
Read STATUS.md's M6–M8 text for the details, and prompt.md for M6.

Your files: src/world/ui/HoodPlan.tsx, Minimap.tsx, MapTab.tsx, Journal.tsx (the mini images only), NextHop.tsx, scripts/world/build-minis.ts, src/world/core/hoods.ts and places.ts, the map probes.

Shared:
- MetroMap.tsx is shared with session B, which adds a 骑车去 option: keep your change to the route marking separate and small.
- Don't edit map content (content/world/maps/*) except to fix a door or card position M8 names. Sessions A and B are editing the 鼓楼 maps.

Check every reworked neighbourhood in the pane and WebKit at 375 / 768 / 1024, with renders in docs/world-game/review/m/. Tick M8, M7, M6 in STATUS.md as each lands.
```

---

## Wave 2 — start after A has landed

Each of these works the same way. Paste the common part, then its block.

```
All of wave 2: follow docs/world-game/s13/S-howto.md (written by S1) and the rules for all of S in prompt.md §13.
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

### E — S2 水与山 + S3 书

```
Your track: E — §13 S2 and S3 (branch track/s2-s3). Launch config: hanzi-workshop-mac-world-5180 (port 5180).
- Your districts: content/world/houhai, jingshan (水与山), wangfujing, qianmen (书).
- Books: 4 《什刹海》, 5 《狐假虎威》 (check the 战国策 source), 6 《门神》 (秦琼 and 尉迟恭: the step needs them facing each other), 7 《脸谱》 (check the colours).
- The clothes and shops that exist (百货大楼, 瑞蚨祥, 内联升, 药店, 银行) become beats with a reason. Lend clothes free if the player can't pay.
- Tick S2, S3 in STATUS.md.
```

### F — S4 回声 + S5 香火 (new)

```
Your track: F — §13 S4 and S5 (branch track/s4-s5). Launch config: hanzi-workshop-mac-world-5182 (port 5182; if session B still has it running, add a config with your own port and a test DB).
- Your districts: content/world/tiantan (天坛, 祈年殿, 圜丘: the echo needs the centre stone the book names), the 国子监 / 孔庙 maps (find a name on the 进士 stones), yonghegong, and xianghuo (白云观, 东岳庙).
- S5 is a new chapter, quest id ch-xianghuo, told with respect: nothing mocks belief, and the jokes are about people.
- Books: 8 《天坛》, 9 《科举》, 10 《三教》.
- Add a golden save at the start of ch. 5.
- Tick S4, S5 in STATUS.md.
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

## Wave 3 — start after E–H have landed

### I — S9 过年 (new) + S10 尾声

```
Your track: I — §13 S9 and S10 (branch track/s9-s10). Launch config: hanzi-workshop-mac-world-5180 (port 5180).

Do S9 and S10 as prompt.md describes:
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

### J / K / L / M — one substory each

Paste the common part, this shared block, then the character line.

```
Your track: a §13 U substory (U1–U4 in prompt.md; story.md §3.2 and the chapter tables put each episode on a chapter's route).
- ≥ 4 episodes on main routes, each 3–6 minutes, each with ≥ 1 cutscene.
- Q1-style marks with the character's small portrait badge.
- A catchphrase the learner will end up saying.
- A warm ending cutscene with the character's own 4–6-note motif in src/world/audio/music.ts. Add yours as its own entry; the others add theirs.
- A book (B1 format, facts in facts.md first) and a stamp.
- Kind humour: laugh with people, never at a culture, a belief or an accent.
- Namespace every id: hu-*, ma-niu-*, tiantian-*, misha-*.
- Append to the district files; never reformat them.
- Episode 5 (the finale in ch. 9) goes into the hooks S9 left (see S-howto). If session I hasn't landed yet, write episodes 1–4 first and land them, then ep. 5 after.
- U5 checks for your character: the solver plays every episode with its hints, and the motif renders offline. Session J also adds the generic world:check rule: each substory has ≥ 4 episodes, each on some chapter's route, each with a cutscene.
- Tick your U box in STATUS.md. The last one of you to land ticks U5.
```

- **J** — `Your character: U1 胡半仙 (branch track/u1). Launch config: add one with PORT=5185, HANZI_DB=.data/world-test-5185.db. Book 《属相》: the 12 animals.`
- **K** — `Your characters: U2 老马 & 老牛, the 煎饼 rivals (branch track/u2). Launch config: PORT=5186, .data/world-test-5186.db. Book 《煎饼果子》.`
- **L** — `Your character: U3 甜甜, the livestreamer with 弹幕 (branch track/u3). Launch config: PORT=5187, .data/world-test-5187.db. Her book per prompt.md U3.`
- **M** — `Your character: U4 米沙, the other learner with wrong tones in real minimal pairs (branch track/u4). Launch config: PORT=5188, .data/world-test-5188.db. He has no recorded voice, so decide per prompt.md U4 and note it in Decisions.`

---

## Wave 4 — after everything above

### N — V5, then Z9

```
Your track: N — §13 V5, then Z9 (branch track/final). Launch config: hanzi-workshop-mac-world-5180.

1. V5: the final look pass over every map, as prompt.md §13 V5 describes. Renders go in review/.
2. Z9:
   - The solver plays the whole game from the start to the 元宵 credits with only its hints, every substory included.
   - Golden saves at every chapter start; every old golden save upgrades and finishes.
   - WORLD_COVERAGE=strict world:check passes.
   - WebKit and Chromium probes: the cutscene, the reader, the bike shop, Journal → Side, at 375 / 768 / 1024 in light and dark.
   - review/ folders k/ t/ v/ l/ b/.
   - Morning notes in Russian: what to play first, what's unchecked, which facts are still marked ?.
   Tick V5 and Z9 in STATUS.md. After that, only X12 (playing it with the learner) is left.
```
