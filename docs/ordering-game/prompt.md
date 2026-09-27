# Build: 点单 — ordering in Chinese mini-apps (Play section)

> **Status:** plan approved with changes (2026-09-27). Build **phase 1 (the
> kit + 瑞幸咖啡)** first and make it perfect before starting the other
> shops. The learner's decisions are recorded in §11. The requirements
> summary is in `docs/visual-learning/requirements.md` §C.4.13.

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
and wording. That covers the start screen, a scrollable menu with photos, a
sheet for options and add-ons, the cart, checkout, payment and the pickup
screen. The learner fills realistic orders. The game checks each order
against what was asked. A **guide sidebar** is always beside the phone for
when the learner gets lost. Help with any word is one tap away, and it is
never shown unless asked for.

This is for the learner's own use (the site is behind their sign-in), so the
games use **the real brand names**.

---

## 1. Read these first (in this order)

1. `src/games/README.md`, `src/games/types.ts`, `src/games/registry.ts`: how a
   game plugs in. A game is a folder plus one line in the registry. It never
   touches the store or the router.
2. `src/games/shop/`: the closest existing game (money, prices, `priceZh`).
   Also `src/games/kit/` (`useRounds`, `Feedback`, `Photo`, `rng`,
   `fixture.test.ts`).
3. `src/features/play/GamePage.tsx`: the host frame (✕, name, progress dots,
   results, seal). `PlayPage.tsx`: the cards.
4. `.claude/skills/hanzi-design/SKILL.md` and `src/styles.css`: the app's
   look. §4.1 explains why the phone deliberately looks different.
5. `scripts/images/README.md`: the real-photo pipeline (Wikipedia/Commons →
   review sheet → picks → build). Menu photos reuse it (§6).
6. `src/platform/audio/voiceOut.ts` and `src/ui/Say.tsx`: the only way to
   make Chinese audible.
7. `docs/visual-learning/requirements.md` §0 (rules R1–R9) and §C.4.13
   (this feature, including the two rules it relaxes).
8. Standing rules from the learner:
   - **No layout shift.** Controls render from the start (disabled while
     loading). Labels that change keep a fixed width. Photos sit in boxes that
     are sized before they load.
   - **Compact, one-line toolbars** (`nowrap` + horizontal scroll). Actions
     for an item sit on that item.
   - **Real photos only** for food and drink. No icons or clip-art standing
     in for food, and no hanzi drawn over a photo.
   - **Pronunciation comes from native recordings only.** Never make anything
     that *teaches pronunciation* from TTS. `say()` already prefers the native
     pack.
   - Games lean towards known words and **never reach the review schedule**.
   - **Tap opens.** No "i" buttons. Tapping a thing does the natural thing.
   - Check in **WebKit**, not only in the Chromium pane
     (`scripts/webkit-probe.swift`). Check at 375×812 and 768×1024, and in
     dark mode.
   - **Git:** other sessions share this checkout. Commit through a private
     `GIT_INDEX_FILE`, stage explicit paths, never `git add -A`.
   - **Dev DB:** the preview uses the *production* database. Start it with
     `HANZI_DB=.data/test.db` for anything that writes.
   - Node: `export PATH=/opt/homebrew/bin:$PATH` (Node 25).

---

## 2. What the real mini-apps look like (research summary)

Copy these patterns faithfully. **Before building each shop, check its
current wording** with a web search: screenshots in Xiaohongshu/CSDN posts,
"仿XX小程序" clone write-ups, ordering guides. Write what you find (screen by
screen: labels, option groups in their real order, the colours) into
`docs/ordering-game/brands.md`, citing sources. Where the brand's wording
differs from the summary below, **the brand wins**.

### 2.1 Shared WeChat mini-program chrome

- **Top nav bar:** page title centred. On the right is the WeChat **capsule**
  (a rounded pill with `···` and a `◎` close ring). Every mini-program has it,
  and it is not the shop's own control.
- **Bottom tab bar** (chain shops): `首页 · 菜单/点单 · 购物车 · 订单 · 我的`.
  The active tab is in the brand colour.
- **Floating cart bar** above the tab bar on menu pages: a cart icon with a
  red count badge, the total `¥23.5` (plus a struck-through original price
  when a coupon applies), and a `去结算` button. When the cart is empty it
  reads `未选购商品` and the button is greyed out.
- **Bottom sheets** for options (`选规格`). They slide up, dim the page, and
  have a `×` at the top right.
- **Toasts:** `已加入购物车`, `请选择温度` (when a required option is missing).
- **Payment** is the WeChat Pay sheet: `¥23.50`, the merchant name, `零钱`
  or bank card, then `输入支付密码` with a 6-digit pad (or 面容/指纹). After
  that come `支付成功` and `完成`.
- Prices are shown as `¥23` or `¥23.5`, with the yuan sign small and the
  number large. Spoken as `二十三块五`.

### 2.2 瑞幸咖啡 luckin coffee — phase 1

- **首页:** big banner carousel, then two big entry tiles: pickup
  (`到店取`/`自提`) and delivery (`外送`). Below them: coupon strip
  (`优惠券 3张`), member level, new-product tiles.
- **菜单:** at the top, the store picker (`北京三里屯店 · 距您 350m`) and a
  segmented `自提 | 外送` switch. On the left, a **category sidebar**
  (`人气TOP`, `新品`, `生椰家族`, `经典拿铁`, `美式家族`, `瑞纳冰`, `果蔬茶`,
  `轻食`) that scroll-spies the right-hand list. On the right, product rows
  with a square photo, name, one-line description, a tag (`新品`, `爆款`,
  `IIAC金奖豆`), the price (`¥29` struck through, `预估到手 ¥13.9`), and a
  round `+` button (or `选规格` when options are required).
- **选规格 sheet:** photo and name, then option groups as pill rows:
  - `温度`: `冰` / `热`. Only these two; anything else goes in 备注.
  - `糖度`: `不另外加糖` / `少少甜` (~25%) / `微甜` or `少甜` (~50%) /
    `标准甜`, depending on the drink.
  - `奶`: `纯牛奶` / `燕麦奶` / `厚乳` (drink-dependent).
  - `浓度` or `咖啡豆`: `标准` / `双份浓缩 +¥3`.
  - `杯型`: `大杯 16oz` (often the only size) / `超大杯 +¥3`.
  - At the bottom: price, a quantity stepper `− 1 +`, then `加入购物车` and
    `立即购买`.
- **确认订单 (checkout):** `自提 | 外送` at the top left, then the store and
  `预计 10:42 可取`. `取餐方式`: `堂食` / `外带`/`打包`. Then the line items
  with their specs in grey (`冰/少甜/燕麦奶`), `优惠券` (`已选1张 -¥16`),
  `备注` (free text or quick chips `少冰`, `多加冰`, `去冰`), and
  `支付方式 微信支付`. A fixed bottom bar shows `合计 ¥13.9 已优惠¥16` and
  `去支付`.
- **After paying:** `取餐码 2361` in huge digits, a QR code, the status
  stepper `已下单 → 制作中 → 请取餐`, and `预计 3 分钟后可取`.

### 2.3 蜜雪冰城 — bubble tea

- Same shell, in Mixue red.
- **Spec sheet.** All groups are required except 加料:
  - `杯型`: `中杯` / `大杯 +¥2` (drink-dependent)
  - `冰量`: `正常冰` / `少冰` / `去冰` / `常温` / `热`. Choosing `热` removes
    the ice options, and some drinks are `仅冰饮`.
  - `糖度`: `正常糖` / `少糖` / `半糖` / `微糖` / `无糖`
  - `加料` (multi-select): `椰果`, `布丁`, `仙草`, `燕麦`, `红豆` at `+¥1`
    each; `黑糖珍珠`, `芋圆`, `寒天`, `西米` at `+¥2` each.
- The cart puts **each spec combination on its own line**, and add-on prices
  go into that line's unit price.
- Icons: the brand's 雪王 mascot may appear as a small decorative mark only if
  a freely licensed image exists (see §6). Otherwise use the wordmark alone.

### 2.4 外婆家 — sit-down restaurant, scan the table QR (扫码点餐, 先吃后付)

- **Landing after the scan:** restaurant name, `桌号 A08`, and a sheet
  `请选择就餐人数` (a grid 1–10+). Then `开始点餐`.
- **Menu:** categories `招牌推荐 · 凉菜 · 热菜 · 主食 · 汤羹 · 酒水饮料 ·
  必点`. Dishes show a photo, `月售 386`, a spice mark, and a price. Some
  dishes open a sheet: `规格 大份/小份`, `辣度 不辣/微辣/中辣/特辣`,
  `做法`. `米饭` is sold per `碗`.
- **必选 item:** `餐具` per person (`¥1/套` or `¥2/位`), added automatically
  from the diner count. The learner must notice it.
- **Cart and submit:** `备注` quick chips (`不要香菜`, `不要葱`, `少油`,
  `少盐`, `不吃辣`, `打包`). Then `下单`, then `下单成功，菜品正在准备中`.
- **During the meal:** `加菜` (add more; it goes onto the same order),
  `呼叫服务员`, `催单`.
- **At the end:** `去买单` shows a summary (`菜品 ¥186 · 餐具 ¥4 · 合计
  ¥190`), then WeChat Pay, then `买单成功`, `欢迎再次光临`.

### 2.5 马记永 — Lanzhou beef noodles (先付后吃)

- `碗型`: `大碗` / `小碗`. Add-ons: `加肉 +¥8`, `加蛋 +¥2`, `加面 +¥3`.
- `面型` (the shop's signature choice): `毛细` / `细` / `三细` / `二细` /
  `韭叶` / `宽` / `大宽` (thin → thick; the last three are flat).
- `辣子`: `要`/`不要` (or `少辣`). `香菜`, `蒜苗`: `要`/`不要`.
- Side dishes: `凉菜 · 小菜`. After paying: `取餐号 A047`, `请留意叫号`.

### 2.6 喜家德 — dumplings (ordering by 两)

- Dumplings are counted in **`两`** (the menu shows `一两(约6个)` or a
  份 with its 两). People order `二两`, `三两`, `半斤`. This is the best
  real-world lesson in **两 vs 二**.
- `馅` (filling): e.g. `虾三鲜` (the brand's signature), `猪肉白菜`,
  `韭菜鸡蛋`, `牛肉大葱`, `素三鲜`. The way they are cooked:
  `水饺` / `煎饺` / `蒸饺` (as the brand offers).
- Extras: `醋`, `蒜`, `辣椒油`. Drinks: `饺子汤`, `豆浆`.

### 2.7 海底捞 — hotpot

- The number of diners comes first. `锅底`: `鸳鸯锅` (two halves: pick each
  soup), `四宫格`, `清汤`, `番茄`, `麻辣` with `微辣/中辣/特辣`.
- Dishes come as `整份` / `半份` (half portion at about 60% of the price).
  Groups: `荤菜`, `素菜`, `丸滑`, `主食`, `小吃`.
- `调料`/`小料台` is charged per person (`¥10/位`). This is a fixed line the
  learner must understand.

### 2.8 点都德 — Cantonese 早茶: dim sum **and roast meats**

A Guangzhou-style morning-tea restaurant, ordered by scanning the table QR.
This is the shop for **dim sum and 烧味 (roast meats)** together, as a real
早茶 house serves them.

- **Landing:** `桌号`, `就餐人数`, then **`选茶`**: the tea is charged per
  person as `茶位费 ¥8/位`. Teas: `普洱`, `铁观音`, `菊花`, `香片`,
  `菊普` (普洱 + 菊花). Tea choice is required before the menu opens.
- **Menu categories:** `招牌点心 · 蒸点 · 煎炸 · 肠粉 · 粥 · 烧味 ·
  甜品 · 茶`.
- **Dim sum** (each is `一笼`/`一份`, usually 3–4 pieces, and some are priced
  in tiers): `虾饺皇`, `干蒸烧卖`, `叉烧包`, `流沙包`, `豉汁蒸凤爪`,
  `豉汁蒸排骨`, `鲜虾肠粉`, `叉烧肠粉`, `萝卜糕`, `马拉糕`, `糯米鸡`,
  `蛋挞`, `皮蛋瘦肉粥`, `艇仔粥`.
- **烧味 (roast meats)** use real portion words: `例牌` (standard plate) /
  `半只` / `一只` for 烧鹅 and 白切鸡, and `份` for the rest: `蜜汁叉烧`,
  `脆皮烧肉`, `烧鹅`, `白切鸡`, `豉油鸡`. There are also rice plates:
  `烧味双拼饭` (pick two meats), `叉烧饭`.
- **Notes:** `少辣`, `走葱` (Cantonese for "no scallion"; the glossary
  explains 走 = without), `加辣`.
- **Culture tips for the sidebar:** knock two fingers on the table to thank
  someone for pouring tea. Leave the teapot lid ajar to ask for more hot
  water. Cantonese names are read in Mandarin here, and a Cantonese reading
  may appear in the glossary as a note.

### 2.9 Delivery (外卖) — later phase

This path lives inside 瑞幸 as its `外送` path: an address sheet
(`收货地址`), `预计 12:35 送达`, `起送 ¥20`, `配送费 ¥3`, `打包费 ¥1`,
`满30减8`, `餐具数量` (`无需餐具`), and `备注`.

### 2.10 Brand identity

- Use each **real brand name** in the nav bar, the start screen, the payment
  sheet's merchant line and the Play card.
- **Brand colours** are CSS variables per shop (`--brand`, `--brand-soft`,
  `--brand-ink`), taken from the brand's own public site or app. Record them
  in `brands.md`.
- **Logos:** show the name as a **text wordmark** in the brand colour and
  typeface mood. Do not download or redraw trademark logo artwork. It adds
  nothing to the learning, and a wordmark reads the same at a glance.
- Menus are **in the brand's style, not a copy of today's menu**. Use the
  brand's signature items where they are well known (生椰拿铁, 酱香拿铁,
  冰鲜柠檬水, 虾饺皇, 虾三鲜) and fill the rest with common items of the
  genre.

---

## 3. Shape of the feature

### 3.1 Where it lives

- A shared **mini-app kit**: `src/games/order-kit/`. It is used by every
  ordering game and by nothing else.
- **One game per brand.** Each is its own folder and registry line, so each
  gets its own card, record and seal on `/play`. More brands can be added
  later the same way:

  | Game id | Brand | Phase |
  |---|---|---|
  | `order-luckin` | 瑞幸咖啡 | 1 |
  | `order-mixue` | 蜜雪冰城 | 2 |
  | `order-waipojia` | 外婆家 | 2 |
  | `order-dimsum` | 点都德 (早茶 + 烧味) | 3 |
  | `order-majiyong` | 马记永 | 3 |
  | `order-xijiade` | 喜家德 | 3 |
  | `order-haidilao` | 海底捞 | 3 |

- Add `'ordering'` to `GameTopic` in `src/games/types.ts`. This is the only
  change outside `src/games/` apart from the photo pipeline and the tests. If
  `PlayPage` groups cards by topic, give the ordering games their own
  heading, "Ordering".
- Each shop's data lives in `src/games/order-<brand>/menu.ts`: categories,
  items, option groups, prices, rules, glossary, culture tips. Plain typed
  data, easy to extend.

### 3.2 One game = a few orders

The host's rounds are **orders** (`rounds: 3`, or 4 for the table-service
restaurants). Each round runs like this:

1. **The task arrives** as a WeChat-style chat bubble from a friend (a fixed
   "friend" avatar, not a photo of a real person). It is always in Chinese,
   and English is only available through the help layer:
   > 帮我买一杯冰拿铁，少甜，要燕麦奶。我在外面等你，打包。
   The message stays pinned at the top of the **guide sidebar** (§3.6).
2. **The mini-app opens at its start screen** (首页 or table landing), not
   inside the menu. The learner navigates as they would in real life.
3. **The learner orders:** menu, options, cart, checkout, pay.
4. **Checking happens at `去支付`/`下单`.** The built order is compared with
   the task's **required facts**: items, quantities, each option asked for,
   dine-in or take-away, note, diner count, tea, and so on. Options the task
   did not mention may be anything. That is realistic: defaults are fine.
   - All right: the payment sheet, then the pickup screen with the pickup
     code. The round is reported as `correct` (and `firstTry` only if no help
     was used; see §3.5).
   - Something wrong: a WeChat-style modal from the friend: `不对哦，我要的是
     燕麦奶～`. It names **what** is wrong (in Chinese, help layer available)
     but does not fix it. The learner goes back and changes it. The second
     try counts as `firstTry: false`. If it is still wrong, the round is
     missed: show a diff card, "You ordered / They asked for", with the
     fields side by side, then Next.
5. **Reading check** (from level 2 on): on the pickup/success screen, one
   quick question in Chinese about what is on the screen, answered by
   tapping the answer *on the screen itself*: `取餐码是多少？`,
   `一共多少钱？`, `几点可以取？`, `优惠了多少？`, `茶位费一共多少？`. This
   teaches reading the screens you actually get after paying.

`RoundResult.prompt` is the friend's message. `answer` is the order in short
form (`冰拿铁 · 少甜 · 燕麦奶 · 外带`). `items` are the **HSK words the
order used** (`咖啡`, `杯`, `冰`, `大`, `块`, `茶`, `米饭`, `碗`…), found
through `wordId` and filtered to words that are in the library. Menu-only
words are not items.

### 3.3 Difficulty levels (picked by seed, stepped up within a game)

| Lvl | The order asks for | Example |
|---|---|---|
| 1 | one item, one option | 一杯热美式 |
| 2 | one item, 2–3 options, pickup or dine-in | 一杯冰生椰拿铁，少少甜，打包 |
| 3 | two different items, or one item ×2 with different specs, plus a note | 两杯奶茶：一杯去冰半糖加珍珠，一杯热的无糖 |
| 4 (table-service) | diner count, several dishes, portions, spice/tea, dietary note, 加菜 halfway | 我们三个人，喝普洱。要一笼虾饺，半只烧鹅，走葱… |

A game has 3 orders (4 for table-service), rising in level. Band 1 stays at
levels 1–2. Band 2 uses 2–3 (and 4 for table-service). Prices are shown as
numbers, as in the real app. The task never gives a price, except in a budget
task.

Extra task types to mix in (one per game at most):

- **Budget:** 我只有20块，帮我买最便宜的咖啡 ("I only have ¥20, buy the
  cheapest coffee"). This needs the `预估到手` price and reading the coupon.
- **Coupon:** 用一下优惠券 ("use the coupon"). The learner must open
  `优惠券` at checkout and choose one.
- **Delivery** (瑞幸, phase 4): 送到公司 ("deliver it to the office"). The
  learner switches to `外送` and picks the saved address `公司`.

### 3.4 Understanding everything: the help layer

Chinese is shown on its own by default, exactly as in the real app. Help is
always there, but only when asked for:

- **Tap and hold any Chinese text** (a label, option pill, category, price
  line or tag) to get a small popover: hanzi, pinyin (accent colour),
  English, and one usage note where useful (`少少甜 ≈ 25% sugar`). It
  includes a `<Say>` button, which plays a native recording when the pack has
  one. A normal tap keeps its normal meaning. The long press is about 450 ms
  and cancels if the finger moves. With a mouse it works the same way. The
  popover sits in a portal and never moves the layout.
- **A `拼` switch** (in the sidebar) turns on pinyin under every label (ruby)
  for the rest of the order.
- **First-visit tour** for each shop: numbered coach marks over the real
  screen (store picker, 自提/外送, categories, `+` vs `选规格`, cart bar,
  `去结算`), each giving the Chinese, pinyin and English. It can be skipped
  and replayed from the sidebar. The "has seen it" flag is kept per device in
  `localStorage` (try/catch).
- **Menu words list** on each shop's intro card and in the sidebar: every
  word the shop uses, grouped (drinks, options, checkout, payment), with
  photo, pinyin, English, and a one-line note on *how it's used on the
  screen*.

### 3.5 Help costs the first-try mark

**The learner decided: help counts.** A right order is reported as
`firstTry: false` when, during that order, the learner did any of these:

- turned on `拼`,
- used **下一步** ("What next?", §3.6),
- looked up **3 or more** words (popovers plus taps in "On this screen").

Free, never counted: the map and jumping back through it, the task
breakdown in Chinese, culture tips, the tour, and "Start over".

The sidebar shows a small `Help used` / `No help yet` state for the current
order, with a fixed width, so the rule is never a surprise. The intro card
says it in one line.

### 3.6 The guide sidebar — for when you get lost

The sidebar sits beside the phone. It uses the app's own paper style, not
the mini-app's, so it clearly reads as "outside the shop". From top to
bottom:

1. **任务 · The order.** The friend's message, always visible. Under it is
   the **breakdown**: the message split into its parts as Chinese chips
   (`冰` `拿铁` `少甜` `燕麦奶` `打包`), in the order the app asks for them.
   There are no ticks: whether the order is right is only told at payment.
   Long press on a chip opens the popover (this counts as a lookup).
2. **你在这里 · You are here.** The flow as a vertical map of steps for this
   brand. For 瑞幸: `首页 → 菜单 → 选规格 → 购物车 → 确认订单 → 支付 →
   取餐`. For table service: `扫码 → 人数/选茶 → 菜单 → 购物车 → 下单 →
   加菜 → 买单`. Each step shows its Chinese screen name and the English.
   The current step is marked. **Tapping an earlier step goes back to it**
   and keeps the cart. This is the cure for "I'm lost": one tap and you are
   on the menu again.
3. **这一页 · On this screen.** Every Chinese label on the current screen,
   with pinyin and English, in screen order. Tapping one pulses an outline
   around it on the phone for 1 s (outline only, no layout change). Opening
   an entry counts as a lookup.
4. **下一步 · What next?** A button. It shows one line of English ("Choose
   the milk: 燕麦奶 is oat milk") and pulses the control to press. It counts
   as help. The hint is worked out from the order and the task: the first
   unmet fact, or the next screen in the flow.
5. **Tools:** the `拼` switch, **Replay tour**, **Menu words**, and **Start
   over** (clears the cart and returns to the start screen; asks first).
6. **Tip** for this screen: one culture or usage line from the brand's data
   (for example "After paying, the 取餐码 is what the barista calls out.").

**Layout:**

- **iPad and wide screens** (stage ≥ 760px): the phone (390px) and the
  sidebar (300–340px) sit side by side, and the sidebar scrolls on its own.
- **Phone** (< 760px): the phone fills the stage. A **Guide** handle sits on
  the right edge: a small vertical tab outside the mini-app's controls, clear
  of the WeChat capsule, and respecting `safe-area-inset-right`. It opens the
  sidebar as a right-hand drawer over the phone, at 85% width, with a scrim.
  Tapping the scrim or swiping it right closes it. The handle is always
  rendered (never mounted late) and never covers the cart bar or `去结算`.
- The sidebar's state (which sections are folded) is per device in
  `localStorage`.

### 3.7 Intro card and free mode

Before the first order, a shop intro screen shows the brand wordmark, one
sentence ("Order coffee the way you would at a luckin in Beijing"), the help
rule, and three buttons:

- **Take orders:** the scored game.
- **Just browse:** the same mini-app with no task. The sidebar shows the map,
  "On this screen" and tips. Nothing is reported, and `finish()` is never
  called, so nothing is recorded. Leave with ✕.
- **Menu words**.

The tour runs on the first entry.

---

## 4. The mini-app kit (`src/games/order-kit/`)

### 4.1 Look: a deliberate exception to the paper style

Inside the game stage, the phone **is a WeChat mini-program**: the white/grey
WeChat UI, the brand's colour, system sans-serif Chinese (`PingFang SC`, not
the app's 楷体), bold prices and red badges. The learner is training their
eye for the real screens. The rules:

- The phone's styles are scoped under `.ok-app` and themed by the brand's
  variables. Nothing leaks out.
- **Dark mode:** WeChat has a dark mode, so redefine the kit's variables
  under the app's dark theme selectors (`:root[data-theme='dark'] .ok-app`,
  and `prefers-color-scheme` when no theme is set). No hard-coded hex outside
  the variable blocks.
- Everything **outside** the phone uses the normal Hanzi Workshop style and
  tokens: the guide sidebar, help popovers, the tour, the diff card and the
  intro.
- **Size:** see §3.6. On iPad the phone is 390px wide with a thin bezel and
  radius. On a phone it fills the stage with no bezel. The page never scrolls
  sideways. Only the menu lists and the sidebar scroll inside. Use
  `overscroll-behavior: contain` so a scroll inside does not drag the page.
- Motion: sheets slide up in 0.2s, the cart badge scales in 0.12s, and the
  sidebar drawer slides in 0.2s. Respect `prefers-reduced-motion` (fade
  instead of slide).
- The app sets `-webkit-touch-callout: none; user-select: none` so a long
  press never opens iOS's text-selection menu. The popover and the sidebar
  keep normal selection.

### 4.2 Components

| Part | Job |
|---|---|
| `OrderStage` | lays out the phone + `GuideSidebar` (side by side, or the drawer on a phone). It holds the order, the task and the help counters |
| `MiniApp` | the phone frame: status-bar spacer, nav bar with title and the WeChat capsule (tapping it shows the toast `练习模式`), a screen stack with push/pop and slide transitions, and an optional tab bar. It exposes `goTo(step)` for the map |
| `TabBar` | 首页 / 菜单 / 购物车 / 订单 / 我的. Tabs that are not needed show a plain placeholder in the real style (`暂无订单`) |
| `StartScreen` | banner (photo), entry tiles (自提 / 外送), coupon strip. Per-brand props |
| `TableLanding` | scan landing: brand, 桌号, diner-count grid, optional **tea picker** (点都德), 开始点餐 |
| `MenuScreen` | store bar and 自提/外送 segment, **left category rail + right list with scroll-spy** both ways (tap a category to scroll, scroll to update the rail), sticky category headers, product rows, floating `CartBar` |
| `ProductRow` | photo (fixed box), name, desc, tags, price with struck-through original and `预估到手`, a `+` or `选规格` button, `月售` |
| `SpecSheet` | option groups from data: single/multi, required, price deltas, portions (例牌/半只/一只, 整份/半份, 两), **rules** (热 disables 冰量 options; 仅冰饮; 鸳鸯 asks for two soups; 双拼 asks for two meats), live price, quantity stepper, 加入购物车 / 立即购买. A required group left empty gives the toast `请选择冰量` and scrolls to it |
| `CartBar` / `CartSheet` | badge, total, 去结算. The sheet lists lines by spec with steppers and `清空购物车` |
| `Checkout` | 自提/外送 switch, store and time, 取餐方式, lines with grey spec text, 优惠券 picker, 备注 (quick chips plus an optional text field), 餐具 count, fixed charges (茶位费, 调料, 餐具), fixed bottom bar with 合计/已优惠 and 去支付 |
| `PaySheet` | the WeChat Pay look: amount, **brand merchant name**, `零钱`, then `输入支付密码` with a 6-dot pad. **Any 6 taps work.** A tiny muted line under it says "Practice — tap any six digits; never type a real password here." Then `支付成功` → `完成` |
| `PickupScreen` | 取餐码/取餐号 in huge digits, a decorative QR drawn from the seed, status stepper, estimated time, order summary |
| `TableOrder` | for 先吃后付: 下单成功 → an "at the table" screen with 加菜 / 呼叫服务员 / 去买单 |
| `GuideSidebar` | §3.6: task + breakdown, map, on-this-screen list, 下一步, tools, tip, help state |
| `Toast`, `Modal` | WeChat style |
| `HelpText` | wraps every Chinese string in the kit: long press opens the popover, ruby shows when 拼 is on, and it registers the string with "On this screen" and the outline pulse. **Every visible Chinese string goes through it**, and a test enforces that each one has a glossary entry (§7) |

### 4.3 Order model (pure, in `order-kit/order.ts`)

- `MenuItem { id, zh, category, photo, basePrice, groups: OptionGroupRef[], tags?, monthlySales?, spicy? }`
- `OptionGroup { id, zh, kind: 'one'|'many', required, options: { id, zh, delta? }[], default?, rule? }`.
  Portions are an option group whose options carry a price instead of a
  delta.
- `Line { itemId, choices: Record<groupId, optionId[]>, qty }`. Two lines with
  the same choices merge. Different choices stay separate.
- `Order { mode: '自提'|'外送'|'堂食', takeaway?, diners?, tea?, lines, coupon?, note: string[], cutlery?, extraRounds?: Line[][] }`.
  The `extraRounds` field holds 加菜 batches.
- `price(order, menu)`: line totals, fixed charges (餐具, 茶位费, 调料,
  打包费, 配送费), coupon, 满减. Round to 0.1 as the apps do.
- `Flow`: each brand's list of steps (id, zh, en). It drives the map and
  `goTo`.
- `Task { message: string; parts: string[]; wants: Want[]; level; kind }`.
  `parts` is the breakdown shown as chips. A `Want` is a checkable fact
  (`hasLine(item, {sugar:'少甜'}, qty)`, `mode('外带')`, `note('不要香菜')`,
  `diners(3)`, `tea('普洱')`, `couponUsed`, `cheapestUnder(20)`,
  `addedLater(item)`).
- `check(order, task) → { ok, misses: Miss[] }`. `Miss` holds the Chinese
  complaint and the English for the diff card.
- `nextHint(order, task, screen) → { en, target }` for 下一步.
- `buildTasks(ctx, menu, n)`: seeded with `ctx.rng`, generated from
  **templates** so every task is always solvable with its menu. Each template
  renders a natural Chinese sentence (write about 12 per brand by hand, with
  slots), its parts, and its wants.
- `HelpLog`: counts lookups, the pinyin switch and hints per order.
  `usedHelp()` decides `firstTry`.

Keep all of this free of React so it can be unit-tested.

---

## 5. Per-brand content

For each brand: 25–40 items across 5–8 categories, real option groups (§2),
realistic prices, 10–15 task templates, a glossary, culture tips per screen,
and a start screen. Reuse existing HSK words wherever the real menu uses them
(咖啡, 茶, 奶茶, 牛奶, 米饭, 面条, 饺子, 包子, 杯, 碗, 大, 小, 热, 冰, 块,
两, 个, 一共, 多少钱).

| Game id | Model | Signature lessons |
|---|---|---|
| `order-luckin` | chain app, 自提/外送, coupons | 冰/热, the sugar levels, 燕麦奶, 大杯/超大杯, 堂食/外带, 优惠券, 预估到手, 取餐码 |
| `order-mixue` | chain app | 冰量 ×5, 糖度 ×5, 加料 multi-select with prices, 中杯/大杯, each spec on its own line |
| `order-waipojia` | 扫码点餐, 先吃后付 | 桌号, 就餐人数, 凉菜/热菜/主食/汤, 大份/小份, 辣度, 忌口 notes, 餐具 fee, 加菜, 买单 |
| `order-dimsum` | 扫码点餐, 早茶 | 选茶 + 茶位费 per person, 一笼, dim sum names, 烧味 portions 例牌/半只/一只, 双拼饭, 走葱 |
| `order-majiyong` | 先付后吃 | 面型 ×7, 大碗/小碗, 加肉/加蛋, 要/不要 辣子 香菜 蒜苗, 取餐号 |
| `order-xijiade` | 先付后吃 | ordering by 两/半斤 (两 vs 二!), 馅, 水饺/煎饺/蒸饺, 醋 蒜 |
| `order-haidilao` | 扫码点餐 | 人数, 锅底 incl. 鸳鸯/四宫格, 整份/半份, 荤/素, 调料 per person |

Common 外婆家 dishes: 宫保鸡丁, 鱼香肉丝, 西红柿炒鸡蛋, 麻婆豆腐,
酸辣土豆丝, 红烧肉, 糖醋里脊, 茶香鸡, 地三鲜, 拍黄瓜, 凉拌木耳, 蛋炒饭,
米饭, 酸辣汤, 西红柿鸡蛋汤, 可乐, 雪碧, 啤酒, 酸梅汤.

Rough prices:

| Shop | Price range |
|---|---|
| 瑞幸 | ¥9.9–¥32 (with coupon prices) |
| 蜜雪冰城 | ¥4–¥15 |
| 马记永 | ¥22–¥38 |
| 喜家德 | ¥6–¥12 per 两 |
| 外婆家 | dishes ¥12–¥58 |
| 点都德 | dim sum ¥18–¥42, 烧鹅 例牌 ¥68 / 半只 ¥118, 茶位 ¥8/位 |
| 海底捞 | soups ¥48–¥98; dishes ¥18–¥68, half portions at about 60% |

**Band:** all games are offered at bands 1 and 2. Menu words are not limited
to HSK. That is the point of the game, and it is the documented exception to
R8. Add a short note to `src/games/README.md` explaining it. The band only
changes the level mix (§3.3).

---

## 6. Photos

- Real photos, with the same pipeline and the same licence and credit rules
  as the word photos. Add a **menu set**: `scripts/images/menu.json` (item
  slug → Commons/Wikipedia query), with output in `public/images/menu/*.jpg`,
  `public/images/menu/CREDITS.md` and `src/data/menuPictures.json` (bundled
  sizes, so there is no layout shift). Extend `fetch.py`/`review.py`/
  `build.py` with a `--set menu` flag. Don't fork them.
- Pace requests at 3 s (Wikimedia rate-limits). The run is resumable.
- Review the candidate sheets yourself and pick photos that show **the dish
  as served**: a lamian bowl, a bamboo steamer of 虾饺, a hanging 烧鹅
  or a chopped plate of it.
- Where Commons has no good photo of a brand-specific drink (生椰拿铁), use a
  close real photo (an iced latte), not an illustration. **Do not scrape
  photos from the brands' apps or sites.**
- Items share photos where it makes sense (all lattes may share 2–3 shots).
  Start-screen banners are photos too (a coffee counter, a dim sum table),
  with a solid brand-colour panel for the wordmark and text.
- The photo credit sits in the product sheet as `.tiny` text, as in the word
  drawer.

---

## 7. Tests (Vitest, beside the code)

- `order-kit/order.test.ts`:
  - pricing: deltas, multi add-ons, portions, per-person fees (餐具, 茶位,
    调料), half portions, coupons, 满减, rounding
  - line merging
  - rules: 热 clears 冰量; 仅冰饮; 鸳鸯 needs two soups; 双拼 needs two
    meats
  - `check` catches each kind of miss and ignores unasked options, including
    加菜 batches
  - `nextHint` always points at an existing control
  - `usedHelp` follows §3.5 exactly
- Per brand `content.test.ts` (with `testContext`):
  - for every band, a full game builds
  - the same seed builds the same tasks
  - **every generated task is solved by a scripted order built from its
    `wants`**
  - every task sentence and every breakdown chip uses only strings in the
    glossary
  - the brand's `Flow` covers every screen the kit can show for it
- **Glossary coverage:** walk each brand's menu, groups, options, tags,
  categories, flow steps and the kit's fixed strings, and assert that every
  Chinese string has a glossary entry (pinyin + English). This guarantees "I
  understand everything offered".
- `npx tsc -b` and `npm test` pass.

---

## 8. Verification (by the builder, before calling a phase done)

1. Start the preview on a **test DB** (`HANZI_DB=.data/test.db`, port 5174 if
   5173 is taken).
2. For each brand in the phase, play one full scored game and one "Just
   browse", at 768×1024 and 375×812, in light and dark. Screenshot these
   screens:
   - start
   - menu
   - spec sheet
   - checkout
   - pay
   - pickup
   - the sidebar (both layouts, including the phone drawer)
3. Sidebar checks:
   - tapping an earlier map step returns there with the cart intact
   - 下一步 highlights the right control
   - "On this screen" matches the screen
   - the help state flips as described in §3.5
   - the Guide handle never covers the cart bar or `去结算`
4. Check in WebKit (`scripts/webkit-probe.swift`):
   - the category rail and the list scroll independently
   - sheets and the drawer don't jump
   - there is no horizontal overflow
   - a long press doesn't bring up the iOS text-selection menu
5. Reduced motion: sheets and the drawer fade.
6. Nothing on the phone moves when a popover opens, a toast shows, or the
   outline pulses.
7. Results screen: missed orders list the friend's message and the
   short-form answer. The seal is recorded.
8. Send the learner the screenshots.

---

## 9. Phases (commit after each; each is usable on its own)

1. **Kit + 瑞幸咖啡 (build this first, and make it perfect):**
   - `brands.md` research for luckin
   - the order model and its tests
   - `MiniApp`, menu, spec sheet, cart, checkout, pay and pickup screens
   - the help layer, the **guide sidebar**, the tour, the intro and menu
     words
   - `order-luckin` with photos

   Then **stop and show the learner** before phase 2.
2. **蜜雪冰城 + 外婆家:** multi-select add-ons, table landing, diner count,
   先吃后付, 加菜, 买单.
3. **点都德 (早茶 + 烧味), 马记永, 喜家德, 海底捞:** tea and 茶位费,
   portions 例牌/半只/一只, 双拼, the 先付后吃 queue number, ordering by 两,
   half portions, 鸳鸯锅, per-person fees.
4. **Delivery and extras:** the 外送 path in 瑞幸 (address, fees, 满减,
   cutlery), and budget and coupon tasks everywhere.

After each phase, update the status table in
`docs/visual-learning/requirements.md` and the status line at the top of
this file with what was built and any deviations.

---

## 10. Not in scope (for now)

- Speaking to a waiter out loud. Later, this could reuse the voice-chat
  partner (`/pinyin/talk`, calm personas) as "the counter". Do not add TTS
  clips of staff lines.
- Trademark logo artwork, and photos taken from the brands' own apps or
  sites.
- Anything that writes to the review schedule.
- Real payments or real passwords of any kind.

---

## 11. The learner's decisions (2026-09-27)

- **D1 Shops:** the original six, plus **dim sum and roast meats at a
  Cantonese 早茶 restaurant** (点都德, one game with both).
- **D2 Brands:** use the **real popular brand names**, since this is for
  personal use: 瑞幸咖啡, 蜜雪冰城, 外婆家, 点都德, 马记永, 喜家德,
  海底捞. The logos are text wordmarks (§2.10).
- **New: guide sidebar** for when the learner gets lost (§3.6).
- **D3 Help costs the first-try mark:** yes (§3.5).
- **D4 Task language:** Chinese only, with English through the help layer.
  *(Not answered explicitly. This is the default. Ask if unsure.)*
- **D5 Order:** coffee (瑞幸) first.
