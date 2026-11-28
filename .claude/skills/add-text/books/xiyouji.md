# 西游记 (Journey to the West): how this book is added

Read this before adding a chapter of 西游记. It holds what was settled with
the learner for chapters 1 to 5, so the next one comes out the same.

## The book the learner has

A children's edition with pinyin over every character (太阳鸟经典大阅读). Each
chapter is two or three pages:
- a heading in a frame (三星洞石猴学道) with its pinyin in capitals under it;
- a red drop capital on the first character;
- the story in paragraphs;
- at the end, in a curly box with a little boy reading, a moral (孙悟空聪明好学…).

Transcribe the heading and the story. Leave out the pinyin printed over the
characters, the running head (太阳鸟经典大阅读), the page numbers (· 4 ·) and
the moral box: the moral is the editor's lesson, not the chapter. Say in the
report that it was left out, and offer to add it.

The pages are often photographed with the next page's edge in the frame. The
same lines then show twice (the right edge of page 4 is the start of page 5):
take each line from the photo where it is whole.

## One book: the retelling

| Session | id | What goes in |
|---|---|---|
| 西游记 (easier) | `mw3oblvnf2a5947e0114e54d5d7b` | the retelling of each chapter, `--adapted`, and the preface |

Until 28 November 2026 there was a second book, 西游记 (original), with the
book's own text of chapters 1 to 3 (on a shelf of its own, Originals). The
learner asked for it to be deleted and for **only the easier version** from
then on ("удали книгу оригинал, и сделай только в упрощённую версию"). It went
with `npm run -s texts -- remove-set <id>` (nothing in it was read). So now:
- add the retelling only: `--set <the id above> --source "西游记" --genre story
  --adapted`; no file for the book's own text, and no second session;
- the book's own text is the learner's printed book; the retelling is what
  the app teaches from. If the original is ever wanted back, its chapters
  can be added again from the photos as a book (without `--adapted`) into a
  new session.

Check the id with `npm run -s texts -- sets` first; if it has changed, match
by name.

## Titles

- `titleZh` is the book's heading exactly, with no 第二章 in front: the
  reader numbers the chapters itself, by their place in the book
  (`chapterHead` in `src/domain/bookshelf.ts`), and shows 第二章 over the title.
- The same `titleZh` on both versions.
- `title` is the heading in English ("The stone monkey learns the Way at Three
  Stars Cave"); the retelling's adds " (easier)".

| Chapter | titleZh | title |
|---|---|---|
| 1 | 美猴王横空出世 | The Monkey King is born |
| 2 | 三星洞石猴学道 | The stone monkey learns the Way at Three Stars Cave |
| 3 | 闯龙宫醉闹冥府 | Storming the Dragon Palace and rampaging drunk through the Underworld |
| 4 | 美猴王自封大圣 | The Monkey King names himself Great Sage |
| 5 | 孙悟空闹蟠桃会 | Sun Wukong crashes the Peach Banquet |

## Names, as they are written here

Keep every name in `vocab` of both versions, so the reader keeps it one word.

| Chinese | pinyin | `d` |
|---|---|---|
| 美猴王 | Měihóuwáng | the Handsome Monkey King |
| 石猴 | shíhóu | the stone monkey |
| 孙悟空 | Sūn Wùkōng | Sun Wukong, the name his master gives him (ch. 2) |
| 悟空 | Wùkōng | how the master calls him |
| 菩提祖师 | Pútí zǔshī | Master Bodhi, his teacher |
| 祖师, 老祖 | zǔshī, lǎozǔ | the master (the book uses all three for him) |
| 花果山 | Huāguǒshān | the Mountain of Flowers and Fruit, his home |
| 水帘洞 | Shuǐliándòng | the Water Curtain Cave (ch. 1) |
| 东胜神洲 | Dōngshèng Shénzhōu | the Eastern Continent (ch. 1) |
| 西牛贺洲 | Xīniúhèzhōu | the Western Continent (ch. 2) |
| 灵台方寸山, 斜月三星洞 | Língtáifāngcùnshān, Xiéyuèsānxīngdòng | the master's mountain and cave (ch. 2) |
| 玉皇大帝, 玉帝 | Yùhuáng Dàdì, Yùdì | the Jade Emperor (ch. 1) |
| 筋斗云 | jīndǒuyún | the somersault cloud |
| 七十二变 | qīshí'èr biàn | the seventy-two transformations |
| 金箍棒, 如意棒 | jīngūbàng, rúyìbàng | the golden-banded staff; the As-You-Will staff, the same one (ch. 3) |
| 东海龙王, 敖广 | Dōnghǎi lóngwáng, Áo Guǎng | the Dragon King of the Eastern Sea (ch. 3) |
| 龙宫 | lónggōng | the Dragon Palace (ch. 3) |
| 幽冥界, 冥府, 地府 | Yōumíngjiè, míngfǔ, dìfǔ | the Underworld (ch. 3: all three) |
| 阎王, 阎罗殿 | Yánwang, Yánluódiàn | Yama, the King of Hell; his hall (ch. 3) |
| 十代冥王, 秦广王 | Shídài Míngwáng, Qínguǎngwáng | the Ten Kings of the Underworld; the first of them (ch. 3) |
| 生死簿 | shēngsǐbù | the Book of Life and Death (ch. 3) |
| 太白金星 | Tàibái Jīnxīng | the Great White Star, the Jade Emperor's messenger (ch. 3) |
| 灵霄宝殿, 天庭 | Língxiāo Bǎodiàn, tiāntíng | the Hall of Divine Mists; the Court of Heaven (ch. 3) |
| 弼马温 | Bìmǎwēn | Stable Keeper, the lowest post in Heaven (ch. 4) |
| 御马监 | Yùmǎjiān | the Imperial Stables (ch. 4) |
| 齐天大圣, 大圣 | Qítiān Dàshèng, dàshèng | the Great Sage Equal to Heaven, the title he gives himself; 大圣 for short (ch. 4 on) |
| 托塔天王李靖, 哪吒三太子 | Tuōtǎ Tiānwáng Lǐ Jìng, Né zhā Sān Tàizǐ | the Pagoda-Carrying King and his son Nezha, who fight him (ch. 4) |
| 王母娘娘, 瑶池 | Wángmǔniángniang, Yáochí | the Queen Mother and the Jade Pool where she holds her feasts (ch. 5) |
| 蟠桃(园, 大会) | pántáo(yuán, dàhuì) | the immortal peach; its garden; the Peach Banquet (ch. 5) |
| 太上老君, 兜率宫 | Tàishàng Lǎojūn, Dōu shuài gōng | Lord Lao, master of the elixirs; his Tushita Palace (ch. 5) |
| 赤脚大仙 | Chìjiǎo Dàxiān | the Barefoot Immortal, whose shape Wukong takes (ch. 5) |
| 金丹, 仙酒 | jīndān, xiānjiǔ | the golden elixirs and the immortal wine he steals (ch. 5) |

## The book's written style

The edition writes as books do, and `note` should say so in one line:
便 is 就, 其 is 他, 皆 is 都, 之 is 的, 与 is 和, 即 is 马上. A 成语 in the text
(风餐露宿, 手舞足蹈, 漂洋渡海) is one entry in `vocab` with its picture in `d`:
"to eat in the wind and sleep in the dew: a hard journey".

## The retelling

**Chapters 4 and 5** (28 November 2026): 92% known with 41 new characters, and
90% with 37 (the learner's words: "около 90%, может чуть выше"). A first draft
came out at 93% and 88%; the first was too easy, so the book's details went
back in (接风, 贺喜, 招安, 官衔, 神通, 邪心, 托塔天王, 称王称祖, 赤脚大仙,
摇摇晃晃, 手舞足蹈, 炒豆) and the second was cut (寸→kept, 棵 kept, 楼, 贝,
倒, 厉害, 府 and 燃灯古佛 dropped). The method that worked: write the Chinese
only, count the share against `sets` with a few lines of script, trim and add
until it is where the learner wants it, and only then write the pinyin and the
English. Dropped on purpose: the book's 御马监 stays (a name), but 阻挡, 须臾,
即刻, 浓密 and the like are said plainly; the editor's two moral boxes and
the 好词积累 list are left out (offer them).

Chapter 2's came out at 87% known with 11 new characters, all of them names or
words the story cannot do without (菩提祖, 孙悟空, 聪, 教, 筋斗云). What worked:
- **One paragraph of the retelling for each of the book's paragraphs**, with
  `"p": true` in the same places, so the eight pictures go above the same
  scenes in both books and the learner can read them side by side.
- Sentences of 6 to 14 characters, one idea each.
- A detail that costs new characters is said with known ones: the woodcutter
  (打柴人) became 一个老人; "from far away" (很远) became 从大海那边来; kneeling
  (跪) became sitting by the bed; 三更 became 半夜; the ruler (戒尺) went, he just
  hits him on the head three times.
- The book's patterns kept where they are easy: `听得太高兴了`, `这个也不学，
  那个也不学`.
- The names repeat a lot, so the share known is lower than the count of new
  characters suggests.
- **From chapter 3 the learner asked for 90% known** (not 95%), and for the
  retelling to stay closer to the book: keep its details (the crown, mail and
  shoes by name, the soul, the judge, the brush, the edict) and its everyday
  words (办法, 只好, 商量, 既然, 准备, 故意), and simplify only the written
  style and the rarest characters. Chapter 3 came out at 90% with 42 new
  characters (a first try at 87% was too hard), and lifted the book's own text
  from 76% to 81%. Measure against
  the shelf *without* the chapter's old texts when redoing one.

## Pictures

Drawn by hand, never by Gemini (the learner's choice), in the look of chapter
1: coloured pencil on grained paper, soft and warm. Read
`scripts/texts/art/BRIEF.md` first: its requirements are what each chapter is
held to. **Chapters 4 and 5 went in with no pictures**, at the learner's asking
("картинки не нужно делать"); ask again before drawing them, or the next
chapters. The drawings are code:

| Chapter | Module | Pictures |
|---|---|---|
| 1 | `scripts/texts/art/stories/xyj-ch1.mjs` | p1–p6, the same in both books |
| 2 | `scripts/texts/art/stories/xyj-ch2.mjs` | p1–p8; ¶6 has `p6-book` (kneeling) and `p6-easy` (sitting) |
| 3 | `scripts/texts/art/stories/xyj-ch3.mjs` | p1–p11, the same in both books (`p3-easy`, without the crown, was drawn for the first retelling and is not used now) |
| 4, 5 | none | not drawn |

The people, as the modules draw them, and as every chapter must keep them:
- **Sun Wukong**: `monkey({ fur: HERO, hero: true })` — a golden-brown monkey
  with a tuft on his head, a pale face and tummy, a curling tail. From chapter
  2, a disciple: `robe: '#9aa3ad'` (grey), crossed collar and a sash.
- **The monkeys of the Mountain**: `monkey({ fur: TROOP[n] })`, darker browns;
  the old monkey with white brows and beard (`old: true`).
- **Master Bodhi**: `person({ robe: '#f1ead8', trim: '#c9443a', hair: 'bald',
  beard: true })` — a pale robe with red trim, a bald crown with a little white
  topknot, white side hair and brows, a long white beard.
- **The other disciples**: `person({ hair: 'bun', robe: ROBES[n] })` — young,
  hair in a bun, robes in sage, sand and lavender.
- **The Jade Emperor**: `emperor()` in `xyj-ch1.mjs` — yellow robe, black crown,
  on a palace on a cloud.
- **The somersault cloud**: `nimbus()` in `xyj-ch2.mjs`.
- **Wukong from chapter 3, ¶4 on**: `armoured()` in `xyj-ch3.mjs` —
  `monkey({ robe: '#e0b040', armour: true, crown: true })`: golden chain mail,
  a purple-gold cap with two long red phoenix plumes. Before he gets it,
  `robed()`, the grey robe. His staff: `staff()` / `staffAt()`, black iron with
  a gold band at each end.
- **The Dragon Kings**: `dragonKing(sea)` — `person` with `hat: 'dragon'`
  (golden antlers, a little gold crown, long whiskers) and a pale beard; robes
  east green, south red, west white, north blue.
- **The Underworld**: ghosts `ghost()` (pale, grey robe, tall white pointed
  hat); the Ten Kings `underKing()` (dark red robe, black winged hat, black
  beard); the judge `judge()` (the same in dark green).
- **The Jade Emperor, full size**: `jadeEmperor()` — `person` with the yellow
  robe, `hat: 'crown'` (black board with red bead strings) and a black beard.
- **The Great White Star**: `greatWhiteStar()` — pale blue robe, white beard,
  a blue scholar's cap (`hat: 'scholar'`), a horsetail whisk.
- `person` now takes `skin`, `hat` (`HATS` in `xyj-ch2.mjs`) and
  `beardColour`, and the poses `offer` and `low`.

Put them in with `npm run -s texts -- put <text id> p1.jpg …`, into the easier
text and the book's text each, in paragraph order.

## The preface

The easier book opens with 人物和词语 ("Before you read: Journey to the West"),
`/read/text/mw51lpik317f85ec7315891e69f9`: the Stone Monkey and his names, the
Mountain and the Water Curtain Cave, the Jade Emperor, Master Bodhi and his
names, and the immortals' skills (长生, 七十二变, 筋斗云). It went in after the
chapters and was moved to the front with `npm run -s texts -- first <id>`.
When a chapter brings in a new person or a new name, add a sentence for them:
the text is in the account, so this means writing the preface's JSON again
from the one on the site and putting it in as a new text, or asking first.

There is no command to replace a text on the shelf: chapter 3's retelling
was swapped in place (same ids, dates and pictures) with a one-off script
calling `addBookTexts` on the workspace without the old texts, then a PUT.

Chapter 3 brings in the Dragon Kings, the Ten Kings of the Underworld and the
Great White Star; chapters 4 and 5 bring in the Stable Keeper, Li Jing and
Nezha, the Queen Mother, Lord Lao and the Barefoot Immortal. The preface does
not have any of them yet (not done without asking: offered to the learner).

## Chapters so far

| Chapter | Easier text | Book's text | Pictures |
|---|---|---|---|
| 0 人物和词语 (preface) | `/read/text/mw51lpik317f85ec7315891e69f9` | — | none |
| 1 美猴王横空出世 | in 西游记 (easier) | in 西游记 (original) | 6, `xyj-ch1.mjs` |
| 2 三星洞石猴学道 | `/read/text/mw4ycn066abce04c8eeac21ee178` | `/read/text/mw4ycyqlaae565bb6e8fb8b7d951` | 8, `xyj-ch2.mjs` |
| 3 闯龙宫醉闹冥府 | `/read/text/mwm998fnb5f8171c2376611b0f08` (90% known, 42 new) | — (the original book was deleted) | 11, `xyj-ch3.mjs` |
| 4 美猴王自封大圣 | `/read/text/mx0be1oxf96640a7f3a065554222` (92% known, 41 new) | — | none |
| 5 孙悟空闹蟠桃会 | `/read/text/mx0be1ozac4cf7407890bb27dedd` (90% known, 37 new) | — | none |

Add a row when a chapter goes in.
