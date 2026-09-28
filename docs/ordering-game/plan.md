# Build: 点单 — ordering in Chinese mini-apps (Play section)

> **Status:** plan approved with changes (2026-09-27). **All four phases
> built 2026-09-27:** the kit, 瑞幸咖啡 (with 外送), 蜜雪冰城, 外婆家, 点都德,
> 马记永, 喜家德 and 海底捞, and budget and coupon orders. What was built, and
> where it differs from this plan, is in **§12**; what is left is in **§13**.
> The requirements summary is in `docs/visual-learning/requirements.md`
> §C.4.13; the brand research is in `docs/ordering-game/brands.md`.

---

## 0. Who this is for and what "done" means

The learner is at HSK 1–2, speaks Russian, and reads the app's UI in English.
They practise 20–30 minutes a day, mostly on an iPad (sometimes an iPhone), in
Safari through the Vercel deployment. They want to walk into a Luckin, a
蜜雪冰城, a noodle bar, a 早茶 restaurant or a 海底捞, open the WeChat
mini-program, and order **without friction**: know every button, every option
and every word on the checkout page, and never freeze at "少冰还是去冰？".

**Done means:** in the Play section there is a set of ordering games. Each one
copies one real brand's WeChat mini-program: its name, colours, screens, flow
and wording — the start screen, a scrollable menu with photos, a sheet for
options and add-ons, the cart, checkout, payment and the pickup screen. The
learner fills realistic orders. The game checks each order against what was
asked. A **guide sidebar** is always beside the phone for when the learner
gets lost. Help with any word is one tap away, and it is never shown unless
asked for.

This is for the learner's own use (the site is behind their sign-in), so the
games use **the real brand names**.

## 1. Read these first

1. `src/games/README.md`, `src/games/types.ts`, `src/games/registry.ts`.
2. `src/games/shop/`, `src/games/kit/`.
3. `src/features/play/GamePage.tsx`, `PlayPage.tsx`.
4. `.claude/skills/hanzi-design/SKILL.md` and `src/styles.css` (§4.1 explains
   why the phone deliberately looks different).
5. `scripts/images/README.md`: the real-photo pipeline; menu photos reuse it.
6. `src/platform/audio/voiceOut.ts` and `src/ui/Say.tsx`.
7. `docs/visual-learning/requirements.md` §0 (R1–R9) and §C.4.13.
8. Standing rules: no layout shift; compact one-line toolbars; real photos
   only for food and drink (no icons standing in, no hanzi over photos);
   pronunciation from native recordings only; games never reach the review
   schedule; tap opens (no "i" buttons); check in WebKit, at 375×812 and
   768×1024, and in dark mode; commit through a private `GIT_INDEX_FILE`,
   explicit paths; preview on `HANZI_DB=.data/test.db`.

## 2. What the real mini-apps look like

Check each shop's current wording before building it, and write it into
`docs/ordering-game/brands.md` with sources. **The brand wins** over this
summary.

### 2.1 Shared WeChat chrome

- Nav bar: title centred; the WeChat **capsule** (`···` and `◎`) on the right.
- Tab bar (chain shops): `首页 · 菜单/点单 · 购物车 · 订单 · 我的`.
- Floating cart bar: icon with a red badge, `¥23.5` (struck original when a
  coupon applies), `去结算`; empty: `未选购商品`, button greyed.
- Bottom sheets for options (`选规格`) with `×`.
- Toasts: `已加入购物车`, `请选择温度`.
- Payment: the WeChat Pay sheet — amount, merchant, `零钱`, `输入支付密码`
  with a 6-digit pad; then `支付成功`, `完成`.
- Prices `¥23` / `¥23.5`, yuan sign small, number large.

### 2.2 瑞幸咖啡 — phase 1

- 首页: banner, `到店取`/`外送` tiles, coupon strip, member level, new drinks.
- 菜单: store picker, `自提 | 外送`, category rail with scroll-spy (`人气TOP`,
  `新品`, `生椰家族`, `经典拿铁`, `美式家族`, `瑞纳冰`, `果蔬茶`, `轻食`),
  product rows (photo, name, description, tag, struck price and `预估到手`,
  `+` or `选规格`).
- 选规格: `温度` 冰/热 only; `糖度`; `奶`; `浓度`; `杯型`; price, stepper,
  `加入购物车`, `立即购买`.
- 确认订单: 自提/外送, store, `预计 10:42 可取`, `取餐方式` 堂食/外带, lines
  with grey specs, `优惠券`, `备注` (chips `少冰`, `多加冰`, `去冰`),
  `支付方式 微信支付`, `合计 … 已优惠 …`, `去支付`.
- After paying: `取餐码`, QR, `已下单 → 制作中 → 请取餐`, expected time.

### 2.3–2.8 Later brands

- **蜜雪冰城** (phase 2): 杯型 中杯/大杯, 冰量 正常冰/少冰/去冰/常温/热 (热
  removes the ice options; some drinks 仅冰饮), 糖度 ×5, 加料 multi-select at
  +¥1/+¥2; each spec combination its own cart line.
- **外婆家** (phase 2, 扫码点餐, 先吃后付): 桌号, 就餐人数, categories 招牌推荐 ·
  凉菜 · 热菜 · 主食 · 汤羹 · 酒水饮料, 月售, spice marks, 规格 大份/小份,
  辣度, 米饭 per 碗, 餐具 per person (automatic), 备注 chips (不要香菜, 不要葱,
  少油, 少盐, 不吃辣, 打包), 下单 → 加菜 / 呼叫服务员 / 催单 → 去买单.
- **马记永** (phase 3, 先付后吃): 大碗/小碗, 加肉/加蛋/加面, 面型 毛细 · 细 ·
  三细 · 二细 · 韭叶 · 宽 · 大宽, 辣子/香菜/蒜苗 要/不要, 取餐号 A047.
- **喜家德** (phase 3): ordering by 两 (一两约6个, 二两, 三两, 半斤), 馅,
  水饺/煎饺/蒸饺, 醋 蒜 辣椒油, 饺子汤, 豆浆.
- **海底捞** (phase 3): diners first; 锅底 鸳鸯 (two soups) / 四宫格 / 清汤 /
  番茄 / 麻辣 with 微辣/中辣/特辣; 整份/半份 (≈60%); 荤菜/素菜/丸滑/主食/小吃;
  调料 per person.
- **点都德** (phase 3, 早茶 + 烧味): 桌号, 人数, required 选茶 with 茶位费 per
  person (普洱, 铁观音, 菊花, 香片, 菊普); 招牌点心 · 蒸点 · 煎炸 · 肠粉 · 粥 ·
  烧味 · 甜品 · 茶; dim sum per 笼/份; 烧味 例牌/半只/一只 and 份; 烧味双拼饭
  (two meats); notes 少辣, 走葱, 加辣; culture tips (finger-tapping, lid
  ajar).
- **Delivery** (phase 4, in 瑞幸 as `外送`): address sheet, `预计 12:35 送达`,
  `起送 ¥20`, `配送费`, `打包费`, `满30减8`, `餐具数量`, `备注`.
- **Identity:** real brand names; brand colours as CSS variables
  (`--brand`, `--brand-soft`, `--brand-ink`); logos as **text wordmarks**
  only; menus in the brand's style with its signature items.

## 3. Shape of the feature

### 3.1 Where it lives

A shared kit, `src/games/order-kit/`, and one game per brand, each its own
folder and registry line:

| Game id | Brand | Phase |
|---|---|---|
| `order-luckin` | 瑞幸咖啡 | 1 |
| `order-mixue` | 蜜雪冰城 | 2 |
| `order-waipojia` | 外婆家 | 2 |
| `order-dimsum` | 点都德 (早茶 + 烧味) | 3 |
| `order-majiyong` | 马记永 | 3 |
| `order-xijiade` | 喜家德 | 3 |
| `order-haidilao` | 海底捞 | 3 |

`'ordering'` is added to `GameTopic`. Each shop's data is in
`src/games/order-<brand>/menu.ts`.

### 3.2 One game = a few orders

Rounds are orders (3; 4 for table service). Each: the task arrives as a
WeChat chat bubble from a friend (Chinese only, English through help); the
mini-app opens at its start screen; the learner orders; **checking happens at
`去支付`/`下单`** against the task's required facts (unasked options may be
anything). Right: payment, then pickup, reported `correct` (`firstTry` only
without help, §3.5). Wrong: the friend's modal names what is wrong; the
second try counts as `firstTry: false`; wrong again: missed, with a "You
ordered / They asked for" card. From level 2 a **reading check** on the
pickup screen: `取餐码是多少？`, `一共多少钱？`, `几点可以取？`, `优惠了多少？`,
answered by tapping the screen. `prompt` = the message, `answer` = the short
form, `items` = the HSK words the order used.

### 3.3 Levels

| Lvl | The order asks for | Example |
|---|---|---|
| 1 | one item, one option | 一杯热美式 |
| 2 | one item, 2–3 options, pickup or dine-in | 一杯冰生椰拿铁，少少甜，打包 |
| 3 | two items, or one item ×2 with different specs, plus a note | 两杯奶茶：一杯去冰半糖加珍珠，一杯热的无糖 |
| 4 (table) | diners, dishes, portions, spice/tea, note, 加菜 | 我们三个人，喝普洱… |

Band 1: levels 1–2; band 2: 2–3 (4 for table service). Extra kinds, one per
game at most (phase 4): budget, coupon, delivery.

### 3.4 The help layer

Chinese alone by default. **Press and hold** any Chinese (~450 ms, cancelled
by movement) for a popover: hanzi, pinyin, English, a note, and a native
recording where the pack has one. A normal tap keeps its meaning. **`拼`**
puts pinyin over every label. A **first-visit tour** of numbered coach marks.
**Menu words**: every word the shop uses, grouped, with photo, pinyin,
English and a note.

### 3.5 Help is free

~~A right order is `firstTry: false` when the learner turned on `拼`, used
`下一步`, or looked up 3 or more words.~~ Dropped 2026-09-28: the mark taught
nothing and made using help feel like failing. A right order is first try
when it was right at the first 去支付, whatever help was used; the sidebar no
longer shows `Help used` / `No help yet`.

### 3.6 The guide sidebar

Paper style, beside the phone: 任务 (message + breakdown chips, no ticks),
你在这里 (the flow as a map; tapping an earlier step goes back with the cart
kept), 这一页 (every label on the screen; opening one outlines it and shows
its words as chips that open the word drawer), 下一步 (one English line,
pulses the control), tools (`拼`, Replay tour, Menu words — shown in the
guide's place, not over the phone — Start over), a tip. iPad: side by side;
phone: a Guide handle and a right-hand drawer (85%, scrim, swipe to close).
Folded sections remembered per device.

### 3.7 Intro and free mode

Intro: wordmark, one sentence, the help rule, **Take orders**, **Just
browse** (no task, nothing reported, `finish()` never called), **Menu
words**. The tour runs on the first entry.

## 4. The kit

### 4.1 Look

Inside the stage the phone **is a WeChat mini-program** (WeChat white/grey,
the brand colour, system sans-serif Chinese, bold prices, red badges), scoped
under `.ok-app` and themed by the brand variables, with WeChat's dark mode.
Everything outside the phone uses the app's paper style. iPad: a 390px phone
with a thin bezel; phone: fills the stage. Only lists and the sidebar scroll,
with `overscroll-behavior: contain`. Motion: sheets 0.2s, badge 0.12s,
drawer 0.2s; reduced motion fades. No iOS text-selection on long press.

### 4.2 Components

`OrderStage`, `MiniApp`, `TabBar`, `StartScreen`, `TableLanding`,
`MenuScreen`, `ProductRow`, `SpecSheet`, `CartBar`/`CartSheet`, `Checkout`,
`PaySheet` (any six taps; "Practice — never type a real password here"),
`PickupScreen`, `TableOrder`, `GuideSidebar`, `Toast`, `Modal`, `HelpText`
(every visible Chinese string goes through it; a test enforces a glossary
entry for each).

### 4.3 Order model (pure)

`MenuItem`, `OptionGroup`, `Line` (same choices merge), `Order`,
`price(order, menu)`, `Flow`, `Task { message, parts, wants, level }`,
`check(order, task) → { ok, misses }`, `nextHint`, `buildTasks` from
templates, `HelpLog` / `usedHelp`. Free of React, unit-tested.

## 5. Per-brand content

25–40 items across 5–8 categories, real option groups, realistic prices,
10–15 task templates, a glossary, tips per screen, a start screen. Menu words
are not limited to HSK — the documented exception to R8.

| Shop | Price range |
|---|---|
| 瑞幸 | ¥9.9–¥32 (with coupon prices) |
| 蜜雪冰城 | ¥4–¥15 |
| 马记永 | ¥22–¥38 |
| 喜家德 | ¥6–¥12 per 两 |
| 外婆家 | dishes ¥12–¥58 |
| 点都德 | dim sum ¥18–¥42, 烧鹅 例牌 ¥68 / 半只 ¥118, 茶位 ¥8/位 |
| 海底捞 | soups ¥48–¥98; dishes ¥18–¥68, half portions ≈60% |

## 6. Photos

Real photos through the same pipeline with `--set menu`
(`scripts/images/menu.json` → `public/images/menu/`, `CREDITS.md`,
`src/data/menuPictures.json`), paced at 3 s, reviewed by hand: the dish as
served. No illustrations; never from the brands' apps or sites. Items may
share photos. Credits as `.tiny` text in the product sheet.

## 7. Tests

`order-kit/order.test.ts` (pricing, merging, rules, `check`, `nextHint`,
`usedHelp`); per brand `content.test.ts` (every band builds, same seed same
tasks, every task solved by the order built from its wants, glossary covers
every sentence and chip, the flow covers every screen); glossary coverage of
every Chinese string. `npx tsc -b` and `npm test` pass.

## 8. Verification

Test DB preview; per brand one scored game and one browse at 768×1024 and
375×812, light and dark; screenshots of every screen and both sidebar
layouts; the sidebar checks; WebKit (`scripts/webkit-probe.swift`); reduced
motion; nothing moves when a popover, toast or pulse appears; the results
list the message and short answer; send the learner the screenshots.

## 9. Phases

1. **Kit + 瑞幸咖啡** — then stop and show the learner.
2. **蜜雪冰城 + 外婆家.**
3. **点都德, 马记永, 喜家德, 海底捞.**
4. **Delivery and extras** (瑞幸 外送; budget and coupon tasks everywhere).

## 10. Not in scope

Speaking to a waiter; TTS staff lines; trademark logos; photos from the
brands; anything that writes to the review schedule; real payments or
passwords.

## 11. The learner's decisions (2026-09-27)

- **D1 Shops:** the original six plus 点都德 (早茶 + 烧味).
- **D2 Brands:** the real brand names; text wordmarks.
- **Guide sidebar** (§3.6).
- **D3 Help costs the first-try mark:** yes at first; dropped 2026-09-28 (§3.5).
- **D4 Task language:** Chinese only, English through help (the default; not
  answered explicitly).
- **D5 Order:** coffee (瑞幸) first.

## 12. Phase 1 — what was built, and where it differs

**Built:** `src/games/order-kit/` — `types.ts`, `order.ts` (pricing, merging,
rules, `check`, `nextHint`, `HelpLog`, `solve`), `tasks.ts`, `gloss.ts`
(kit glossary, segmenting a sentence into glossary entries), `strings.ts`
(every fixed Chinese string of the chrome), `help.tsx` (`<T>`, long press,
popover, native-only speaker), `screens.tsx` (chat, home, menu, spec sheet,
cart, checkout, coupon and note sheets, pay, pickup), `MiniApp.tsx`,
`GuideSidebar.tsx`, `Tour.tsx`, `OrderGame.tsx` (intro, rounds, browse,
drawer, diff card, menu words), `order-kit.css`; `src/games/order-luckin/`
(23 items in 8 categories, 5 option groups, 3 coupons, 12 templates, the
glossary, tips, the tour); `--set menu` in the photo scripts. 24 tests.

**Differences from the plan:**

- **Photos:** the build container could not reach Wikimedia, so the menu set
  has its queries (`scripts/images/menu.json`) but no photos yet. Until
  `fetch/review/build --set menu` is run on the Mac, items show the word
  photo named in the brand's `photos` (a cup of coffee for the coffee drinks,
  tea, bread for croissants) or an empty box of the same size — never a
  drawing.
- **Research:** most Chinese sites were blocked too; `brands.md` marks what
  was confirmed and what follows the plan. The luckin blue is not measured.
- **WebKit:** checked in Chromium only (with touch emulation, at 375×812 and
  768×1024, light and dark, reduced motion). `scripts/webkit-probe.swift`
  needs the Mac.
- **Side by side from a 690px stage**, not 760: at 768 wide the stage is
  about 736px, and the plan wants the iPad side by side.
- **On a phone** the Guide handle sits in a 26px gutter beside the phone
  rather than over it, so it can never cover the cart bar, `去结算` or a row's
  button. 下一步 from the drawer closes the drawer and keeps its line over the
  nav bar for a few seconds.
- **这一页** lists the labels in view (and only the open sheet's when one is
  open), Chinese only until opened — showing the English on every row would
  make lookups free.
- **Levels:** band 1 plays 1, 2, 2; band 2 plays 2, 3, 3. Orders in a game
  avoid repeating an item where the templates allow.
- **Coupons:** the app picks the best coupon by itself (`已选1张`), as luckin
  does; the learner can change it or choose `不使用优惠券`. Coupon and budget
  tasks are phase 4.
- **外送** shows `外送即将开放` until phase 4.
- **The reading check** is not scored; 完成 waits until it is answered.
- **Friend's words vs the app's:** the friend says 不加糖 where the app says
  不另外加糖, and 打包/带走/在店里喝 where it says 外带/堂食 — on purpose.

## 12b. Phases 2–4 — what was built, and where it differs

**The kit, generalised** (`src/games/order-kit/`):

- Three ways a shop works (`Brand.model`): `chain` (瑞幸, 蜜雪冰城), `counter`
  (马记永, 喜家德: 先付后吃, a 取餐号 like A047, 请留意叫号) and `table` (外婆家,
  点都德, 海底捞: 扫码点餐 → 就餐人数 / 选茶 → menu → 确认下单 → 下单 → at the
  table (加菜 · 呼叫服务员 · 催单) → 去买单 → the bill → pay → 买单成功).
  `SCREENS_OF` lists each model's screens; each brand's flow must match it.
- Option groups: many-of groups with prices in the line (加料), exact picks
  (`pick: 2` for 双拼 and 鸳鸯锅, `pick: 4` for 四宫格), groups that show only
  with another choice (`showIf`: 辣度 appears once 麻辣 is in the pot), options
  that multiply the price (半份 ×0.6, 三两 ×3) and per-item prices that replace
  it (烧鹅 例牌 ¥68 / 半只 ¥118 / 一只 ¥228).
- Fees on the bill (`Brand.fees`): per person (餐具 ¥2, 茶位费 ¥8, 调料 ¥10),
  per order or per item, some only on delivery (配送费, 打包费).
- Table orders keep their batches (`Order.placed`); a level-4 task has a
  second message (`Task.later`) that arrives after the first 下单 as a pop-up
  from the friend, and is checked at the next 下单. 去买单 before it is done
  counts as a miss. Tries are shared across both messages.
- New wants: 就餐人数, the tea, 外送 / the address / 餐具数量, a coupon (a
  named one, or any), and a budget (the total paid, fees included).
- Coupons: 瑞幸 picks the best one itself (`autoCoupon`), the others do not.
- One budget, coupon or delivery order per game at most (`extra` templates).
- The reading check asks, by model: 取餐码/取餐号, 一共多少钱, 几点可以取 or
  几点送到, 优惠了多少, 桌号是多少, 茶位费一共多少.
- `suite.test.ts`: the checks every brand runs — full games at both bands,
  same seed same tasks, every task of 250 seeds × 2 bands solved by the order
  built from its wants (both messages), every template used, every sentence,
  chip and label covered by the glossary, **following 下一步 alone gets every
  order of 60 seeds × 2 bands paid** (a model-level walk that presses what
  the hint points at), the flow matching the model, 20–40
  items, 5–9 categories, 10+ templates, photo keys in `menu.json`, item HSK
  words real.

**The brands** (`src/games/order-<brand>/`): 蜜雪冰城 21 items / 12 templates,
外婆家 24 / 11, 点都德 26 / 11, 马记永 21 / 11, 喜家德 21 / 11, 海底捞 24 / 10,
瑞幸 23 / 16 (with 外送, budget and coupon orders). Photos: every key is in
`scripts/images/menu.json`; word photos stand in where one fits (奶茶, 米饭,
饺子, 包子, 绿茶, 红茶, 鸡蛋, 咖啡, 面包).

**Differences from the plan:**

- **马记永 面型:** 薄宽 rather than 宽 (the brand's word).
- **喜家德 by the 两**, although today's stores sell plates of 12 (see
  `brands.md`): the 两 is kept for the 两 vs 二 lesson.
- **蜜雪冰城 热:** 热饮 is an option of 冰量 itself, as in the real app, so the
  "热 removes the ice options" rule never comes up there.
- **海底捞 prices:** flat prices per pot instead of 单锅/拼锅/per-cell prices.
- **Coupons at table service:** none — scan-to-order bills in the game have no
  coupon step. Coupon orders are in 瑞幸, 蜜雪冰城, 马记永 and 喜家德; budget
  orders are in all seven.
- **Level 4** is played at band 2 only (band 1 table games are levels 1–2), and
  a band-2 table game is 2, 3, 3, 4.
- **PlayPage** has no topic headings, so the ordering games are not grouped
  under an "Ordering" heading; they come last in the registry, in order.

## 13. What is left to do

These need the Mac, or a container that can reach the hosts named.

- [ ] **Menu photos** for all seven brands: `fetch.py`, `review.py` and
      `build.py` with `--set menu`; pick in `scripts/images/menu-picks.json`.
      84 keys in `scripts/images/menu.json`. Needs
      `commons.wikimedia.org`, `en.wikipedia.org`, `upload.wikimedia.org`.
- [ ] **WebKit check** (`scripts/webkit-probe.swift`) and the real iPad and
      iPhone: the long press, the drawer, the phone height with Safari's bars.
- [ ] **Brand check against the real apps:** every colour (none measured),
      the 瑞幸 sugar and cup names, 马记永's 加面 price, the 外送 screen.
- [ ] **Learner review** of each shop.

Known gaps:

- [ ] No test plays one order through the screens with no help and checks
      that `firstTry: true` is reported (the rule itself is unit-tested).
- [ ] 这一页 does not update while a sheet slides up; it catches up on the
      next scroll or tap.
- [ ] The results page's 🔊 speaks the short form through `say()`, which
      falls back to the system voice when there is no native recording.
- [ ] The tour covers the menu only.
- [ ] Coupons at table service, and 外送 for shops other than 瑞幸.
