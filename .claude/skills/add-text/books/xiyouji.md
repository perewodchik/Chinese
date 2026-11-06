# 西游记 (Journey to the West): how this book is added

Read this before adding a chapter of 西游记. It holds what was settled with
the learner for chapters 1 and 2, so chapter 3 comes out the same.

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

## Two books, not one

The learner asked for two books on the shelf ("две книги"):

| Session | id | What goes in |
|---|---|---|
| 西游记 (easier) | `mw3oblvnf2a5947e0114e54d5d7b` | the retelling of each chapter, `--adapted` |
| 西游记 (original) | `mw4buuar03a879f3a3ab341fd623` | the book's own text, as printed |

Check the ids with `npm run -s texts -- sets` first; if one has changed, match
by name. Both versions of a chapter go in every time, without asking: the
learner said "в таком же стиле" for chapter 2, which means as chapter 1 was.
The book's text is always "too hard" (chapter 2: 63% known, 125 new), so the
retelling is not optional.

Order: the easier file into the easier book with `--adapted`, then the book's
file into the original book. `--source "西游记"`, `--genre story`.

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

## The book's written style

The edition writes as books do, and `note` should say so in one line:
便 is 就, 其 is 他, 皆 is 都, 之 is 的, 与 is 和, 即 is 马上. A 成语 in the text
(风餐露宿, 手舞足蹈, 漂洋渡海) is one entry in `vocab` with its picture in `d`:
"to eat in the wind and sleep in the dew: a hard journey".

## The retelling

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
  characters suggests. 80% is the floor; aim for 90.

## Pictures

One picture a paragraph, eight for chapter 2. The same people must look the
same in every chapter, in both books. Describe them always in these words:

- **The Monkey King**: "a small golden-furred monkey king in a simple robe"
  (before he becomes a disciple), "the golden-furred monkey in a grey robe"
  (as a disciple).
- **Master Bodhi**: "an old master with a long white beard".
- **The other disciples**: "young disciples (pupils) in robes".
- **Places**: "a calm mountain cave school", "a green mountain covered in
  flowers and fruit trees" (花果山), "misty green mountains".

End each prompt with the light and the mood ("Deep blue night, gentle golden
lamplight."). No words or Chinese in the picture.

The retelling's prompts follow its own text: where it changed a detail (an old
man, not a woodcutter; sitting, not kneeling), change the prompt too.

Pictures are drawn with Gemini when `add` runs. In the cloud environment the
key was on the free tier, which draws nothing: `add` says so and leaves them.
They are drawn later with `npm run texts -- illustrate --set "西游记 (easier)"`
and the same for `(original)`, from the Mac or after billing is turned on in
Google AI Studio. Chapter 2's were left undrawn this way on 7 November 2026.

## Chapters so far

| Chapter | Easier text | Book's text | Pictures |
|---|---|---|---|
| 1 美猴王横空出世 | in 西游记 (easier) | in 西游记 (original) | 6 drawn |
| 2 三星洞石猴学道 | `/texts/mw4ycn066abce04c8eeac21ee178` | `/texts/mw4ycyqlaae565bb6e8fb8b7d951` | 8 described, not drawn |

Add a row when a chapter goes in.
