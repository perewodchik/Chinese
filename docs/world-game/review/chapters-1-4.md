# 走走 — chapters 1–4, the complete picture (review, 2026-09-30)

Chapters 1–4 are frozen: no new chapters until the learner is confident in these.
This page is **generated from the game's own data** (`picture.ts` in the review
notes), so it is exactly what the game does: every main step in order, where and
when it happens, the cutscenes and books, and every substory and side quest that
opens in each chapter, with what starts it.

How to read the *Starts* column: the place, and the condition under which the
first talk appears (`chapter ≥ 2`, a festival, hearts, a time). Journal → Side
lists all of them in the game too, with where to go.

## Corner cases: what was checked, what was found, what now guards it

| # | Kind of trap | Found | Fixed | Test that guards it (`scripts/world/chapters1to4.test.ts`) |
|---|---|---|---|---|
| 1 | **A promise the story can't keep yet** | the 天安门 guard said tickets are bought online, 「你明天再来吧」 — booking only existed in chapter 8, so the arc dangled (the learner's report) | the guard now says a friend can book it and starts **A ticket for the palace**; 王阿姨 books it from chapter 1; the palace opens with it | no "come back tomorrow"; 王阿姨's booking is reachable in chapter 1; **no flag set in chapters 1–4 is only read in chapter 5+** |
| 2 | **Meeting a spirit before its step** | a player who wanders to 角楼 at night early meets the fox; the singer on 景山 then never appears and chapter 2 is stuck at `jingshan` — **10 of 12 random orders** hit it (an old bug, from before §13) | the lion, fox, door gods and 麒麟 can only be met at their own step | each spirit scene names its step |
| 3 | **A story thing lost for good** | 小明's toy tiger could be given away as a present; the fox needs it and there is only one | the tiger is a keepsake (can't be given) | every item a chapter 1–4 step needs can be bought again or got again, or has a version of the scene without it (the scarf) |
| 4 | **A later step needs what a skipped step gave** | an old save in the middle of chapter 3 skips the new scarf step, then the homecoming asked for the scarf — stuck | a homecoming without the scarf | golden save `mid-ch3` plays to the end |
| 5 | **Money a player may not have** | the scarf (50 元) and a 煎饼 (6 元) for a player who spent everything | a free scarf from the shop's giveaway; the first 煎饼 is on the house | the spend-everything run and all random orders never go short |
| 6 | **A person who isn't there at the hour** | 小明's school trip to 天坛 was hidden by his school routine (he only appeared after 16:00); 赵爷爷 (6:00–18:00) and 小明 (after school) steps didn't say when | a story placement wins over a routine; the trip is in school hours; every such step says when | every step whose person keeps hours has a `when`; 小明 is at 天坛 at 10:00 and home by evening |
| 7 | **A side quest that points far away** | 英子's camel bell was only at 潘家园 (chapter 7's market) | the 大栅栏 granny has one (the camel trains of 《城南旧事》); 潘家园 still works | every chapter 1–4 quest finishes with the chapter capped at 4 |
| 8 | **A talk closed half-way** | a conversation closed early is not marked played (it can be restarted), but the door gods took the red paper on the first answer | they take it at the end | — |
| 9 | **A riddle answered but still pinned** | the lion's 日+月 riddle stayed on the 📌 list after you solved it | marked worked out | every key line answered on the spot is marked worked out |
| 10 | **Playing out of order** | — | — | a **wandering player** (random order, seeds 3, 7, 11 in the tests; 13 seeds run in review) finishes every chapter 1–4 quest |

Also checked and fine: every chapter 1–4 quest finishes before chapter 5 (the
solver capped at chapter 4, following a quest's hint when it points into a later
district, as a player would); early visits to later districts give nothing that
breaks the story (three 成语 can be picked up early at 三里屯, 潘家园 and 长城 —
a reward for exploring); old saves from the middle of chapters 1, 2, 3 and 4
(made with the content before each change) keep their step and play to the end.

**Not covered by automatic tests**: how clear the English hints feel, whether a
learner finds a person on a busy street (the quest marks and the minimap help),
and the look of each new scene — those were checked by playing in the pane:
the ticket arc from the guard to 王阿姨, 老马's 煎饼, chapter 1's list, shop and
drum, chapter 2's opening and bridge, chapter 3's opera.

## Chapter 1 — 新家 · A new home

### Main story (`ch1`, 18 steps)

| # | Step | What you do | Where | When |
|---|---|---|---|---|
| 1 | `meet-wang` | Go out into the courtyard and say hello to 王阿姨, your landlady. | — |  |
| 2 | `breakfast` | Have breakfast at the 早点铺 on 南锣鼓巷: out of the courtyard gate, then east along the lane. | — | open 6:00–10:00 |
| 3 | `list` | Back in the courtyard, 王阿姨 wants a hand with her shopping. Talk to her and read her list. | 四合院 |  |
| 4 | `shop` | Buy what is on 王阿姨's list at 李阿姨's corner shop 小卖部 on 南锣鼓巷: 「我要一瓶牛奶，一盒鸡蛋」, then pay with your phone. | 小卖部 |  |
| 5 | `bring` | Take the milk and eggs back to 王阿姨 in the courtyard. | 四合院 |  |
| 6 | `lantern` | Go back to the courtyard and look at 王阿姨's old lantern. | 四合院 |  |
| 7 | `rumour` | The lantern's spirits have run off. Ask people if they have seen anything strange — the teahouse 茶馆 and the corner shop 小卖部 on 南锣鼓巷 hear everything. | 茶馆 |  |
| 8 | `haircut` | 张师傅 the barber on 南锣鼓巷 gives every new neighbour a first haircut for free. Go and sit in his chair. | 理发店 |  |
| 9 | `lion-book` | Ask 赵爷爷 on 南锣鼓巷 the way to the Drum Tower 鼓楼 (in the early morning he is at the 鼓楼 square). | 南锣鼓巷 | 6:00–18:00 |
| 10 | `lions` | At the 鼓楼, a man with a camera wants to know which stone lion is the father. 《石狮子》 page 3 tells you. | 钟鼓楼 |  |
| 11 | `lion` | They say the stone lion by the Drum Tower 鼓楼 moves at night. Ask the way if you need to (it is west of your lane), and go after dark — 老刘 at the teahouse lets you sit till evening. | 钟鼓楼 | after dark |
| 12 | `drum-book` | Tell 老刘 at the teahouse 茶馆 about the lion — he has something for you. | 茶馆 |  |
| 13 | `drum` | The attendant by the Drum Tower asks visitors a question from the book: at what time in the evening was the drum beaten? (《晨钟暮鼓》 page 3) | 钟鼓楼 |  |
| 14 | `bell` | 小明 has never seen the Bell Tower 钟楼. Walk north across the square and take a photo of it: 📷, with the tower in the frame. | 钟鼓楼 |  |
| 15 | `tell` | Tell 小明 on 南锣鼓巷 what you heard at the towers, and show him the photo (he is at school 8:00–16:00). | 南锣鼓巷 | not 8:00–16:00 |
| 16 | `yandai` | At the west edge of the 鼓楼 square a sign points down 烟袋斜街. Go and read it. | 钟鼓楼 |  |
| 17 | `card` | The spirits could be anywhere in Beijing. Buy a 交通卡 at 南锣鼓巷 station, at the east end of the lanes. | 南锣鼓巷站 |  |
| 18 | `ride` | Take the subway to 天安门东: through the gates (tap your card), find the board on the platform, line 8 south to 王府井, then line 1 one stop. | — |  |

**Cutscenes:** `ch1-open` (第一章 · 新家) · `lantern-breaks` (灯笼坏了) · `memory-1` (回忆 · 爷爷的灯笼) · `c1-drum` (暮鼓) · `sub-mn-1-flip` (正宗！) · `sub-misha-1-leopard` (豹子？) · `ch1-finale` (第一章 · 完)

**Books:** 《晨钟暮鼓》 — 老刘 at the teahouse gives it to you after you meet the stone lion (chapter 1).; 《灯笼》 — 王阿姨 gives it to you when the old lantern breaks (chapter 1).; 《石狮子》 — 赵爷爷 on 南锣鼓巷 gives it to you when you ask the way to the 鼓楼 (chapter 1).

### Substories that open in chapter 1 (2)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **老马's 煎饼** `sub-mn-1` | 老马 | 南锣鼓巷: always | Order a 煎饼果子 from 老马 on 南锣鼓巷 (mornings 6:00–11:00) — your way: an egg? spring onion? spicy? *(mornings 6:00–11:00)* |
| **米沙 and the leopards** `sub-misha-1` | 米沙 | 早点铺: always | At the breakfast shop 早点铺 (6:00–10:00), a student called 米沙 is trying to order. Help him. *(open 6:00–10:00)* |

### Side quests that open in chapter 1 (11)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **A haircut** `side-haircut` | 张师傅 | 理发店: 成语 马马虎虎 and money ≥ 30 | Get a haircut at 张师傅’s on 南锣鼓巷 (30 元). *(open 9:00–21:00)* |
| **Caught in the rain** `side-umbrella` | 赵爷爷 | 南锣鼓巷: rain weather | 赵爷爷 has no umbrella. 李阿姨 sells them on rainy days — use one on him from your bag. *(on a rainy day)* → 赵爷爷 will give your umbrella back on a dry day. Look for him on 南锣鼓巷. *(on a dry day)* |
| **New Year at the courtyard** `side-chunjie` | 王阿姨 | 四合院: (at chunjie or at yuanxiao) and after arrive | Put 春联 and a 福 on your gate: buy them at 李阿姨’s in winter, then use them on a lantern beside your red gate in 帽儿胡同. *(in winter)* → Give 小明 a 红包 (李阿姨 sells them) and wish him a happy new year — during 春节 or 元宵. *(at 春节 or 元宵)* |
| **The hutong cat** `side-cat` | — | 帽儿胡同: always | Feed the little cat in 帽儿胡同 on three different days: buy 小鱼干 at 李阿姨’s and use it on the cat. → The cat trusts you. Look at it and give it a name: 它叫…… |
| **Square dancing** `side-dance` | 跳舞的阿姨 | 钟鼓楼: 17:00–22:00 | In the evening, dance with the aunties on the 鼓楼 square — do what she calls. *(evenings 18:00–21:00)* |
| **Dumplings with 王阿姨** `side-jiaozi` | 王阿姨 | 四合院: (at chunjie or at yuanxiao) and after chunjie-wang | At New Year, make dumplings with 王阿姨 — do each step she says. *(at 春节)* |
| **The lost delivery** `side-waimai` | 外卖小哥 | 帽儿胡同: always | The delivery rider in 帽儿胡同 (in the evening) cannot find a house number — help him. *(evenings 17:00–20:00)* |
| **Old things for sale** `side-polan` | 收破烂儿的师傅 | 帽儿胡同: 7:00–12:00 | In the morning a recycler rides through 帽儿胡同 calling out — talk to him. *(mornings 7:00–12:00)* |
| **Magpies for 七夕** `side-magpies` | 王阿姨 | 四合院: at qixi and after arrive | Find the three magpies — in the parks of 景山, 北海 and 天坛 — and send them to the bridge in the sky. *(at 七夕)* → Tell 王阿姨 — look at the sky together. |
| **兔儿爷’s story** `side-change` | 王阿姨 | 四合院: at zhongqiu and after zhongqiu-wang | At 中秋, make mooncakes with 王阿姨 — and hear 兔儿爷’s own story. *(at 中秋)* |
| **A ticket for the palace** `side-palace-ticket` | 工作人员 | 天安门广场: always | Palace tickets are booked online in your own name. 王阿姨 books everything on her phone — ask her in the courtyard: 「阿姨，你能帮我买故宫的票吗？」 → You have a ticket! Go to 天安门 (line 1 to 天安门东), walk to the gate and show your passport at security. |

## Chapter 2 — 水与山 · Water and the hill

### Main story (`ch2`, 12 steps)

| # | Step | What you do | Where | When |
|---|---|---|---|---|
| 1 | `go-houhai` | 兔儿爷 smells a spirit by the water. Walk west from the 鼓楼 square along 烟袋斜街 to 后海 — or ride line 8 one stop to 什刹海. | — |  |
| 2 | `bridge` | Stand on 银锭桥, the little bridge between 后海 and 前海, and read the sign 银锭观山 beside it. | 后海 |  |
| 3 | `rumour` | Ask the old man fishing by the lake what he saw last night. | 后海 |  |
| 4 | `lake-book` | Ask the old man fishing where to look next — he knows every corner of the lakes. | 后海 |  |
| 5 | `prince` | In 恭王府's garden by 后海, a girl from the poetry club wants to see the 白塔 too. 《什刹海》 page 5 tells you where it stands. | 恭王府 |  |
| 6 | `beihai` | Go to 北海's north shore — line 6 to 北海北, or walk. | 北海北门 |  |
| 7 | `baita` | Take the boat from the pier to the island and go up to the 白塔. Someone will phone you. | 白塔 |  |
| 8 | `pavilions` | On 景山, the woman doing 太极 asks which of the five pavilions is the highest. Read the pavilion signs along the ridge. | 景山公园 |  |
| 9 | `jingshan` | Climb 景山 from its north gate to the highest pavilion, 万春亭 — the old man who sings there sees everything. | 万春亭 |  |
| 10 | `fox-book` | Talk to the old singer on 万春亭 again — he knows a story about foxes. | 万春亭 |  |
| 11 | `tiger` | 《狐假虎威》 page 4: the fox walks in front, the tiger behind. You need a tiger! 小明 on 南锣鼓巷 has a toy one that roars (he is at school 8:00–16:00; line 6 from 北海北 to 南锣鼓巷 is one stop). | 南锣鼓巷 | not 8:00–16:00 |
| 12 | `fox` | “故宫西北角附近” — near the north-west corner of the palace: the corner tower 角楼, down the south side of 景山. Go after dark; the bench on 景山 is a good place to wait. | 角楼 | after dark |

**Cutscenes:** `ch2-open` (第二章 · 水与山) · `c2-yinding` (银锭观山) · `jingshan-view` (景山 · 看故宫) · `memory-2` (回忆 · 后海的冰) · `ch2-finale` (第二章 · 完) · `sub-tt-1-danmaku` (弹幕)

**Books:** 《狐假虎威》 — The old man singing on 景山 gives it to you after he has seen the fox (chapter 2).; 《什刹海》 — The old man fishing at 后海 gives it to you when he tells you about the fox (chapter 2).

### Substories that open in chapter 2 (1)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **甜甜 goes live** `sub-tt-1` | 甜甜 | 万春亭: always | On 景山's top pavilion at sunset (16:00–20:00), the streamer 甜甜 tells her viewers who built the palace. Is she right? *(late afternoon 16:00–20:00)* |

### Side quests that open in chapter 2 (22)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **赵爷爷’s bird** `side-bird` | 赵爷爷 | 南锣鼓巷: chapter ≥ 2 | 赵爷爷’s bird flew off. The kid 小明 plays in the lanes — ask him. → Take the bird back to 赵爷爷 on 南锣鼓巷. *(6:00–18:00)* |
| **小明’s kite** `side-kite` | 小明 | 南锣鼓巷: chapter ≥ 2 | 小明’s kite is stuck in the 槐树 of 帽儿胡同. Buy a bamboo pole 竹竿 at the corner shop and use it on the kite (🎒 → Use). → Give the kite back to 小明 (🎒 → Use on him). *(not 8:00–16:00 (school))* |
| **王阿姨’s son** `story-wang` | 王阿姨 | 四合院: 王阿姨 ≥ 3♥ and chapter ≥ 2 and 11:00–23:00 | 王阿姨 misses her son abroad. Listen to her — maybe she could call him? → Come back to the courtyard in the morning (7–11) and help 王阿姨 call her son. *(mornings 7:00–11:00)* |
| **The first barber shop** `story-zhang` | 张师傅 | 理发店: 张师傅 ≥ 3♥ and chapter ≥ 2 | 张师傅 is telling you about his first shop. → His first customer was 赵爷爷. Ask 赵爷爷 on 南锣鼓巷 about the old shop. → Take 赵爷爷’s old photo to 张师傅 at the barber’s. |
| **The bird that stopped singing** `story-bird` | 赵爷爷 | 南锣鼓巷: 赵爷爷 ≥ 3♥ and flag bird-back and 9:00–18:00 | 赵爷爷 is telling you about his bird. → Meet 赵爷爷 on the 鼓楼 square in the early morning (6–9). *(early morning 6:00–9:00)* |
| **A room of your own** `side-room` | 王阿姨 | 四合院: chapter ≥ 2 and after arrive | Buy something nice for your room — flowers or a paper-cut at 李阿姨’s, a lantern at 潘家园, calligraphy at the 王府井 bookshop, an opera mask at the 前门 theatre — and use it on a spot in your room (墙, 窗户, 地上). → Talk to 王阿姨 — she wants to see your room. |
| **A photo for 小明** `side-photo-drum` | 小明 | 帽儿胡同: chapter ≥ 2 | Take a photo of the Drum Tower 鼓楼 for 小明: tap 📷 on the 鼓楼 square and put the tower in the frame. → Show 小明 the photo — he is in 帽儿胡同. |
| **A game of 象棋** `side-xiangqi` | 下棋的爷爷 | 南锣鼓巷: chapter ≥ 2 | Play Chinese chess with the old man on 南锣鼓巷 — say which piece you move. |
| **A bit of 相声** `side-xiangsheng` | 老刘 | 茶馆: chapter ≥ 2 | 老刘 at the teahouse has a joke for you. Listen, and laugh if you get it. |
| **《骆驼祥子》 — a cart of his own** `side-xiangzi` | 祥子 | 南锣鼓巷: chapter ≥ 2 | 祥子 on 南锣鼓巷 wants a tricycle of his own. Take his passengers where they ask. |
| **《茶馆》 — don’t talk politics** `side-chaguan` | 喝茶的客人 | 茶馆: chapter ≥ 2 | In 老刘’s teahouse a guest keeps bringing up the news. Mind the notice on the wall — talk about the weather or food. |
| **《三国演义》 — the storyteller** `side-sanguo` | 说书的先生 | 茶馆: chapter ≥ 2 | The storyteller in 老刘’s teahouse tells one episode a day. Come back on another day for the next. → Hear the second episode at the teahouse. *(on another day)* |
| **《天官赐福》 — the little shrine** `side-tianguan` | 白先生 | 帽儿胡同: flag met-polan and chapter ≥ 2 | A gentle man in white collects old things with the recycler in 帽儿胡同 in the mornings. *(mornings 7:00–12:00)* → The shrine needs wood, red cloth and incense. Ask friends who like you (two hearts): 张师傅, 王阿姨, 李阿姨. → Come back to the shrine in 帽儿胡同 after dark. *(after dark)* → Find the ever-burning lamp at the ghost market — 潘家园 after eight at night. It's far to the south-east (line 10 to 潘家园); the story itself gets there later, but the market is open to you now. *(after 20:00)* → On the night of 元宵 (the Lantern Festival), bring the lamp to 白先生 at the shrine. *(at 元宵, after dark)* |
| **Bait for the fisherman** `side-bait` | 钓鱼的爷爷 | 后海: flag heard-fox | The fisherman has run out of bait 鱼饵. The corner shop 小卖部 on 南锣鼓巷 sells it. → Bring the bait to the fisherman at 后海. |
| **A boat on the lake** `side-boat` | 划船的师傅 | 后海: not flag boat-ride and money ≥ 30 | Take a boat out on 后海 (30 元) — ask the boatman. |
| **Fishing on 后海** `side-fishing` | 钓鱼的爷爷 | 后海: after bait-give | Once he has his bait, the old fisherman on 后海 asks you to sit with him. |
| **《红楼梦》 — the poetry club** `side-shishe` | 诗社的姑娘 | 恭王府: chapter ≥ 2 | A poetry club meets by the lake on 后海. Pick the line that answers theirs. |
| **A painting for 王阿姨** `side-painting` | 画画的人 | 北海北门: after painter | The painter at 北海 gave you a painting of the White Dagoba for 王阿姨. Bring it home. |
| **太极 on 景山** `side-taiji` | 打太极的阿姨 | 景山公园: not flag taiji | The woman on 景山’s path does 太极 every morning — learn a move with her. *(mornings)* |
| **The magic brush** `side-maliang` | 马良 | 北海北门: chapter ≥ 2 | A boy paints by the lake at 北海 — tell him what to paint. |
| **The small pear** `side-rangli` | 小融 | 景山公园: chapter ≥ 2 | A little boy in the 景山 park has to choose a pear. |
| **The water jar** `side-simaguang` | 小光 | 景山公园: chapter ≥ 2 | A boy in the 景山 park needs help, fast. |

## Chapter 3 — 书 · The book

### Main story (`ch3`, 12 steps)

| # | Step | What you do | Where | When |
|---|---|---|---|---|
| 1 | `go` | 兔儿爷: spirits like old books. Ride to 王府井 — line 8 south from 南锣鼓巷. | — |  |
| 2 | `money` | Your money is nearly gone. Change money at the bank 银行 on 王府井 — you have your passport. | 银行 | open 9:00–17:00 |
| 3 | `gift` | A present for 王阿姨, who has been so kind: the department store 百货大楼 on 王府井 has scarves. Tell the shop assistant who it's for and what colour she likes. | 百货大楼 |  |
| 4 | `book` | Find a book of 成语 at the bookshop 新华书店, north on 王府井 — 兔儿爷 wants to write down the ones you've heard. | 书店 |  |
| 5 | `cold` | 兔儿爷 is sneezing — he caught a cold in the wind on 景山! Tell the doctor at the pharmacy 药店 what's wrong with him: 发烧, 咳嗽. | 药店 |  |
| 6 | `qianmen` | The book talks of 门神, the door gods. Ride one stop south to 前门 and ask at the opera house 戏园. | 戏园 |  |
| 7 | `lianpu-book` | The owner of the opera house 戏园 has an invitation for you. | 戏园 |  |
| 8 | `outfit` | “Wear something nice to the opera.” The silk shop 瑞蚨祥 in 大栅栏 lends clothes — tell the woman there where you're going. | 瑞蚨祥 |  |
| 9 | `show` | Go back to the opera house for the show. The owner will ask you something from 《脸谱》 (page 3). | 戏园 |  |
| 10 | `red-paper` | The door gods need red paper to be painted again. The bookshop on 王府井 sells 红纸. | 书店 |  |
| 11 | `menshen` | Take the red paper to the old gate at the south end of 前门大街. The door gods will ask how they should stand — 《门神》 page 6. | 前门大街 |  |
| 12 | `home` | Take 王阿姨 her present and tell her about the door gods. | 四合院 |  |

**Cutscenes:** `c3-jingju` (京剧 · 关羽) · `memory-3` (回忆 · 爸爸的门神) · `ch3-finale` (第三章 · 完) · `ch3-open` (第三章 · 书) · `sub-mn-2-slow` (牛！) · `sub-misha-2-nap` (水饺！)

**Books:** 《煎饼果子》 — 老牛 at the 王府井 snack street gives it to you with his 煎饼 (chapter 3).; 《脸谱》 — The owner of the opera house at 前门 gives it to you before the show (chapter 3).; 《门神》 — The woman at the bookshop on 王府井 gives it to you with the red paper (chapter 3).

### Substories that open in chapter 3 (2)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **老牛's 煎饼** `sub-mn-2` | 老牛 | 王府井大街: always | Order a 煎饼 from 老牛 at the 王府井 snack street 小吃街 — the same order as 老马's, in his words. |
| **米沙 wants to sleep** `sub-misha-2` | 米沙 | 王府井大街: sub-misha-1 done | 米沙 is at the 王府井 snack street. He wants something — help him say it. |

### Side quests that open in chapter 3 (11)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **Lost keys** `side-keys` | — | 四合院: chapter ≥ 3 | Your keys are gone. Ask the neighbours if they have seen them. → 小明 saw them in the dark corner of 帽儿胡同. A torch 手电筒 from the corner shop — use it on the corner. |
| **A photo for 王阿姨** `side-photo-gate` | 王阿姨 | 四合院: spirit menshen | 王阿姨 wants a photo of a red gate. Use your 手机 on the door gods’ gate in 大栅栏. → Show 王阿姨 the photo (use your 手机 on her). |
| **A night at the opera** `side-show` | 戏园老板 | 戏园: not flag saw-show and money ≥ 50 | Buy a ticket from the opera house owner and watch a show (50 元). |
| **Tea for the granny** `side-tea` | 大栅栏的奶奶 | 大栅栏: spirit menshen | The granny of 大栅栏 misses 老刘’s tea. Buy tea leaves 茶叶 at the teahouse on 南锣鼓巷. → Bring the tea to the granny in 大栅栏. |
| **Roast duck** `side-kaoya` | 烤鸭店的师傅 | 前门大街: always | The waiter outside the roast-duck shop on 前门 shows you how to wrap it — do what he says. |
| **Opera faces** `side-masks` | 京剧演员 | 戏园: after opera | The actor at the 前门 theatre explains the painted faces — pick the right one. |
| **《城南旧事》 — the camel bell** `side-yingzi` | 英子 | 前门大街: chapter ≥ 3 | 英子 on 前门 street lost a small yellow camel bell. Ask the old granny in 大栅栏 — old Beijing families kept camel bells. (The antique market at 潘家园 has them too, far to the south-east.) → Bring 英子 her bell. |
| **《西游记》 — the Monkey King** `side-wukong` | 孙悟空 | 前门大街: chapter ≥ 3 | A boy dressed as 孙悟空 on 前门 street turns into things. Guess what from his words. |
| **哪吒 or 孙悟空?** `side-nezha` | 哪吒 | 前门大街: after wukong | Two boys on 前门 street argue who is stronger. Settle it. |
| **王阿姨 has a cold** `wang-cold` | 王阿姨 | 四合院: chapter ≥ 3 | 王阿姨 has a cold and a little fever. Buy cold medicine at the pharmacy 药店 on 王府井 — say what's wrong. → Take the medicine back to 王阿姨 in the courtyard. |
| **A book for 小明** `side-book` | 小明 | 南锣鼓巷: chapter ≥ 3 | 小明 wants a storybook 故事书. The bookshop on 王府井 has them. → Give 小明 the storybook — he plays on 南锣鼓巷. *(not 8:00–16:00 (school))* |

## Chapter 4 — 回声 · The echo

### Main story (`ch4`, 11 steps)

| # | Step | What you do | Where | When |
|---|---|---|---|---|
| 1 | `go` | 兔儿爷 has heard of a spirit that loves learning. Start at 天坛 — line 5 to 天坛东门. | — |  |
| 2 | `school` | 小明's class is on a school trip to 天坛 today (school hours)! Find him in the park, near the east gate. | 天坛公园 | school hours, 8:00–16:00 |
| 3 | `roof` | Go north up to the Hall of Prayer 祈年殿. 小明's teacher is asking the class a question — 《天坛》 page 3 knows the answer. | 祈年殿 | school hours, 8:00–16:00 |
| 4 | `huanqiu` | 《天坛》 pages 5–6: in the south, on the round altar 圜丘, stand on the centre stone 天心石 and say something. | 圜丘 |  |
| 5 | `echo` | At the Echo Wall 回音壁, east of the Hall of Prayer, a boy wants to whisper you a secret through the wall. Talk to him, then put your ear to the wall. | 回音壁 |  |
| 6 | `go-gzj` | The whisper said 国子监. Ride line 5 north to 雍和宫 and walk along 国子监街 to the Academy's gate. | — |  |
| 7 | `paifang` | 国子监街 still has its old 牌楼, the painted gateways across the street. Look up at one and read it. | 雍和宫大街 |  |
| 8 | `keju-book` | The old scholar at 国子监 knows the history of the Academy. | 国子监 |  |
| 9 | `names` | Next door in the 孔庙, the 进士 names are carved on stone steles. Look at one — 兔儿爷 will ask how many names there are (《科举》 page 6). | 孔庙 |  |
| 10 | `kong` | Back at 国子监, 孔先生 has a saying from 孔子 for you. | 国子监 |  |
| 11 | `qilin` | The bronze 麒麟 in the Academy's courtyard wakes at dusk. Come after five in the afternoon. | 国子监 | after 17:00 |

**Cutscenes:** `echo-wall` (回音壁) · `ch4-open` (第四章 · 回声) · `c4-huanqiu` (天心石) · `memory-4` (回忆 · 喜欢学习的人) · `ch4-finale` (第四章 · 完) · `sub-tt-2-danmaku` (回音壁 · 直播) · `sub-hu-1-rabbit` (你属兔！) · `sub-mn-3-phones` (马和牛) · `sub-misha-3-blush` (问，不是吻)

**Books:** 《科举》 — The old scholar at 国子监 gives it to you (chapter 4).; 《声调》 — 米沙 gives it to you at 国子监, after the library disaster (chapter 4).; 《属相》 — 胡半仙 the fortune teller on 雍和宫 street gives it to you (chapter 4).; 《天坛》 — 小明 gives it to you at 天坛, on his school trip (chapter 4).

### Substories that open in chapter 4 (4)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **甜甜 and the whispering wall** `sub-tt-2` | 甜甜 | 回音壁: always | 甜甜 is streaming at the Echo Wall 回音壁. Whisper something for her viewers. |
| **胡半仙 reads your face** `sub-hu-1` | 胡半仙 | 雍和宫大街: always | On 雍和宫 street, 胡半仙 the fortune teller wants to tell your fortune — and your rabbit's. |
| **The 煎饼 message** `sub-mn-3` | 老马 | 南锣鼓巷: chapter ≥ 4 and sub-mn-1 done and sub-mn-2 done | 老马 on 南锣鼓巷 (mornings) has a message for 老牛. *(mornings 6:00–11:00)* → Take 老马's message to 老牛 at the 王府井 snack street. Say it exactly — or a little kinder. Your choice. |
| **米沙 asks a question** `sub-misha-3` | 米沙 | 国子监: sub-misha-2 done | 米沙 is at 国子监. He wants to ask the girl reading on the steps where the library is. |

### Side quests that open in chapter 4 (8)

| Quest | Who | Starts | Steps |
|---|---|---|---|
| **毽子 with the grannies** `side-jianzi` | 踢毽子的奶奶 | 天坛公园: not flag jianzi | Kick the 毽子 with the grannies at 天坛 — count with them. |
| **A song at 天坛** `side-song` | 拉胡琴的爷爷 | 天坛公园: 成语 对牛弹琴 and not flag song | The old man with the 胡琴 wants you to sing a line with him. |
| **Hot water for the 胡琴 player** `side-thermos` | 拉胡琴的爷爷 | 天坛公园: 成语 对牛弹琴 | The old 胡琴 player is cold. Buy a thermos 保温杯 at the corner shop on 南锣鼓巷. → Fill it with hot water at 老刘’s teahouse (use the flask on him). → Give the hot water to the old man at 天坛 (use it on him). |
| **Water writing 地书** `side-dishu` | 写字的爷爷 | 天坛公园: always | Write with water beside the old man in the 天坛 park. |
| **A kite at 天坛** `side-kite-fly` | 卖风筝的师傅 | 天坛公园: wind weather | On a windy day the kite maker is in the 天坛 park. Pick the kite he describes. *(on a windy day)* |
| **The diabolo** `side-kongzhu` | 抖空竹的奶奶 | 天坛公园: always | The grandmother in the 天坛 park teaches the 空竹 — do what she says. |
| **A brush for the scholar** `side-brush` | 老先生 | 国子监: after frog | The old scholar at 国子监 wants a writing brush 毛笔. The bookshop on 王府井 sells them. → Bring the brush to the scholar at 国子监. |
| **《孔乙己》 — the character 回** `side-kong` | 孔先生 | 国子监: chapter ≥ 4 | An old scholar in the Academy courtyard wants to see you write 回. |

