# 点单 — ordering in Chinese mini-apps: what was built

All four phases were built on 2026-09-27: the kit (`src/games/order-kit/`),
瑞幸咖啡 (with 外送), 蜜雪冰城, 外婆家, 点都德, 马记永, 喜家德 and 海底捞, and
budget and coupon orders. How a brand is added is in `src/games/README.md`;
the brand research is `brands.md` beside this file. Below: the learner's
decisions, where the build differs from the original plan, and what is left.

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
