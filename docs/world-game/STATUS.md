# 走走 — status

What is open, and the latest notes for the learner. Tick a box in the same
commit as the work. Built work is not listed here: `git log`, `decisions.md`
(grep it) and `history/` hold it.

## For the learner (morning notes)
**2026-10-01, вечер — сделано всё из списка, кроме части «красоты мест» (VB2–VB5). Ничего не запушено.**
- **Карта метро (MM):** названия больше не налезают на кружки и линии. Издалека подписаны только «ты здесь» и цель; если места рядом нет, название стоит чуть в стороне с тонкой линией к станции. Ближе появляются районы, совсем близко — все станции. Щипок теперь один на весь диапазон и идёт под пальцами (раньше почти весь щипок терялся). Двойной тап приближает. Проверено в WebKit на 375/768/1024.
- **Метро (MT):** платформа — настоящее место, с каждой стороны своё направление и табло. Подходишь — поезд уже въезжает, двери вагона и платформы открываются вместе и ждут, пока ты рядом. В вагоне тоннель за окнами, схема линии над дверью и «下一站». На каждой станции в окне появляются перрон и большое название, и поезд ждёт, пока ты выберешь 下车 или 继续乘坐. Пересадка — коридор под знаком 换乘. Автобусы и поезд на 长城 пока по-старому.
- **Честные карты (MH):** 南锣鼓巷 нарисован заново (40×64). Все 16 переулков — настоящие переулки с воротами дворов, и каждый видно, где кончается. 帽儿胡同 ведёт домой, 东棉花胡同 — дальше, к театральной академии (студенты, 「我是谁？我在哪儿？」, резная арка дома 15). Через ворота можно зайти к 齐白石 (雨儿), 茅盾 (后圆恩寺) и во дворы 菊儿胡同: там экскурсовод, сценка и печать. В остальные ворота можно постучать: 「找谁啊？」. Прочитай все 16 названий — получишь печать 蜈蚣巷. Игра теперь не собирается, если на какой-то карте есть дорога в никуда; таких нашлось 35, все закрыты стеной или каменной оградой.
- **Награда (RW):** `docs/world-game/review/reward.md` — сколько даёт каждое место. Новая вкладка **收藏 → 地方: карточки мест**. Факты открываются делом там: прочитал табличку, поговорил, пришёл утром. У каждой карточки свой словарик. Полная карточка приносит **сувенир на полку у тебя в комнате** (книжный шкаф). **天安门 перестроен:** пять мостов (по среднему ходил только император), 华表 и их легенда, львы (самец на востоке), 长安街 с подземными переходами, флагшток, памятник, Дом народных собраний, музей и 正阳门. Утром (до 11:00 по игре) — **поднятие флага**, сценка; фотограф даёт об этом задание и печать 升旗.
- **Картинки:** метро — `docs/world-game/review/mt/`, карта метро — `review/mm/`, новые места и 天安门 — `review/mh/`.
- **Не сделано:** полная отделка остальных карт глав 1–4 (VB2/VB3), книжка 《天安门》 и музей как карта. Голоса для новых реплик сейчас записываются (`build-voices`).

**2026-10-01 — твои три просьбы: настоящее метро, честные карты, награда за дорогу. Пока только идеи, ничего не построено — скажи «go» (или что поменять), и я начну с метро.** Идеи ниже в «Open tasks», разделы **MT**, **MH** и **RW**.
- **Метро (MT1–MT7):** платформа становится настоящим местом. С одной стороны поезда идут в одну сторону, с другой — в другую; над каждой стороной табло «往…方向». Ты сам подходишь к нужной стороне. Поезд въезжает из тоннеля с фарами и тормозит, двери вагона и стеклянные двери платформы открываются со звонком. Ты сам входишь. В вагоне виден тоннель за окном, схема линии над дверью (горит текущая станция, мигает следующая) и экран «下一站». На каждой станции в окне виден перрон с большим названием,. Пересадка — это переход по коридору на другую платформу. Список кнопок «выбери поезд» уходит.
- **Честные карты (MH1–MH3):** на 南锣鼓巷 16 боковых переулков (они настоящие, и их правда 8 + 8, как ноги у сороконожки), но ведёт куда-то только 帽儿胡同 — к твоему дому. Предложение: перерисовать улицу так, чтобы каждый переулок был виден как переулок и через несколько клеток заканчивался воротами двора или поворотом, а не уходил за край. Пять из них станут настоящими местами: дом 齐白石 (雨儿), 茅盾 (后圆恩寺), театральная академия (东棉花), новые дворы 菊儿胡同, 可园 и дом 婉容 (帽儿). Плюс проверка, которая находит такие «дыры» на всех картах и не пропускает новые.
- **Награда (RW1–RW5):** скрипт считает «наградность» каждого шага и каждого места: сколько минут дороги и что ты за них получил (сценка, книга, карточка места, новые слова, предмет, вид для фото). Места ниже планки он показывает красным. Новая коллекция **地方 — карточки мест**: у каждого настоящего места карточка с 3–5 фактами, и каждый открывается делом там (прочитать табличку, спросить человека, прийти в нужный час). Сувениры с мест становятся на полку в твоей комнате. Первым чиним **天安门**: 华表 и легенда о них, пять мостов (средний — только для императора), львы, подъём флага на рассвете как событие по часам, площадь целиком (памятник, музей, Дом народных собраний, 前门), открытка от фотографа и книга.
- **Все настоящие места игры с интересными фактами — для чтения:** `docs/world-game/places.md` (по главам; отмечено, что уже проверено в `facts.md`).
- **Позже в тот же день — по твоим замечаниям:** метро без ожидания: подходишь к платформе — поезд уже въезжает; двери ждут, пока ты рядом, а на станции поезд стоит, пока ты не выберешь «выйти» или «ехать дальше» (MT1, MT3, MT4). **Карта метро (MM1–MM4):** названия больше не налезают на кружки станций и на линии. Издалека — только «ты здесь» и цель, ближе — районы, совсем близко — все станции. Щипок станет плавным: один щипок на весь диапазон, под пальцами. **Красота мест (VB1–VB5):** у каждого места описание его вида по настоящим фото, больше деталей (门墩, таблички, велосипеды, бельё, кошки), жизнь (люди, пар, голуби, погода), правильные масштабы и задний план; начинаем с глав 1–4.
- **Подсюжеты U:** теперь один U на главу. U1–U4 (главы 1–4, девять эпизодов) отмечены как сделанные, U5–U10 — эпизоды глав 5–10, U-check — проверки.

**2026-10-01, ночью — §13 S4: глава 4 стала длиннее; на этом я остановился (главы 5–10 не тронуты).** Теперь в главе 11 шагов вместо 4:
- **天坛:** у 小明 школьная экскурсия, он дарит **книгу 8 《天坛》**. У 祈年殿 учительница спрашивает класс, почему крыша синяя (ответ на с. 3: 天的颜色). На 圜丘 встань на **天心石**, скажи слово, и в сценке голос возвращается со всех сторон.
- Дальше, как раньше, 回音壁 шепчет 国子监.
- **国子监街:** прочитай 牌楼. Старый учёный объясняет экзамены и дарит **книгу 9 《科举》**. В 孔庙 兔儿爷 спрашивает, сколько имён на стелах (五万多, с. 6). 孔先生 учит **「三人行，必有我师」** (новое выражение в книге 成语).
- **麒麟** в сумерках, потом воспоминание 王阿姨 о том, как она училась на учительницу.

Главы 1–4 теперь 18 + 12 + 12 + 11 шагов; главы 5–10 ждут своих сессий (как написано в `S-howto.md`). Всё запушено.

(Older notes: `history/morning-notes.md`.)

## Where things stand (2026-10-01)

Built: phases A–I, X0–X11, Y1–Y7, M1–M8, R1–R4, P1–P4 / J1–J3, W1–W7, and of
§13 Z0, K1–K3, Q1–Q3, V1–V4, T1–T5, B1, S1–S4, U1–U4, L1–L4, N1–N2. Save format v17.

**Chapters 1–4 are frozen for the learner's review**; chapters 5–10 wait until
they say go. The full picture of chapters 1–4 is `review/chapters-1-4.md`.

## Open tasks

§13 (spec: `s13-plan.md`; how: `S-howto.md`; sessions: `parallel-sessions.md`)
- [ ] S5 Ch. 5 香火 (new: 雍和宫 · 白云观 · 东岳庙) — today a one-step placeholder `ch-xianghuo`
- [ ] S6 Ch. 6 新北京
- [ ] S7 Ch. 7 故事
- [ ] S8 Ch. 8 龙
- [ ] S9 Ch. 9 过年 (new: 小年 → 年夜饭 → 庙会) — today a one-step placeholder `ch-guonian`
- [ ] S10 尾声 长城 + 元宵 lantern night + credits
- Substories, one U per chapter (the characters are in `s13-plan.md` U; each chapter's episodes are in `story.md`'s chapter table):
  - [x] U1 Ch. 1: 老马 ep1 (煎饼 order) · 米沙 ep1 (豹子 / 包子)
  - [x] U2 Ch. 2: 甜甜 ep1 (景山 stream, 「不对，是明朝。」)
  - [x] U3 Ch. 3: 老牛 ep2 (小吃街) · 米沙 ep2 (水饺 / 睡觉)
  - [x] U4 Ch. 4: 甜甜 ep2 (回音壁) · 胡半仙 ep1 (「你属兔！」) · 老马 & 老牛 ep3 (the message relay) · 米沙 ep3 (问 / 吻)
  - [ ] U5 Ch. 5: 胡半仙 ep2 (东岳庙, the department of luck)
  - [ ] U6 Ch. 6: 甜甜 ep3 (三里屯 网红 café) · 胡半仙 ep3 (lucky phone numbers, 8s and 4s)
  - [ ] U7 Ch. 7: 老马 & 老牛 ep4 (the old photo at 潘家园, sepia flashback) · 米沙 ep4 (买 / 卖, sells his watch) · 胡半仙 ep4 (your room's 风水)
  - [ ] U8 Ch. 8: 甜甜 ep4 (角楼, film her)
  - [ ] U9 Ch. 9: the finales: 胡半仙 ep5 (his one true prediction) · 老马 & 老牛 ep5 (the 煎饼 contest) · 米沙 ep5 (the toast)
  - [ ] U10 尾声: 甜甜 ep5 (长城 stream, the 弹幕 thank-you)
  - [ ] U-check Substory checks (each character ≥ 4 episodes, each with a cutscene, the motifs)
- [ ] V5 Final look pass over every map
- [ ] Z9 Whole-game solver run, coverage strict, probes, review/, morning notes

New from the learner, 2026-10-01: **ideas only, waiting for their go** (order: MM first, since it's a bug on the phone today; then MT, MH with VB on 南锣鼓巷, RW with VB on 天安门)

**MT — a metro that feels like the real one.** Today a ride is a sheet with a list of train buttons and calls in text (`ui/RideSheet.tsx`, `core/ride.ts`). It becomes a place you stand in:
- [x] MT1 **No waiting** (the learner, 2026-10-01: "keep platforms but don't make me wait"). There is no timetable. When you step up to a side of the platform, its train is already pulling in: the arrival takes about 2 s, then the doors open. The screen over each side says 「列车进站」 rather than a countdown. The ride state stays in `core/ride.ts` (pure, tested), so the solver and tests ride as today. No night gap: trains always come.
- [x] MT2 The platform as a map: most stations get an island platform (岛式站台) with a track on each side and one direction per side. Over each side hang the sign 「往天桥方向」 and the stops strip (bold = stops you can get off at), and the screen over the doors (「列车进站」 as you come up, the next stops otherwise). Big station name boards (hanzi + pinyin) sit on the track walls. You walk to the side you want; "Take me there" marks the side, not a button. Line 2's sides read 内环 / 外环.
- [x] MT3 The train comes in, right away: headlights in the tunnel, the train slides in from the side its direction implies, brakes at the screen doors, a chime, and train doors and screen doors open together. A few passengers step off. You walk in through any open door. The doors stay open while you stand by them, so nothing makes you hurry. Step away and they close (「车门即将关闭」) and the train leaves; step back and the next one comes at once.
- [x] MT4 Inside the carriage: a short walkable carriage map (seats, poles, a few riders, a 兔儿爷 seat). Through the windows the tunnel lights stream past and the car sways. Over each door is the line map (动态地图): passed stops dim, the current stop lit, the next one blinking, change marks. A screen shows 「下一站 王府井 Wángfǔjǐng · Next: Wangfujing」 and the call plays. At a station the platform and its big name board slide into the window and stop, and the doors open on one side. The train **waits at every station until you choose**: walk out of the doors, or tap 继续乘坐 · Stay on. Real door sides per station would be nice but are not modelled (`facts.md` `metro-doors` ✗); either check them or keep calling the side that opens.
- [x] MT5 Always know where you are: while riding, a thin top strip shows the line colour chip, ○—●—○ (last · here · next two) and 「到站：王府井」 / 「下一站：…」. On a platform, the name boards say it too. Fixed widths, no layout shift.
- [x] MT6 Changing lines: at an interchange, the 换乘 signs lead down a short corridor map to the other line's platform (a few seconds' walk, not instant). Leaving: 出站 through the gates, which tap the card (fare as today).
- [x] MT7 Checks: the solver rides as before. Guided rides, fares, the "can't go out here" stations and old saves still work. `prefers-reduced-motion` skips the slides but keeps the door timing. Probes at 375/768/1024 in WebKit, light and dark. Train calls recorded with `build-voices`.

**MM — the metro map, readable and pinchable** (the learner's iPhone screenshot, 2026-10-01: still cluttered; the 2026-09-30 fix did not do it)
- [x] MM1 Names never cover a station or a line. Today `ui/metroLabels.ts` keeps names off each other and off the edges, but not off the station circles and line strokes: 天安门东 is drawn over 王府井's and 前门's circles, and 什刹海 / 北海北 / 王府井 crowd the middle. Add every circle and line segment (with air) to `blocked`.
- [x] MM2 Zoom levels decide what shows. Fully zoomed out, only the stations where you are and where your task is get names, plus the end-of-map places (长城, 颐和园); the rest are dots. Neighbourhood names come in at the next level and small stations only when zoomed in. One font size per level, the "2 new" badge only zoomed in, and the map opens framed on the centre at the level where the main names fit.
- [x] MM3 Pinch that follows the fingers. Today it takes many pinches to zoom. Suspects: `usePanZoom.ts`'s Safari `gesturechange` path compounds `last / g.scale` against a zoom read from a stale render; the zoom range or step clamps each pinch; or the pointer pinch and the gesture pinch both run, or both stand down. Make one pinch from fingers apart to together cover the whole range, zooming about the point between the fingers, with smooth 60 fps (transform first, labels re-placed when the pinch ends). Double-tap zooms in one level. Check on WebKit with real touch events (Playwright `webkit` touch) and on the iPhone.
- [x] MM4 Probe: screenshots at 375/768/1024, light and dark, at each zoom level. Fail if any name box intersects a circle, a line or another name.

**VB — places that look beautiful and real** (the learner, 2026-10-01: "more beautiful and feel more real")
- [x] VB1 A look brief per place, from photos of the real place: its signature details (the gate's colours and plaques, the trees, the shop fronts, what's on the ground), its light by hour, its sounds, and who is there at which hour. It goes in a short table in `places.md`, and every map is held to it.
- [ ] VB2 (begun 2026-10-01: 南锣鼓巷 lanes and street dressed, 天安门 rebuilt with its landmarks; the rest of chapters 1–4 to go) Richer tiles and props (our own pixel art or CC0): varied grey brick and worn paving with cracks, puddles and drain covers; 门墩, 门联, house-number plates, 影壁; bikes, e-scooters, delivery boxes, AC units, wires, laundry poles, potted plants, birdcages, cats; shop signs in real fonts; plaques with real names. No two blocks of a street the same; nothing tiled in obvious repeats.
- [ ] VB3 Life: people doing things (sweeping, playing chess, walking dogs, delivery riders passing), pigeons and 鸽哨 overhead, leaves falling, steam from the 早点铺, light spilling from windows at night, the weather in the scene (rain on the paving, snow on roofs).
- [x] VB4 (天安门 now dominates its square; the parallax backdrop is dropped, see decisions.md) Proportions and depth: wide streets look wide and landmarks look big (天安门 dominates its square, 太和殿 stands on three white terraces), roofs overlap the street edge, there are shadows under eaves, and a parallax backdrop of what's behind (鼓楼 over 南锣鼓巷's roofs, the West Hills from 银锭桥).
- [ ] VB5 Order: the maps of chapters 1–4 first (南锣鼓巷 together with MH2, 天安门 with RW3), then each later chapter with its S task. V5 (the final look pass) checks against VB1's briefs.

**MH — no map shows a road that goes nowhere.**
- [x] MH1 A dead-end check in `world:check`: every walkable opening that reaches a map's edge must be an `edge` or a `door`. A street-like gap between building rows (walkable, ≥ 2 wide, open to the edge) must lead somewhere or be closed on screen (a gate, a wall, a turn). It runs over every map and lists the offenders.
- [x] MH2 南锣鼓巷 rebuilt (`nanluo-main`). Today its 16 hutong mouths are open gaps to the map edge and only 帽儿胡同 (west, to `hutong-home`) leads anywhere. The 16 stay, because they're real (`facts.md` `nlgx-hutongs`, the centipede). The map widens so each mouth is a real-looking lane (2 wide, its street sign, 门墩, bikes, a cat) that ends within the map: at a courtyard gate across the lane, a 影壁, or a visible turn. Five become places you can walk into, each a small map with someone to talk to and something to collect:
  - 帽儿胡同: the way home, plus 可园 and the house where 婉容 grew up;
  - 雨儿胡同: 齐白石's house (a shrimp painting card);
  - 后圆恩寺胡同: 茅盾's house;
  - 东棉花胡同: the 中央戏剧学院 gate, with students rehearsing lines you can listen to;
  - 菊儿胡同: 吴良镛's new courtyards.

  The closed lanes still give something: a gate you can knock on (「找谁啊？」), a 门墩 to look at. Reading all 16 hutong names collects the 蜈蚣巷 card. Facts first (`facts.md`), a migration if a door id moves, and the S1 route and solver unchanged.
- [x] MH3 Fix every other map MH1 flags (expect the prototype lanes, some street maps and the station corridors).

**RW — every trip pays off.** The learner rode all of chapter 1's subway to 天安门 and found one line there.
- [x] RW1 A rewardness score (`scripts/world/reward.ts`, report in `review/reward.md`). For each main step and each landmark it compares **cost** (minutes from the previous step: walking tiles, rides, dialogue) with **reward** points:
  - cutscene 3, book 4, place-card fact 2, idiom 3, stamp 1;
  - a new word heard or read 0.5 (cap 4);
  - a choice or a real conversation 1, an item or souvenir 1, a photo spot 1.

  The score is reward per minute. A landmark scores below the bar if it gives < 6 points. A step over 5 minutes of travel must end in a cutscene or a collectible. The report lists everything, red rows first. `world:check` warns, and later fails once RW4 is done.
- [x] RW2 Place cards (收藏 → 地方). Every real landmark gets a card: its picture, name with pinyin, and 3–5 one-line facts in simple Chinese and English (from `facts.md`, the readable versions in `places.md`). Each fact unlocks by doing something there: read a sign, ask someone, find an object, come at the right hour, take the photo. A full card gets a gold edge. Tapping a word opens the word drawer as everywhere.
- [x] RW3 天安门 first (`tiananmen-square`):
  - the two 华表 and their 望君归 / 望君出 story (people say);
  - the five 金水桥 (walk the middle, the emperor's one; 兔儿爷 joke) and the stone lions (book 2's test again);
  - the square to the south, which the map doesn't show today: the monument, 人民大会堂, 国家博物馆 and 正阳门 at the far end, with signs to read;
  - **the flag-raising at sunrise** as a timed event: a cutscene, a crowd, a side quest "see the flag go up" with 睡到… to dawn;
  - the photographer's postcard (a souvenir), a little book 《天安门》 (1417 / 1651, the name), and chapter 1's arrival as a real cutscene;
  - facts kept to history and architecture.

  Later, 国家博物馆 as a small map (a few famous objects as cards).
  - [ ] Still open from RW3: the little book 《天安门》, the photographer's postcard as a souvenir (with RW5), and 国家博物馆 as a map.
- [x] RW4 Every landmark over the bar after RW1's first run: likely 奥林匹克, 景山 view, 长城, 潘家园, 角楼, 王府井 street, the 故宫 halls. Each gets its card and 2–3 rewards.
  - [ ] Still under the bar (`review/reward.md`): 乾清宫, 御花园, 太和殿 (ch. 8), 白云观, 东岳庙, 地坛 (ch. 5). Their scenes come with S5 and S8; 乾清宫 and 御花园 have no checked facts yet.
- [x] RW5 Souvenirs on a shelf in your room (`siheyuan-room`): a 白塔 model, a 脸谱 mask, a kite, the 天安门 postcard. The room fills up with the places you've been. Visible, and each one opens its place card.

With the learner
- [ ] X12 Play-through and final bug hunt (the automated half was done 2026-09-29)

## Loose ends (open, found in the build notes)

Needs the Mac or the learner:
- **601 of 1865 spoken lines have no recorded voice** and fall back to the system voice (`npx tsx scripts/world/build-voices.ts --dry`): everything since W5 — racks, the barber, jobs, bargaining bits, S1–S4 lines, books 2–9, street cries and the new train calls. Run `build-voices` on the Mac (≈ 10 s a line, resumable).
- **iPad frame rate never measured**; `scripts/world/map-probe.ts` (every map at 375/768/1024 in WebKit) was written but never run.
- Bubble and input bar with the iPad on-screen keyboard up (follows `visualViewport`), hold-to-talk in Safari: never checked on the device.
- Facts still marked `?` in `facts.md` wait for the chapter that uses them.
- The 34路 bus number (天坛东门 → 潘家园) is a stand-in; check it.

Known gaps in what is built:
- The /play card's banners are still rendered from the C4 **prototype lane** (`world:banners` draws `hutong-proto`); E7 asked for the real 南锣鼓巷 with 鼓楼 behind. The prototype maps also remain as the fallback start (`WorldPage.tsx` `FALLBACK`).
- Photos live only on the device that took them (localStorage, newest 24); they do not reach the iPhone from the iPad.
- `FitSprite` never scales below 1×, so a book cover over 48 px overflows its card (book 3 uses a small bell for this).
- The evening-drum cutscene is lit as before its `wait` (the tint catches up after) — for V5.
- People are placed when a map loads; they never walk off when the hour turns while you watch.
- Printing the 成语 book: not built.
- Not built, by choice so far: NPC umbrellas in rain, festival crowds, kites on windy days; a playable chessboard; the sky of lanterns as a picture; more 三国 episodes (`sanguo-3` + `fresh`); 猪八戒 on the snack street.

Dialogue-box ideas the learner has not decided on (from the 2026-09-29 rework):
- a 菜单 card at a counter (stock with prices, hanzi + pinyin);
- "voices play by themselves" on/off in ⚙;
- a speaker on your own sent line (hear how it should sound);
- marking which words of a heard voice line matched;
- racks and the barber in `talkWant` (what is on the rail, your money);
- a thin divider between turns in long talks.
