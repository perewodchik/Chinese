# 走走 — §13 plan: what is still to build

The parts of the §13 brief that are still open: what the learner asked for
(13.0, read it first, it decides every trade-off), the chapters S5–S10, the
substories U1–U10 (one per chapter) and U-check, the final look pass V5 and the end check Z9. How to write a
chapter is `S-howto.md`; the story itself is `story.md`. The §13 tasks already
built (Z0, K, Q, V1–V4, T, B, L, N, S1–S4) are in `history/built-specs.md`.

**Chapters 5–10 are frozen** (the learner, 2026-09-30) until they are confident
in chapters 1–4. Nine U episodes that fall in chapters 1–4 are already built (U1–U4);
see `review/chapters-1-4.md`.

### 13.0 What the learner asked for, and why (read this first; it decides every trade-off)

The learner (HSK 1–2, 20–30 minutes a day, learns Chinese from English)
said, in their words:
- *"My primary focus is learning the language — not playing longer."* The
  game is a **reason to hear, read and say Chinese in real situations**,
  wrapped in a story good enough that they want to come back tomorrow.
  Nothing here is grind, collect-a-thon or a timer. If a feature does not
  make the learner hear, read or say more Chinese, or understand Chinese
  culture better, or remove friction from doing so, **cut it**.
- *"One long main story that immerses me in Chinese culture, and makes me
  visit every (or almost every) place."* Today the main story is 40 steps
  over 8 quests (3–7 steps each). Most of the city — and most of the good
  content — sits in 57 side quests that are easy to miss. By an audit of
  `quests.json`, no main step points at: 北海 north, 景山 park, 药店,
  小卖部, 雍和宫 street, 天安门 square, 百货大楼, 国贸 plaza, 瑞蚨祥,
  内联升. There is no real temple interior at all (雍和宫 is a street,
  天坛 has no 祈年殿 of its own).
- *"Books to read, in English and Chinese, about events in the culture, so
  I understand how the game relates to real Chinese culture."*
- *"Side quests should be more explicit."* (This **reverses** §10's
  "vague leads" decision — log it under Decisions.)
- *"Cutscenes for important events, so I know I am doing something
  correctly."*
- *"The graphics more animated and good looking, embracing the style. More
  Chinese temples. The map should remind me of real Chinese places."*
- *"At least 3 substories — a bit comedic — with memorable, charismatic
  characters, and cutscenes."*
- *"Real Beijing sounds."*
- *"A bike I can buy in a shop, and ride anywhere."*
- **Art packs:** the learner approved downloading **CC0-only** pixel-art
  packs (check each license page; credit in `public/world/CREDITS.md`
  even when CC0; recolour to our palette). CC-BY or unclear → do not use.
- **Story:** the learner chose **deepen the existing chapters, not
  rewrite**: keep the lantern-and-spirits frame and every scene that
  works; add a human thread, many more steps, routes through every place.
  Saves in progress must keep working.

All standing rules still apply (§0; concept wins; Beijing only; no
dialect; companion speaks English; help is free, never a test, no
penalties; stable compact UI — no layout shift, 375 / 768 / 1024, WebKit,
light/dark; hanzi-design tokens; own or CC0 art; homages, never copies;
the §5 word budget plus situation words; everything in the world save
with an upgrade + test). **Save format: v12 → v13 in K1, and each later
task that adds fields bumps once more** (write each bump in Decisions).

**Quality bar for every feature below.** Before building a task, write a
short design note for it (why it helps the learner, what exactly the
player sees, data, edge cases, what you decided not to do) and keep it to
one screen: in the commit message, with the calls in `decisions.md`. Then build. This is how the
learner asked for it: *thought through, not there for the sake of
existing*. A feature you could not make good is better left as a note
than shipped half-done.

---


### S — the main story, deepened (one task per chapter)

**Rules for all of S:**
- **Deepen, don't replace.** Keep every existing scene id that works; add
  steps and scenes around them. Quest ids stay; step ids stay; new steps
  get new ids.
- **Target ~12–20 main steps per chapter** (today 3–7), each step
  2–6 minutes of play: a place, a person, something to *say or do* in
  Chinese, and a small reward (✓ seal, K2). Vary what each step asks:
  ask the way, buy, read a sign, listen and choose where to go, tell
  someone what you saw, use an item, take a photo, give a gift.
- **Every place in the chapter's district is on the route** (Z0 table);
  shops that exist (药店, 银行, 小卖部, 百货大楼, the clothes shops,
  便利店) become story beats with a reason (a cold → 药店; a gift for
  王阿姨 → 百货大楼; a proper jacket for the temple ceremony → 瑞蚨祥 —
  lend clothes free if the player can't pay: **no step may require
  money the player can't have**; the solver's `spendAll` check stays).
- **One book per chapter on the route** (B1 list); one cutscene opening,
  one finale (K3), 2–4 cutscenes in between for the big beats.
- **The recurring cast visits**: at least one 鼓楼 friend appears in
  every chapter (王阿姨 phones you; 老刘 wants tea from 王府井; 小明's school
  trip is at 天坛; 赵爷爷 flies kites at 奥林匹克).
- **Save upgrade (v13 → v14 in S1):** a save mid-chapter keeps its place:
  new steps inserted *before* the save's current step count as done
  (dated like J2's skipped steps); new steps after it are simply ahead.
  New chapters shift numbers (below): upgrade `chapter` accordingly and
  test with every golden save.
- **New chapter numbering:** 1 新家 · 2 水与山 · 3 书 · 4 回声 · **5 香火
  (new)** · 6 新北京 (was 5) · 7 故事 (was 6) · 8 龙 (was 7) · **9 过年
  (new)** · 尾声 长城 + 元宵.

Per chapter (the beats listed are the minimum; the builder adds the
connecting steps):

- **S1 · 1 新家 (鼓楼 · 南锣鼓巷)** — opening cutscene (arriving with a
  suitcase through 南锣鼓巷, the 胡同 at morning). Add: 王阿姨 gives the
  lantern book 《灯笼》 when it breaks; a step at the 小卖部 (buy what
  王阿姨 needs — you read her list); 钟楼 and 鼓楼 both (book 3: listen for
  the drum at dusk — the time the book says); the 石狮子 (book 2: which
  one is the lion, which the lioness); first memory cutscene (王阿姨 as a
  girl under the lantern). Route: yard → 南锣鼓巷 → 小卖部 → 早点铺 →
  茶馆 → 钟鼓楼 → 烟袋斜街 (a glimpse, for ch2) → station.
- **S2 · 2 水与山 (后海 · 北海 · 景山)** — 烟袋斜街 → 银锭桥 (the view,
  a cutscene) → the fisherman → 恭王府 gate → boat or walk to **北海 白塔**
  (book 4) → 景山's five pavilions → 万春亭 view cutscene → the fox at
  角楼 (book 5 tells you the fox borrows the tiger's power — you must
  get the tiger's roar: a recording from 小明's toy / the 京剧 CD… let the
  builder choose; the solution comes from the book).
- **S3 · 3 书 (王府井 · 前门)** — 王府井 north–south: the 银行 (exists),
  百货大楼 (a gift for 王阿姨, a proper outfit for 京剧 night → 瑞蚨祥 on
  大栅栏; lend if poor), 书店 (the 成语 book + 《门神》 + 《脸谱》),
  小吃街 (老牛, U3), 药店 (兔儿爷 caught a cold from the 景山 wind — you
  describe his symptoms: 发烧, 咳嗽 — funny and very useful), 前门 by the
  铛铛车, the 京剧 show cutscene, the 门神 repainted facing each other.
- **S4 · 4 回声 (天坛 · 国子监 · 孔庙)** — 天坛 by the axis: 祈年殿 (book
  8; the blue roof), 丹陛桥, 回音壁 (exists), 圜丘 centre stone echo
  (a new listening beat: say a word, hear it back); 小明's school trip;
  国子监街 牌楼 → 孔庙 (book 9: find a name on the 进士 stones —
  reading), the 麒麟 at dusk (exists).
- **S5 · 5 香火 · Incense (new; 雍和宫 · 白云观 · 东岳庙)** — the
  culture chapter about belief in everyday Beijing, told with respect and
  warmth: 雍和宫 (incense etiquette — three sticks, bow; the prayer
  wheels; the Maitreya of 万福阁), 白云观 (the stone monkeys: a spirit
  hides as a fourth monkey — the chapter's spirit is **石猴** or another
  from the lantern; decide in Z0 and keep the 图鉴 consistent), 东岳庙
  (the funny "departments" — a 胡半仙 episode, U5). Book 10 《三教》.
  Nothing mocks belief; the jokes are about people, not faith.
- **S6 · 6 新北京 (三里屯 · 国贸 · 奥林匹克)** — keep the 貔貅 line;
  add 国贸 plaza (office lunch: order by phone QR), a 快递 pickup (you
  sign for a parcel from 小军! — the throughline), 甜甜's stream at
  三里屯 (U6), 鸟巢 at night cutscene; book 11 《数字》.
- **S7 · 7 故事 (颐和园 · 潘家园)** — 长廊 paintings come alive (a
  cutscene per painting you "enter": 3 short ones from 西游记, 三国,
  红楼梦 — homages, own lines), 十七孔桥 at sunset, 潘家园 bargaining for
  the 年兽 (exists); books 12, 13.
- **S8 · 8 龙 (故宫)** — the full axis (T4), the ticket in your name
  (exists), the colours of power (book 14 — a step where you choose the
  door by its 门钉 count, *(check)* 东华门 has 8 rows), 画龙点睛 as the
  game's biggest cutscene (book 15). After it: **王阿姨 says 小军 is
  coming home for 春节**.
- **S9 · 9 过年 (new; the whole city)** — 腊月 → 春节 → the week after.
  小年: 灶王爷 and 糖瓜 (book 16); buying 年货 at 前门 and 王府井
  (a list to read), writing 春联 with 老刘 (the 地书 brush mechanic), 大扫除
  the courtyard, 小军 arrives (a cutscene at the station: 王阿姨 and her
  son, and the lantern with every panel lit but one), 包饺子 (exists as
  side-jiaozi — fold it in), 年夜饭 cutscene with the whole cast, 守岁,
  fireworks, 初一 拜年 round the 胡同 (「新年好」「恭喜发财」 — 红包), the
  **地坛 or 白云观 庙会** (U9: the 煎饼 contest, 胡半仙's finale). Book 17.
  If the player reaches chapter 9 away from 春节, Q2's 睡到… takes them
  to 腊月; if they're past it this year, to next year's (the calendar
  loops every 52 days).
- **S10 · 尾声 (长城 · 元宵)** — the train to 长城 (exists) with 小军
  and 兔儿爷; the spirits' farewell on the Wall (exists; add the last
  panel); book 18; then **元宵 night in the courtyard**: the mended 走马灯
  lit, the panels turning with every spirit in it, lanterns rising over
  the 胡同 (the 天官赐福 lanterns if that line is done — its finale is
  also 元宵: make them one night, both endings shown), 兔儿爷 on the
  windowsill. Credits roll over the city by day (a slow pan through every
  district you visited, with its real sounds). After the credits: free
  play continues (Keep playing, exists), and the substories that aren't
  done yet stay on.

---

### U — substories: four characters the learner will remember

**Why:** comedy makes lines stick. Each character has a clear comic
engine, a catchphrase the learner will end up saying, a warm ending, and
teaches one slice of real culture. Episodes sit **on main routes** (they
appear where the story sends you, marked with their own tag in Q1's
style — a small portrait badge) so they can't be missed; each episode is
3–6 minutes; each has at least one cutscene; each ending has a longer
one with the character's **own musical motif** (music.ts, a 4–6 note
phrase on their instrument — keep it bright, the music rule). Each has
a book (B1) and a stamp. Kind humour: laugh with people, never at a
culture, a belief or an accent.

**Tasks are one per chapter** (the learner, 2026-10-01): a chapter's U task
builds every substory episode on that chapter's route, together with or
right after its S task. The characters below say who they are and what
their five episodes are; `story.md`'s chapter tables place each episode.

| Task | Chapter | Episodes | State |
|---|---|---|---|
| U1 | 1 新家 | 老马 ep1 · 米沙 ep1 | built |
| U2 | 2 水与山 | 甜甜 ep1 | built |
| U3 | 3 书 | 老牛 ep2 · 米沙 ep2 | built |
| U4 | 4 回声 | 甜甜 ep2 · 胡半仙 ep1 · 老马 & 老牛 ep3 · 米沙 ep3 | built |
| U5 | 5 香火 | 胡半仙 ep2 | |
| U6 | 6 新北京 | 甜甜 ep3 · 胡半仙 ep3 | |
| U7 | 7 故事 | 老马 & 老牛 ep4 · 米沙 ep4 · 胡半仙 ep4 | |
| U8 | 8 龙 | 甜甜 ep4 | |
| U9 | 9 过年 | the finales: 胡半仙 ep5 · 老马 & 老牛 ep5 · 米沙 ep5 | |
| U10 | 尾声 | 甜甜 ep5 | |

#### 胡半仙 Hú Bànxiān, the fortune teller who is always a bit wrong
- **Who:** a sixty-ish man with a folding stool, a cloth sign 「算命」,
  round glasses and enormous confidence. Catchphrase:
  「天机不可泄露……不过，可以告诉你一点点。」 (the 成语 天机不可泄露 goes in
  the 成语 book — a hard line, §7 key-line rules). His predictions are
  hilariously safe: 「你今天……会吃饭！」
- **Episodes:** (1) 雍和宫 street — reads your face and 兔儿爷's ("你属兔！"
  — to a rabbit); book 《属相》: the 12 animals, find your own. (2)
  三里屯 phone shop — sells "lucky" numbers full of 8s; you notice his
  own number is full of 4s (the 8/4 culture of book 11). (3) your room —
  风水 advice that moves your furniture somewhere silly; the cat
  disagrees (a cutscene: the cat pushes it back). (4) 东岳庙 — he visits
  the "department of luck" to complain about his luck. (5) 春节 庙会 —
  his one real prediction comes true (「你会和朋友们一起过年」); he
  admits he's a retired maths teacher who just likes talking to people.
- **Language:** zodiac animals, numbers, 今天/明天, 会 (will), 好运.

#### 老马 and 老牛, the 煎饼 rivals
- **Who:** two 煎饼果子 sellers: **老马** (南锣鼓巷, mornings, tiny,
  fast, says 「正宗！」 about everything) and **老牛** (王府井 小吃街, huge,
  slow, says 「牛！」). Each insists his is the *real* one — the real
  debate: 天津's 馃篦儿 vs 北京's 薄脆 *(check)*.
- **Episodes:** (1) order from 老马 (the order is the lesson: 加个鸡蛋,
  不要葱, 要辣的); (2) 老牛's stall — same order, different words; (3) the
  message relay: each sends a rude message to the other; **you choose how
  to pass it on** (exactly, or kinder — the kind version starts peace,
  the exact one a comic escalation; both lead on); (4) they find out
  they were classmates in 天津 (a flashback cutscene in sepia: two boys
  sharing one 煎饼); (5) the 春节 庙会 煎饼 contest, you are the judge
  (taste, then say which you liked and why — any answer is right; they
  open a joint stall 「马牛煎饼」 in the ending cutscene). Book
  《煎饼果子》.
- **Language:** food orders, likes/dislikes, 比 comparisons (他的比他的
  好吃), 马马虎虎 finally makes sense.

#### 甜甜 Tiántian, the livestreamer
- **Who:** a cheerful 直播 streamer with a phone on a stick, who greets
  her audience with 「家人们！」 and says 「打卡！」 at every landmark.
  Gets history cheerfully wrong.
- **Episodes** on the routes of ch 2, 4, 6, 8, 10: 景山 sunset stream
  (she says 故宫 was built by 秦始皇 — you correct her with what your
  book said, by saying or choosing the simple sentence 「不对，是明朝。」 —
  if the learner can't, 兔儿爷 helps, as always); 回音壁 (her stream
  hears your whisper through the wall — comic); 三里屯 网红 café queue
  (you order for her; she's live); 角楼 (she needs you to film — the
  photo mode X6 with her in it); 长城 finale stream. **Her comments fly
  across the screen as 弹幕** (the `danmaku` fx): short real internet
  lines — 哈哈哈, 好美！, 666 (= awesome), 打卡, 主播加油 — a genuinely
  modern reading moment; the ending cutscene is all 弹幕 thanking you.
- **Language:** internet Chinese in small doses (家人们, 点赞, 关注,
  666), correcting someone politely (不对，是……), directions for a
  camera (左边一点).

#### 米沙 Mǐshā, the other learner (tones!)
- **Who:** a Russian exchange student, three months ahead of you and
  sure he speaks perfectly. He doesn't: his tones go wrong in the famous
  ways. He's kind, brave, always ready to try again — a mirror for the
  learner.
- **Episodes:** (1) 早点铺: he orders 「两个豹子」 (bàozi, leopards)
  instead of 包子 (bāozi); the seller's face; you help. (2) he wants
  水饺 (shuǐjiǎo) and asks where to 睡觉 (shuìjiào). (3) he wants to
  *ask* (问 wèn) a girl something and says *kiss* (吻 wěn) — the classic;
  cutscene of mortal embarrassment. (4) 买 mǎi / 卖 mài at 潘家园: he
  tries to buy and accidentally sells his watch. (5) 春节: he gives a
  toast at 年夜饭 with perfect tones — the ending cutscene, 王阿姨 claps.
  Every mistake is a **real minimal pair** (verify each pair's pinyin
  and tones); every episode ends with 兔儿爷 saying the two words so
  the learner *hears* the difference (🔊 on both). Book 《声调》 — tones
  with his mistakes as examples.
- **Language:** tones, the thing learners fear most, made funny.

#### U-check — checks
Every episode played by the solver with its hints; `world:check`: each
substory has ≥ 4 episodes, each on some chapter's route, each with a
cutscene; the four motifs render (offline audio check, as for music).

---


#### V5 — the final look pass (after the content, before Z9)
Walk every map in the pane at 1024 day and night and at 375; fix empty
stretches (no more than ~6×6 tiles of bare ground without a prop, a
person or a texture change), roof bands > 25 % of the screen, props that
float, people that clip. Before/after renders per map in `review/v/`.

---

### Z9 — the end-of-§13 check and the morning notes
- Solver plays the whole game start → 元宵 credits with only its hints,
  including every substory; golden saves at each chapter start (new
  ones for ch 5, 9); every old golden save upgrades and finishes.
- Coverage strict (`WORLD_COVERAGE=strict world:check` passes): every
  map on a main route except the listed exceptions.
- WebKit + Chromium probes: cutscene (letterbox, skip, a line tap), the
  reader (a page, English toggle, 拼), the bike shop, Journal → Side at
  375 / 768 / 1024 light/dark.
- `review/`: `k/` (cutscene strips), `t/` (maps before/after), `v/` (kit,
  animations as strips), `l/` (bikes), `b/` (a page of each book).
- Morning notes in STATUS.md (Russian, as before): what to play first
  (chapter 1 from a new game to see the new opening and route; then a
  golden save at chapter 5 for the temples), what's unchecked, the facts
  you could not confirm.
