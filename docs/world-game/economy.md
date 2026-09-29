# 走走 — money and prices

Prices are real Beijing street prices (2026), rounded to whole 元 or x.5
(五毛 is the only small unit the game uses). Shops are data:
`content/world/<district>/shops.json` (prompt Y1); a seller's talk is
generated from it (`src/world/core/shop.ts`).

## What things cost

| Thing | Price | Where |
|---|---|---|
| 包子 (bun) | 3 | 早点铺 (南锣鼓巷) |
| 豆浆 (soy milk) | 3 a cup | 早点铺 |
| 油条 (fried dough stick) | 3 | 早点铺 |
| 水 (water) | 2 a bottle | 李阿姨小卖部 |
| 小鱼干 (dried fish, for the cat) | 3 a pack | 李阿姨小卖部 |
| 鱼饵 (bait) | 5 a pack | 李阿姨小卖部 |
| 竹竿 (bamboo pole) | 10 | 李阿姨小卖部 |
| 手电筒 (torch) | 15 | 李阿姨小卖部 |
| 保温杯 (thermos) | 20 | 李阿姨小卖部 |
| 雨伞 (umbrella) | 15 | 李阿姨小卖部 |
| 花 (pot of flowers) | 10 | 李阿姨小卖部 |
| 剪纸 (paper-cut) | 10 | 李阿姨小卖部 |
| 红包 / 春联 / 福 | 5 / 10 / 5 | 李阿姨小卖部, winter only |
| 糖葫芦 | 10 a stick | 南锣鼓巷 street seller |
| 故事书 (storybook) | 15 | 新华书店 (王府井) |
| 毛笔 (brush) | 20 | 新华书店 |
| 书法 (calligraphy scroll) | 50 | 新华书店 |
| 《成语故事》 | 30 | 新华书店 (story scene) |
| 月饼 (mooncake) | 8 | 王府井 street seller |
| 灯笼 (lantern) | 30 | 潘家园 antique stall |
| 脸谱 (opera mask) | 30 | the 前门 theatre, after the show's first talk |
| 金币巧克力 | 10 | 三里屯 convenience store |
| 茶叶 (tea leaves) | 20 | 老刘's teahouse (story scene) |
| 交通卡 | 40 (20 deposit + 20) | station attendant, ticket machines |
| subway ride | 3–6 by distance | the card |
| bus | 2 | the card |
| 京张高铁 to 八达岭 | 20 | 北京北站 ticket window |
| haircut | 30 | 张师傅 |
| boat on 后海 | 30 | the boatman |
| opera show | 50 | 戏园 |

### Bargained at 潘家园 (Y6: first price → the lowest)

| Thing | Asked | Lowest | Seller |
|---|---|---|---|
| the clay 年兽 (story) | 200 | 100 | 卖古董的老板 |
| 地图 (old map, side quest) | 50 | 30 | 卖旧书的大叔 |
| 茶壶 (teapot) | 80 | 50 | 卖茶壶的阿姨 |
| 铜钱 (copper coin) | 25 | 15 | 卖铜钱的爷爷 |
| 扇子 (paper fan) | 30 | 20 | 卖扇子的姐姐 |
| 鼻烟壶 (snuff bottle) | 120 | 80 | 卖鼻烟壶的老板 |

Two 「太贵了」 bring the price halfway down each time; your own fair
offer is taken the second time you say it; walking away (「算了」) gets
one call back at the lowest price.

### Clothes (§12 W5 — `content/world/clothes.json`, the game's own prices)

| Rack | Things (元) |
|---|---|
| 李宁 (三里屯) | T恤 35 · 短裤 35 (summer) · 运动裤 80 · 运动服 150 · 运动鞋 200 |
| 回力 (三里屯) | 回力鞋 80 |
| 胡同文创 (南锣鼓巷) | 帆布包 30 · 胡同T恤 40 · 熊猫帽 45 |
| 百货大楼, ground floor (王府井) | 衬衫 90 · 墨镜 100 · 毛衣 150 (the red one at 春节) · 大衣 300 · 羽绒服 400 (winter) |
| 百货大楼, upstairs | 裤子 45 · 牛仔裤 80 · 裙子 90 · 长裙 120 · 皮鞋 300 · 西装 600 |
| 盛锡福 (王府井) | 草帽 40 (summer) · 毛线帽 50 (winter) · 鸭舌帽 60 · 礼帽 200 |
| 瑞蚨祥 (大栅栏) | 汉服 100 (元宵 week only) · 丝巾 120 · 唐装 300 · 旗袍 500 |
| 内联升 (大栅栏) | 布鞋 150 |
| old clothes (潘家园, bargained to about ⅗) | 老帽子 30 → 18 · 圆眼镜 40 → 24 · 中山装 120 → 75 |
| 张师傅's (after the first haircut) | a cut 30 · a colour 40 |

A basic outfit — a T恤 and 裤子, 80 元 — is two game days of jobs; the
旗袍 and the 西装 are things to save up for. Clothes are never needed by
the story. The recycler takes clothes from the wardrobe at half price.
`solver.test.ts` plays a spendthrift who buys the cheapest new thing at
every rack on every visit (and has the barber cut shorter each time): it
still finishes every quest without ever being short.

## Money coming in

| From | How much | When |
|---|---|---|
| the start | 200 | chapter 1 |
| 赵爷爷, for his bird | 20 | once |
| the 王府井 bank (100 US dollars) | 700 | chapter 3, once |
| stacking 李阿姨's shelves (the notice in her shop) | 10 | once a game day |
| the breakfast rush at the 早点铺 (its notice) | 15 | once a game day |
| carrying tea at 老刘's (the notice in the 茶馆) | 10 | once a game day |
| a delivery for the rider (帽儿胡同, evenings, after helping him once) | 5 | once a game day |
| selling to the recycler (帽儿胡同, mornings) | half of what a thing cost | any time |
| selling a 铜钱 to the old collector at 潘家园 (bargained up) | 8 → at most 15 | any time — never more than the coin's lowest price, so no money pump |
| 红包 from 王阿姨 / 赵爷爷 | 50 / 20 | 春节 or 元宵, once each |

So a player who has spent everything earns 40 元 — a 交通卡 — in one game
day of jobs (checked by `solver.test.ts`), and a player who buys
everything every shop offers still finishes the game (also checked).
`START_MONEY` stays 200.

## Rules

- A shop never hides because you are short of money: the seller says
  「钱没有了吗？没关系。」 and 兔儿爷 tells you what you have.
- Story purchases keep their own scenes (the 交通卡, the palace ticket,
  bargaining at 潘家园, the opera, the haircut …); the plain ones are stock.
- A `key` item (story item) cannot be given away as a present or sold.
