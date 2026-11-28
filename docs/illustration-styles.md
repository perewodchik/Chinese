# Стили иллюстраций для книг (Google Flow)

Единый справочник стилей, описаний персонажей и настроек **Google Flow**, чтобы следующие главы обеих книг генерировались в одном визуальном стиле и с одинаковыми героями.

---

## Общие настройки Google Flow (для обеих книг)

- **Модель:** `Nano Banana 2.1`
- **Формат (Aspect ratio):** `4:3` (под читалку и режим Relive; при экспорте ресайз до ширины `1024 px`, JPEG ~80–84%)
- **Количество выходов (Number of outputs):** `x1`
- **Thinking level:** `High`
- **Обязательные правила в каждом промпте:**
  `clean full-bleed 4:3 artwork, no text, no letters, no Chinese characters, no speech bubbles, no borders, no page margins, no motion blur`

### Загрузка готовых картинок на сайт
После экспорта картинок в локальную папку `.cache/<folder>/p01.jpg ...` загружайте их через проектный скрипт `scripts/texts/book.ts`:
```bash
export PATH=/opt/homebrew/bin:$PATH
npm run texts -- put <textId> .cache/<folder>/p01.jpg .cache/<folder>/p02.jpg ...
```

---

## 1. «Путешествие на Запад» (`西游记`)

- **Проект в Google Flow:** `https://flow.google.com/project/5de0a8f2-f746-454c-8685-9089a12ca5be`
- **Сохранённый персонаж:** `Characters → Sun Wukong` (подключён как `Character ingredient` в `Agent settings → Memory`)
- **Memory (`Sun Wukong & Cozy Storybook Style`):** включена (`Use memory` ON)

### Визуальный стиль (Cozy Whimsical Storybook Gouache)
> Cozy whimsical children's storybook illustration in rich hand-painted gouache, watercolor washes, and soft colored pencil shading. Warm magical lighting (golden paper lanterns, sunbeams, glowing sparkles, gentle fireflies or wisps) contrasting rich indigo, teal, or warm twilight tones. Delicate expressive ink outlines, visible painterly brush & colored-pencil texture, charming lighthearted humor, clean full-bleed 4:3 artwork, no text, no Chinese characters, no borders, no page margins, no motion blur.

### Главный герой — Сунь Укун (`Sun Wukong`)
- **Базовая внешность (неизменна всегда):**
  `Slim, agile, youthful Monkey King hero with warm honey-brown fur, pale peach heart-shaped face, big expressive warm amber-brown eyes, cute rounded ears, a lively cheeky grin, a bouncy golden-brown swirl tuft of hair on top of his head, and a long curling golden-brown monkey tail.`
- **Костюм до Дворца Дракона (главы 1–3 до ¶4):**
  `Cozy red sleeveless Chinese tunic with warm gold trim, fluttering red neck scarf, yellow-gold waist sash, tiger-skin kilt wrap, dark cloth leg wraps (no crown or headband yet).`
- **Костюм после Дворца Дракона (глава 3 с ¶4 и дальше):**
  `Same face, fur, eyes, swirl tuft and tail, wearing gleaming golden chainmail armor over his red tunic and tiger-skin kilt, fluttering crimson cape, ornate cloud-walking boots, purple-gold crown with two long swooping red phoenix feathers, and carrying the glowing golden-banded Ruyi Jingu Bang staff.`

### Шаблон промпта для новых сцен `西游记`
```text
Using the saved Sun Wukong character reference and our project memory style, generate 1 4:3 storybook illustration:
Cozy whimsical children's storybook illustration in rich hand-painted gouache, watercolor washes, and soft colored pencil shading.
[МЕСТО И ОСВЕЩЕНИЕ]. [ДЕЙСТВИЕ И ЭМОЦИИ СУНЬ УКУНА + ОДЕЖДА ПО ГЛАВЕ]. [ДРУГИЕ ГЕРОИ И ДЕТАЛИ ПЕРЕДНЕГО/ЗАДНЕГО ПЛАНА].
Warm magical atmosphere, charming storybook humor, clean full-bleed 4:3 artwork, no text, no Chinese characters, no borders, no page margins, no motion blur.
```

---

## 2. «Шанхайский дневник Сяолиня» (`小林的上海日记`)

- **Проект в Google Flow:** `https://flow.google.com/project/8e645dce-5639-43cf-82fb-40a4b6a10f56`
- **Сохранённые персонажи:** `Xiao Lin` и `Zhou Wen` (подключены в `Agent settings → Memory`)

### Визуальный стиль (Soft Watercolor Slice-of-Life Picture Book — как в главах 1–8)
> Warm, gentle contemporary slice-of-life children's picture-book illustration in soft hand-painted watercolor washes with clean, delicate dark-brown ink outlines. Soft natural daylight (warm golden-cream sunlight through windows, gentle autumn tones) or cosy muted slate-blue evening light with warm desk/café lamps. Simple, expressive faces with dark dot eyes and soft rosy cheeks, clean uncluttered backgrounds, subtle watercolour paper grain, calm heartfelt atmosphere. Clean full-bleed 4:3 artwork, no text, no letters, no Chinese characters, no speech bubbles, no borders, no page margins.

### Канонические описания персонажей (сохранять слово в слово)
- **Сяолинь (`Xiao Lin` / 小林):**
  `Xiao Lin, a slim 20-year-old Chinese young man with short messy black hair, round black-rimmed glasses, gentle expressive dark eyes and soft rosy cheeks, wearing a muted slate-blue pullover hoodie, dark charcoal trousers, and white sneakers (wearing a forest-green barista apron over his blue hoodie when working at the coffee shop).`
- **Чжоу Вэнь (`Zhou Wen` / 周文 — появляется с 9-й главы):**
  `Zhou Wen, a tall, slim, handsome Chinese art student in his early twenties with slightly long, soft dark wavy hair gently framing his face, kind dark eyes and a warm gentle smile, wearing a relaxed crisp white button-up shirt with neatly rolled sleeves and soft dark-slate or beige trousers, often carrying a small brown cloth sketchbook notebook and pencil.`
- **Анна (`Anna` / 安娜):**
  `Anna, a cheerful young European woman in her early twenties with long wavy chestnut-brown hair, cute freckles across rosy cheeks, and a warm friendly smile, wearing a chunky mustard-yellow knit sweater and light-blue jeans.`
- **Дамин (`Daming` / 大明):**
  `Daming, a tall chubby 20-year-old Chinese young man with a short buzz cut, cheerful round face with rosy cheeks, wearing a bright coral-red T-shirt and light grey shorts.`
- **Мама Сяолиня (`Mom` / 妈妈):**
  `Xiao Lin's mother, a kind Chinese woman in her late forties with smooth shoulder-length black hair and a warm gentle smile, wearing a muted lavender-purple cardigan over a cream top.`
- **Хозяйка кафе Чэнь (`Boss Chen` / 陈老板):**
  `Boss Chen, a warm Chinese café owner woman in her fifties with a short grey bob, friendly laughing eyes, and a forest-green apron over a white blouse.`

### Повторяющиеся локации
- **Кофейня в Шанхае:**
  `A small cosy Shanghai coffee shop with warm honey-wood counters, a silver espresso machine, small glass jars, hanging warm brass pendant lamps, potted green plants, wooden tables, and a large wooden-framed window looking out onto leafy Shanghai plane trees.`
- **Комната общежития:**
  `A small cosy university dorm room with two wooden bunk beds, two wooden desks with desktop computers, a warm amber desk lamp, mugs and stacked books, and a central window.`
- **Шанхайское метро:**
  `Inside a clean, softly lit modern Shanghai metro train carriage with pastel blue/grey seats, vertical handrails, and warm autumn city lights or sky visible through the wide windows.`

### Шаблон промпта для новых сцен `小林的上海日记`
```text
Using the saved Xiao Lin (and Zhou Wen if present) character reference and our project memory style, generate 1 4:3 picture-book illustration:
Warm, gentle slice-of-life picture-book illustration in soft watercolour washes with clean delicate dark-brown ink outlines, matching Chapters 1–8.
[ЛОКАЦИЯ И ОСВЕЩЕНИЕ]. [ПЕРСОНАЖИ С КАНОНИЧЕСКИМИ ОПИСАНИЯМИ, ПОЗЫ И ЭМОЦИИ].
Soft warm colours, clean uncluttered background, gentle heartfelt mood, clean full-bleed 4:3 artwork, no text, no letters, no Chinese characters, no speech bubbles, no borders.
```
