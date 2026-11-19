# Промпты для Fooocus + Juggernaut XL: пробы стилей для 西游记

Для чего: попробовать несколько стилей иллюстраций на одних и тех же сценах и выбрать.
Модель — **Juggernaut XL** (SDXL) в **Fooocus** на компьютере ученицы (8 ГБ оперативной
памяти). Стиль ещё не выбран; кандидат из прошлых проб — гуашь (`README.md` › 8).
Сравнивать честно: **одна сцена, один seed, меняется только стиль**.

Где что: настройка (1) · как сравнивать (2) · общие блоки «кто в кадре» (3) · стили с
готовыми промптами (4) · если выходит «как фото» (5) · одинаковость героя (6).

---

## 1. Настройка Fooocus один раз

| Где | Что поставить | Почему |
|---|---|---|
| Performance | **Speed** (для Juggernaut XL Lightning — **Lightning**) | быстрее на слабом компьютере |
| Aspect Ratios | **1216×832** | горизонтальная 3:2, как картинки глав |
| Styles | **снять** Fooocus V2, Fooocus Enhance, Fooocus Sharp | они тянут к резкому фото; стиль задаёт промпт |
| Advanced › Guidance Scale | **5** (6, если всё равно выходит фото) | насколько строго следовать промпту |
| Advanced › Image Sharpness | **1** | мягче, ближе к живописи |
| Advanced › Seed | снять **Random**, вписать **12345** | одинаковый seed — честное сравнение стилей |
| Image Number | 2 | два варианта на пробу, не больше: память |

Перед генерацией закрыть браузер с вкладками и тяжёлые программы; файл подкачки
Windows — 16–32 ГБ на SSD (`README.md` › 8.5).

**Негативный промпт — один на все стили** (вставлять каждый раз):
```
photo, photorealistic, realistic fur, 3d render, cgi, octane, glossy, plastic, cinematic lighting, depth of field, bokeh, lens flare, text, letters, chinese characters, watermark, signature, frame, border, extra limbs, extra fingers, deformed hands, floating objects, cluttered, neon colours, dark gloomy
```

---

## 2. Как сравнивать

1. Каждый стиль — на пробной сцене **«Плот»** (её полный промпт есть у каждого стиля
   ниже), seed 12345, 2 картинки.
2. Сохранять с именем стиля: `A-gouache-1.png`, `B-ink-1.png`…
3. Что смотреть: читается ли Укун на маленьком экране; есть ли воздух и свет; похоже ли
   на книгу, а не на плакат или фото; стоят ли вещи на своих местах (плот в воде, дерево
   на скале).
4. Двум-трём лучшим стилям — ещё сцены «Водопад» и «Пещера» (блоки в разделе 3:
   заменить в промпте стиля кусок про сцену).
5. Выбранный стиль записать в `README.md` › 8.1.

---

## 3. Общие блоки «кто и что в кадре»

Одинаковые для всех стилей. В готовых промптах раздела 4 уже стоит «Плот»; для других
сцен — заменить им.

**Укун (вставлять в любую сцену с ним):**
```
a young golden-brown monkey, slim, big round amber eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, pale cream belly, long tail with one spiral curl, no clothes
```
(в главе 2, в школе: заменить `no clothes` на `wearing a plain grey-blue robe with a cream collar and an ochre sash`)

**Сцена «Плот» (проба по умолчанию):**
```
standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, rounded karst mountains fading into mist on the left, an old pine tree growing from a rocky cliff on the right, low red sun, wide view, the monkey small in a big world
```

**Сцена «Водопад»:**
```
a tall grey rock wall with a waterfall falling into a round pool, the monkey standing on a round boulder by the pool, pointing at the waterfall, other brown monkeys watching on the grassy bank, peach trees with pink peaches, bright midday
```

**Сцена «Пещера, урок»:**
```
inside a large sandstone cave hall with a round window showing green mountains, a very old master with a long white beard and white topknot in a cream robe sitting cross-legged on a red cushion on a stone platform, the monkey in a grey-blue robe sitting on the floor listening, a bronze incense burner with a thin curl of smoke, warm light
```

**Лист героя (образец Укуна):**
```
character sheet on plain cream paper, the same monkey shown three times: standing front view, side view facing left, sitting cross-legged, even soft light
```

---

## 4. Стили (8 штук)

У каждого: что за стиль одной строкой, **готовый полный промпт** сцены «Плот» и
поправки к настройкам. Стиль стоит первым и с весом — иначе Juggernaut уходит в фото.

### A. Гуашь с тушевой линией (кандидат)
Тёплая книжная живопись: матовые краски, видимые мазки, тонкая линия кистью, туман.
```
(children's picture book illustration, gouache painting:1.3), hand-painted, fine ink brush outlines, flat matte colours, visible brush strokes, textured watercolour paper, warm ochre, jade green and muted azure, cool blue-green shadows, Chinese landscape painting atmosphere, a young golden-brown monkey, slim, big round amber eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, pale cream belly, long tail with one spiral curl, no clothes, standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, rounded karst mountains fading into mist on the left, an old pine tree growing from a rocky cliff on the right, low red sun, wide view, the monkey small in a big world
```
Настройки: как в разделе 1.

### B. Тушь с лёгким цветом (水墨淡彩)
Китайская живопись тушью: туман, пустая бумага, цвет только в герое и солнце.
```
(traditional Chinese ink wash painting, shuimo:1.4), sumi-e, soft graded ink washes on rice paper, wide empty paper as sky and water, mountains dissolving into mist, light colour accents only, pale ochre monkey, vermilion sun, a young golden-brown monkey, slim, big round amber eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, long tail with one spiral curl, no clothes, standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, tall karst peaks in mist on the left, an old gnarled pine growing from a cliff on the right, wide view, the monkey small in a big world, calm, poetic
```
Настройки: Guidance 6. В негатив добавить `saturated colours, colourful sky`.

### C. Сине-зелёный пейзаж на шёлке (青绿山水)
Лазурные и малахитовые горы, тонкий контур, сказочно и празднично.
```
(Chinese blue-green landscape painting, qinglu shanshui:1.4), mineral pigments, azurite blue peaks grading into malachite green and ochre, fine even ink outlines, aged silk texture, sea of fine wave lines, white mist between mountains, decorative, fairy-tale, a young golden-brown monkey, slim, big round amber eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, long tail with one spiral curl, no clothes, standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, layered rounded peaks on the left, an old pine on a cliff on the right, red sun, wide view
```
Настройки: Sharpness 2 (линия чётче).

### D. Лубок, оттиск с доски (木版年画)
Плоские яркие цвета, жирный контур, волны-завитки. Весело, читается издалека.
```
(Chinese woodblock New Year print, nianhua:1.4), flat bold colours, thick even dark outlines, limited palette of indigo, teal, jade green, ochre and vermilion on cream paper, print texture, stylised curling wave crests, simple shapes, cheerful, a young golden-brown monkey, big round eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, long curling tail, no clothes, standing on a small log raft, pushing it with a bamboo pole, sailing left across the sea, rounded teal mountains on the left, a pine on a green cliff on the right, vermilion sun in an ochre ring
```
Настройки: Guidance 6, Sharpness 2. В негатив добавить `gradient, soft shading, realistic`.

### E. Театр теней (皮影)
Резные полупрозрачные фигурки на подсвеченном экране. Театрально, как будто история разыгрывается.
```
(Chinese shadow puppet theatre, piying:1.4), flat translucent coloured leather cut-out figures pressed against a glowing amber paper screen lit from behind, intricate pierced patterns, crisp dark outlines, jewel-like vermilion, jade and turquoise dyes glowing in the light, strict side profiles, a monkey shadow puppet with saffron-gold pierced body, small tuft on the head, long curling tail with scroll cut-outs, standing on a carved flat raft, pushing a pole, sailing left over carved turquoise wave scrolls, carved mountains on the left, a carved pine on a cliff on the right, round vermilion sun cut-out
```
Настройки: Guidance 6. В негатив добавить `puppeteer, hands, rods in front, perspective`.

### F. Вырезка из бумаги, слоями (剪纸)
Многослойная бумага с тенями между слоями, как диорама в коробке.
```
(layered paper cut art, Chinese jianzhi:1.4), multi-layer cut paper diorama, soft shadows between paper layers, clean cut edges, matte paper texture, red, jade green, teal and cream paper, a young golden-brown paper monkey, big round eyes, heart-shaped pale face, small flame-shaped tuft, long curling tail, standing on a small paper raft, holding a long pole, sailing left on layered paper waves, layered paper mountains on the left, a paper pine on a cliff on the right, round red paper sun, depth, handmade
```
Настройки: Sharpness 2. В негатив убрать `depth of field` (тут глубина нужна слоями).

### G. Акварельная детская книга
Лёгкая прозрачная акварель, разводы, много белой бумаги. Самая мягкая.
```
(soft watercolour children's book illustration:1.3), loose transparent washes, gentle colour bleeds, white paper showing through, light pencil lines, pastel ochre, sea green and sky blue, airy and tender, a young golden-brown monkey, slim, big round amber eyes, heart-shaped pale peach face, small flame-shaped tuft of fur on top of head, long tail with one spiral curl, no clothes, standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, misty rounded mountains on the left, a pine on a rocky cliff on the right, low warm sun, wide view
```
Настройки: Sharpness 1, Guidance 5.

### H. Китайский комикс-«лянхуаньхуа» (连环画)
Классические китайские книжки-картинки: тонкая перьевая линия, штриховка, мало цвета.
```
(Chinese lianhuanhua picture-story book illustration:1.4), fine pen and ink line drawing, delicate hatching, mostly black ink on warm paper with a few soft colour washes, classic 1960s Chinese storybook art, a young monkey with a small tuft of fur on top of the head, big round eyes, long curling tail, no clothes, standing on a small log raft, pushing it with a long bamboo pole, sailing left across a calm sea, karst mountains drawn in fine lines on the left, a gnarled pine on a cliff on the right, wide view
```
Настройки: Sharpness 2, Guidance 6. В негатив добавить `colourful, gradient, painterly`.

---

## 5. Если всё равно выходит «как фото»

1. Поднять вес стиля в начале промпта: `:1.3` → `:1.5`.
2. Guidance Scale 6–7.
3. В стилях Fooocus поискать (поле поиска стилей) `watercolor`, `ink`, `paper`, `woodblock`
   и включить **один** подходящий, если найдётся; Fooocus V2/Enhance/Sharp — выключены.
4. Не помогает — Juggernaut тянет к фото слишком сильно для этого стиля. Тогда модель,
   которая рисует сама: DreamShaper 8 (SD 1.5) или ColorfulXL-Lightning с LoRA «Children's
   Picture Book XL» (`README.md` › 8.5) — промпты отсюда подходят и к ним.

## 6. Укун одинаковый от сцены к сцене

1. Сделать лист героя (раздел 3) в выбранном стиле, выбрать лучший.
2. В каждой сцене: **Input Image › Image Prompt**, перетащить лист, тип **ImagePrompt**,
   Advanced: вес ~0.6, Stop At ~0.5 (больше — начнёт копировать позу листа).
3. **FaceSwap не брать** — он для человеческих лиц, морду обезьяны испортит.
4. Удачный seed записывать рядом с картинкой.
5. Надёжно — только LoRA на Укуна (15–20 одинаковых картинок), но на 8 ГБ памяти её не
   обучить; это — в облаке или в другом сервисе (`README.md` › 8.5).
