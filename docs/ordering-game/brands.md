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
