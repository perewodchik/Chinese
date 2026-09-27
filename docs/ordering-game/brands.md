# Brands — what the real mini-programs show

Research notes for the ordering games (`docs/ordering-game/plan.md` §2). One
section per brand, written before that brand is built: screen by screen, the
labels and option groups in their real order, and the colours. Where a brand's
wording differs from the plan's summary, the brand wins, and the difference is
noted here.

## 瑞幸咖啡 luckin coffee (phase 1)

Checked 2026-09-27. The build container could search the web but could not
open most Chinese sites (xiaohongshu, zhihu, sina, smzdm and Wikimedia were
blocked by its network policy), so the checks below come from search-result
summaries and one open-source client that drives luckin's own ordering API.
What was **confirmed** is marked ✓; what follows the plan without a second
source is marked ~.

### Option groups (选规格 sheet)

| Group | Options, in order | Source |
|---|---|---|
| 温度 | 冰 / 热 — only these two; less or no ice goes in 备注 | ✓ woshipm Q&A "为什么瑞幸在选择温度上只有冰、热" |
| 糖度 | 不另外加糖 / 少少甜 / 少甜 / 标准甜 (some drinks show 微甜) | ✓ 不另外加糖, 少甜, 微甜 in smart-luckin's order specs; ✓ 少少甜 (1–2 pumps) and 标准甜 (4 pumps) in sina/smzdm guides |
| 奶 | 纯牛奶 / 燕麦奶 / 厚乳 (drink-dependent; some drinks show 无奶) | ~ plan; ✓ 无奶 appears in smart-luckin |
| 浓度 | 标准 / 双份浓缩 +¥3 (the API calls the default 默认浓度, the bean 意式拼配) | ~ plan; ✓ 默认浓度, 意式拼配 in smart-luckin |
| 杯型 | 大杯 16oz / 超大杯 +¥3 (2025 onwards: "+3元升特大杯" on lattes; hot drinks go to 超大杯, iced to 特大杯) | ✓ ZAKER "瑞幸全面升级+3元升特大杯"; ✓ 超大杯, 特大杯 in smart-luckin |

Built as: 温度 required with no default (so 请选择温度 is met), 糖度, 奶, 浓度 and
杯型 required with the usual default. The game uses 少甜 rather than 微甜, and
超大杯 for the larger size whether hot or iced — one word to learn for now.

### Screens

- **首页:** banner, then 到店取 (pickup) and 外送 (delivery) tiles, the coupon
  strip, member level, new drinks. ~
- **菜单:** store picker (`北京三里屯店 · 距您 350m`), `自提 | 外送` segment,
  category rail on the left with scroll-spy, product rows with photo, name,
  one-line description, tags (`爆款`, `新品`, `IIAC金奖豆`), the list price
  struck through and `预估到手` in red, and `选规格` or a round `+`. ~
- **确认订单:** 自提/外送, store and `预计 10:42 可取`, 取餐方式 堂食/外带,
  lines with grey spec text `冰/少甜/燕麦奶`, 优惠券 `已选1张 -¥16`, 备注,
  支付方式 微信支付, bottom bar `合计 ¥13.9 已优惠¥16` and 去支付. ~
- **After paying:** 取餐码 in large digits (✓ "取餐码" is what the order-status
  API returns), status 已下单 → 制作中 → 请取餐, expected time.
- **Payment** goes through WeChat Pay (✓ smart-luckin hands over a WeChat Pay
  QR); the kit draws the usual WeChat Pay sheet.

### Menu

Signature drinks from luckin's own naming, confirmed in search results or the
API client: 生椰拿铁 ✓, 加浓美式 ✓, 标准美式 ~, 酱香拿铁 ~ (the 2023 Moutai
collaboration), 橙C美式 ~. The rest are common drinks of the genre (拿铁,
卡布奇诺, 澳瑞白, 摩卡) and luckin's category names (生椰家族, 瑞纳冰, 轻食) ~.
Prices are realistic list prices (¥21–32) with 预估到手 prices after a drink
coupon (¥8.9–19.9); they are not today's prices.

### Colour

luckin's blue. The brand site (lkcoffee.com) could not be opened from the
build container, so `#1b3a8c` is taken from memory of the logo and app header,
not measured. `--brand-soft #e7ecf7`, text on the brand white. Dark mode uses
a lighter blue `#7d98e3` with dark text, as WeChat's dark mode lightens
brand colours. **Check against the real app and adjust in `menu.ts`.**

### Sources

- [为什么瑞幸在选择温度上只有冰、热，不设置更多的温度选择？ (woshipm)](https://wen.woshipm.com/question/detail/knjfq8.html)
- [smart-luckin — 瑞幸咖啡点单 CLI (GitHub)](https://github.com/AD207warlord/smart-luckin)
- [瑞幸全面升级"+3元升特大杯" (ZAKER)](https://app.myzaker.com/article/6a2779548e9f094cd50abb2d)
- [瑞幸生椰拿铁外卖怎么点低卡 (sina)](https://www.sina.cn/gc/article/nimnkur3171293.html) — sweetness levels by pumps
- [生椰拿铁点单攻略！甜度杯型冰量全说清 (smzdm)](https://post.smzdm.com/p/am9m2x2v/)
- [瑞幸咖啡 (official site)](https://lkcoffee.com/)

---

The six brands below were checked on 2026-09-27 the same way as 瑞幸 (search
results only; the sites themselves were blocked from the build container). ✓
is confirmed by a source; ~ follows the plan or common knowledge of the genre.
**No brand colour below was measured** — each is from memory of the logo and
should be checked against the real app.

## 蜜雪冰城 Mixue (phase 2)

| Group | Built as | Source |
|---|---|---|
| 冰量 | 正常冰 · 少冰 · 去冰 · 常温 · 热饮 — one required group; fruit teas are cold only | ✓ sohu 点单攻略: "冰量是必选项：正常冰、少冰、去冰、常温和热饮" |
| 糖度 | 正常糖 · 少糖 · 半糖 · 微糖 · 无糖, required | ✓ same (正常糖、少糖、半糖、微糖); 无糖 ✓ smzdm ("无糖+正常冰+不加料") |
| 加料 | many-of, +¥1 / +¥2, priced into the line | ✓ "点击 + 弹出规格选择弹窗，可选择冰量、糖量和加料区" |
| 杯型 | 中杯 / 大杯 +¥2 on the drinks that have two sizes | ~ plan |

Menu: 冰鲜柠檬水 (¥4), 珍珠奶茶, 满杯百香果, 蜜桃四季春, 棒打鲜橙, 杨枝甘露,
新鲜冰淇淋 (¥2) — Mixue's well-known items ~. The plan's rule "热 removes the ice
options" does not arise: Mixue has one 冰量 group with 热饮 in it, so choosing
热饮 *is* choosing no ice. The rule mechanism stays in the kit (tested with a
made-up shop). Coupons are chosen by hand. Colour `#e2231a`.

Sources: [蜜雪冰城超全点单攻略 (sohu)](https://m.sohu.com/a/840293085_120626138/),
[蜜雪冰城全系列热量真相 (smzdm)](https://post.smzdm.com/p/a7g56465/).

## 外婆家 (phase 2)

- 扫码点餐 with 就餐人数 first; **餐具费 is charged per person automatically**
  from the diner count ✓ (woshipm / sohu write-ups of how 扫码点餐 works:
  "用户点餐时如果选择了人数，结算时会自动根据设置的餐具费进行收费").
- Customers order on their phones by scanning the table code ✓ (zhihu on
  外婆家's model); 先吃后付, 加菜, 催单, 呼叫服务员 ~ (standard 扫码点餐).
- Menu: 茶香鸡 and 外婆红烧肉 (house specials), 麻婆豆腐 (famously cheap), and
  the plan's list of common dishes ~. 大份/小份 with its own price, 辣度 ~.
- Colour `#9b2d20` (a brick red).

Sources: [小程序扫码点餐的业务实践 (woshipm)](https://www.woshipm.com/pd/3096254.html),
[扫码点餐小程序的功能逻辑 (sohu)](https://www.sohu.com/a/411570264_120139581),
[外婆家 (zhihu)](https://zhuanlan.zhihu.com/p/29135759).

## 点都德 (phase 3)

- **茶位费 per person**, and the tea is asked for once you sit down ✓ (ctrip:
  "入座后会问你饮什么茶，按人头收茶位费"). Stores charge ¥5–8; the game uses ¥8.
- Ordering by scanning the table code ✓.
- Signature items: 虾饺皇, 蜜汁叉烧包 (both listed as intangible-heritage
  dim sum), 金沙海虾红米肠 ✓ (ctrip, weibo reviews). The rest is common 早茶
  fare ~. 烧味 by 例牌 / 半只 / 一只 ~ (standard Cantonese menus).
- Colour `#8c2a1f`.

Sources: [点都德(海岸城店) (ctrip)](https://gs.ctrip.com/html5/you/foods/fooddetail/26/18457278.html),
[在广州漂几年，才能明白"点都德" (thepaper)](https://www.thepaper.cn/newsDetail_forward_26819797).

## 马记永 (phase 3)

- 面型, thin to thick: 毛细 · 细 · 三细 · 二细 · (二柱子 · 荞麦棱) · 韭叶 ·
  **薄宽** · 大宽 ✓ (baidu zhidao, zhihu). **The brand wins over the plan's
  "宽"**: the game uses 薄宽. The rarer 二柱子 and 荞麦棱 are left out.
- 先付后吃 with a 取餐号 ~; "free noodle refills" appears in reviews ✓ — the
  game still charges 加面 +¥3 as the plan says; check in the real app.
- Colour `#1f3b57` (navy) — not confirmed.

Sources: [兰州拉面从细到粗分别叫什么 (baidu)](https://zhidao.baidu.com/question/558483619.html),
[马记永·兰州牛肉面 (ctrip)](https://you.ctrip.com/food/2/84140531.html).

## 喜家德 (phase 3)

- 虾三鲜 is the signature ✓. **Today's stores sell plates** (about 12 for
  ¥30–32) ✓ (ctrip, 55haitao). The game keeps ordering **by the 两** (一两 ≈ 6),
  as the plan asks, because that is what most northern dumpling shops use and
  it carries the 两 vs 二 lesson; the intro and `menu.ts` say so.
- 水饺 / 煎饺 / 蒸饺 ~.
- Colour `#1f6f45` (green) — not confirmed.

Sources: [喜家德虾仁水饺 (ctrip)](https://you.ctrip.com/food/2/84140732.html),
[喜家德水饺初尝试 (55haitao)](https://m.55haitao.com/show/403018/).

## 海底捞 (phase 3)

- 锅底: 单锅, 拼锅 (the split pot, 鸳鸯锅) and 四宫格, each priced differently ✓
  (thepaper: 单锅 ¥99, 拼锅 ¥66, 四宫格 ¥35 per cell for the classic 麻辣).
  The game uses flat prices per pot (单锅 ¥48–88 by soup, 鸳鸯锅 ¥88, 四宫格
  ¥98) to keep the sums readable.
- **半份** exists and is the classic way to try more ✓ (stcn: the company
  denied dropping half portions).
- **调料 (the sauce bar) ¥10 per person** ✓ (hncj, zhihu).
- Colour `#c8161d`.

Sources: [火锅内卷，困在68元一锅的底料争议中 (thepaper)](https://m.thepaper.cn/newsDetail_forward_25332105),
[网传菜单中取消半份菜？ (stcn)](https://www.stcn.com/article/detail/1039685.html),
[海底捞一人食攻略 (hncj)](https://www.hncj.com/wz/4251.html).

## 瑞幸 外送 (phase 4)

Delivery in the game: 收货地址 (公司 / 家), 预计送达, 起送 ¥20, 配送费 ¥3,
打包费 ¥1 a cup, 满30减8, 餐具数量 (无需餐具 / 1–3份), 备注 — the plan's list ~;
not checked against the real 外送 screen.
