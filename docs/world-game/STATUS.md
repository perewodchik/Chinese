# 走走 — status

What is open, and the latest notes for the learner. Tick a box in the same
commit as the work. Built work is not listed here: `git log`, `decisions.md`
(grep it) and `history/` hold it.

## For the learner (morning notes)
**2026-09-30 — главы 1–4: проверка, подсюжеты, исправления. Главы 5–10 заморожены, пока ты не будешь уверен в первых четырёх.** Полная картина (все шаги по порядку, где и когда; все побочные квесты и подсюжеты с тем, что их запускает; список ловушек и тестов) — `docs/world-game/review/chapters-1-4.md`, собрана из данных игры.
- **Твой баг с билетом:** охранник у 天安门 говорил «купи в интернете, приходи завтра», а купить можно было только в главе 8. Теперь он говорит, что билет может купить друг, и открывает квест **«A ticket for the palace»**: 王阿姨 бронирует его с первой главы, и с билетом можно войти во дворец.
- **Похожие ловушки, которые я нашёл и закрыл:**
  - Лису можно было встретить раньше времени, и тогда глава 2 навсегда застревала. Так было ещё до меня, и 10 из 12 случайных прохождений в это попадали. Теперь каждого духа встречаешь только на его шаге.
  - Игрушечного тигра 小明 можно было подарить кому угодно, и тогда шаг с лисой было не пройти. Теперь его нельзя подарить.
  - Экскурсия 小明 в 天坛 была не видна днём: его «школьное» расписание её перекрывало.
  - Старые сохранения посреди главы 3 застревали на подарке для 王阿姨.
  - Не хватало денег на шарф и 煎饼.
  - Колокольчик для 英子 был только в 潘家园 (глава 7); теперь его даёт бабушка на 大栅栏.
  - Разгаданная загадка льва так и оставалась в списке 📌.
  - Добавлены недостающие подсказки «когда»: 赵爷爷 с 6 до 18, 小明 после школы.
- **Подсюжеты в главах 1–4 (9 эпизодов):**
  - глава 1: 老马 и его 煎饼 (「正宗！」); 米沙 заказывает «豹子» вместо 包子;
  - глава 2: стрим 甜甜 на 景山 (「不对，是明朝。」, 弹幕);
  - глава 3: 老牛 на 小吃街; 米沙: 水饺 и 睡觉;
  - глава 4: 甜甜 у 回音壁; 胡半仙 гадает (「你属兔！」 — кролику); передай ругательство от 老马 к 老牛 дословно или помягче; 米沙: 问 и 吻.

  Новые книги: 《煎饼果子》, 《属相》, 《声调》. Новое выражение: 天机不可泄露.
- **Как проверено:** автоматический «игрок» проходит главы 1–4 целиком (глава ограничена четвёртой), а 13 «блуждающих» игроков — в случайном порядке. Тесты стерегут каждую найденную ловушку. В браузере проверены билет от охранника до 王阿姨 и эпизод 老马 со сценкой.

**2026-09-30, поздно вечером — правки по твоим скриншотам с iPhone; ничего не запушено.** **Иконки меню** (сундук вместо дневника, подарок вместо карты) — это браузер смешал старый и новый файл картинок: теперь у всех файлов игры (картинки, карты, тексты) в адресе хэш содержимого, так что такого больше не будет. **Меню внизу:** четыре вкладки — 日志 · 包 · 地图 · 收藏 — и ⚙ 设置 и × 关 такими же вкладками того же размера; английских подписей нет (они во всплывающей подсказке); **朋友 теперь внутри 日志** (Now · Side · 朋友 · Story · 日记). **Верхняя строка:** только ‹, время и ☰ — место уже написано на мини-карте, карта и сумка есть в меню, у времени нормальные отступы. **Камера — в сумке:** первый слот 相机, в карточке кнопка **拍照** — меню закрывается и открывается видоискатель. **兔儿爷:** убрал ряды слов со звёздочками и «What did I learn?» — в «What did they say?» теперь только перевод, а слова и так нажимаются в самом диалоге (там же карточка слова, из неё можно добавить в коллекцию). **«Before we go…»** теперь говорит сам 兔儿爷 в своём пузыре, с кнопками Not yet / Go on, а джойстик в это время спрятан. **「！」 в диалоге** больше не проваливается ниже строки. **Карта метро:** на iPhone работает щипок (жест Safari), названия подбираются под масштаб — издалека только главные, ближе появляются остальные, ничего не налезает друг на друга и не уходит за край, под кнопки +/− и под подпись внизу тоже; «2 new» показывается только там, где есть место. Картинки: `docs/world-game/review/ui/` (WebKit 390 и 1024, Chromium 375, светлая и тёмная). **Не проверено:** настоящий iPhone (щипок в WebKit на Mac не проверить) и сам пузырь «Before we go…» — я не смог вызвать его в тесте.

**2026-10-01, ночью — §13 S4: глава 4 стала длиннее; на этом я остановился (главы 5–10 не тронуты).** Теперь в главе 11 шагов вместо 4:
- **天坛:** у 小明 школьная экскурсия, он дарит **книгу 8 《天坛》**. У 祈年殿 учительница спрашивает класс, почему крыша синяя (ответ на с. 3: 天的颜色). На 圜丘 встань на **天心石**, скажи слово, и в сценке голос возвращается со всех сторон.
- Дальше, как раньше, 回音壁 шепчет 国子监.
- **国子监街:** прочитай 牌楼. Старый учёный объясняет экзамены и дарит **книгу 9 《科举》**. В 孔庙 兔儿爷 спрашивает, сколько имён на стелах (五万多, с. 6). 孔先生 учит **「三人行，必有我师」** (новое выражение в книге 成语).
- **麒麟** в сумерках, потом воспоминание 王阿姨 о том, как она училась на учительницу.

Главы 1–4 теперь 18 + 12 + 12 + 11 шагов; главы 5–10 ждут своих сессий (как написано в `S-howto.md`). Всё запушено.

(Older notes: `history/morning-notes.md`.)

## Where things stand (2026-10-01)

Built: phases A–I, X0–X11, Y1–Y7, M1–M8, R1–R4, P1–P4 / J1–J3, W1–W7, and of
§13 Z0, K1–K3, Q1–Q3, V1–V4, T1–T5, B1, S1–S4, L1–L4, N1–N2. Save format v17.

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
- [ ] U1 胡半仙 · U2 老马 & 老牛 · U3 甜甜 · U4 米沙 — the chapter 1–4 episodes are built; the rest and the finales wait for their chapters
- [ ] U5 Substory checks
- [ ] V5 Final look pass over every map
- [ ] Z9 Whole-game solver run, coverage strict, probes, review/, morning notes

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
