import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allPartsRead,
  chapterRollup,
  isPartRead,
  MAX_PART_HANZI,
  partParas,
  partProgressKey,
  sliceChapterPart,
  splitChapter,
} from './chapterParts';
import { paragraphs } from './reading';
import type { GeneratedText, TextLine } from './text';

function makeChapter(paraCounts: number[], extra: Partial<GeneratedText> = {}): GeneratedText {
  const lines: TextLine[] = [];
  paraCounts.forEach((n, p) => {
    lines.push({
      zh: '猴'.repeat(n) + '。',
      py: 'hóu',
      en: `Paragraph ${p + 1}.`,
      ...(p > 0 ? { p: true } : {}),
    });
  });
  return {
    id: 'ch-1',
    title: 'Chapter 1: Test',
    titleZh: '美猴王横空出世',
    topic: '西游记',
    length: 'long',
    level: 'edge',
    genre: 'story',
    createdAt: 1,
    model: 'Claude · adapted from 西游记',
    lines,
    vocab: [],
    questions: [{ zh: '谁是美猴王？', py: 'shéi shì Měihóuwáng?', en: 'Who is the Monkey King?' }],
    grammar: [],
    note: '',
    teach: [],
    glosses: {},
    basis: [],
    read: false,
    ...extra,
  };
}

test('does not split a chapter at or under 450 hanzi', () => {
  assert.deepEqual(splitChapter(makeChapter([100, 150, 200])), []);
  assert.deepEqual(splitChapter(makeChapter([450])), []);
});

test('does not split a single paragraph even if over 450 hanzi', () => {
  assert.deepEqual(splitChapter(makeChapter([600])), []);
});

test('splits Journey to the West chapters along paragraph boundaries into balanced parts <= 450 hanzi', () => {
  // 西游记 (easier) Ch 1: 625 hanzi
  const ch1 = splitChapter(makeChapter([57, 183, 144, 78, 92, 71]));
  assert.equal(ch1.length, 2);
  assert.deepEqual(ch1.map((p) => p.hanzi), [384, 241]);
  assert.ok(ch1.every((p) => p.hanzi <= MAX_PART_HANZI));

  // 西游记 (easier) Ch 2: 500 hanzi — balanced 224 + 276 instead of greedy 441 + 59
  const ch2 = splitChapter(makeChapter([58, 79, 46, 41, 115, 59, 43, 59]));
  assert.equal(ch2.length, 2);
  assert.deepEqual(ch2.map((p) => p.hanzi), [224, 276]);
  assert.deepEqual(ch2.map((p) => [p.paraFrom, p.paraTo]), [[0, 3], [4, 7]]);

  // 西游记 (easier) Ch 3: 1000 hanzi
  const ch3 = splitChapter(makeChapter([77, 99, 92, 33, 132, 80, 73, 103, 64, 154, 93]));
  assert.equal(ch3.length, 3);
  assert.deepEqual(ch3.map((p) => p.hanzi), [301, 388, 311]);
  assert.ok(ch3.every((p) => p.hanzi <= MAX_PART_HANZI));

  // 西游记 (original) Ch 3: 1014 hanzi
  const ch3Orig = splitChapter(makeChapter([80, 86, 88, 47, 146, 88, 76, 100, 51, 161, 91]));
  assert.equal(ch3Orig.length, 3);
  assert.deepEqual(ch3Orig.map((p) => p.hanzi), [301, 310, 403]);
  assert.ok(ch3Orig.every((p) => p.hanzi <= MAX_PART_HANZI));
});

test('keeps an oversized single paragraph intact as its own part', () => {
  const parts = splitChapter(makeChapter([100, 500, 120]));
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map((p) => p.hanzi), [100, 500, 120]);
});

test('sliceChapterPart preserves paragraphs, reindexes pictures and marks, and filters vocab/grammar', () => {
  const full = makeChapter([200, 200, 200, 200], {
    lines: [
      { zh: '花果山有一块石头。', py: 'Huāguǒshān yǒu yī kuài shítou.', en: 'On Huaguo Mountain there was a stone.' },
      { zh: '石头里跳出一只石猴。' + '石'.repeat(190), py: '...', en: 'A stone monkey jumped out.' },
      { zh: '他发现了水帘洞。' + '水'.repeat(192), py: '...', en: 'He found Water Curtain Cave.', p: true },
      { zh: '众猴叫他美猴王。' + '王'.repeat(192), py: '...', en: 'The monkeys called him Monkey King.', p: true },
      { zh: '他想去学长生不老。' + '学'.repeat(191), py: '...', en: 'He wanted to learn immortality.', p: true },
    ],
    vocab: [
      { w: '花果山', py: 'Huāguǒshān', d: 'Mount Huaguo' },
      { w: '水帘洞', py: 'Shuǐliándòng', d: 'Water Curtain Cave' },
      { w: '长生不老', py: 'chángshēngbùlǎo', d: 'immortality' },
    ],
    grammar: [
      { point: '有一块', zh: '花果山有一块石头。', en: 'There is a piece of' },
      { point: '想去', zh: '他想去学长生不老。', en: 'want to go' },
    ],
    pictures: [
      { para: 0, prompt: 'stone', key: 'a'.repeat(64), w: 800, h: 600 },
      { para: 1, prompt: 'cave', key: 'b'.repeat(64), w: 800, h: 600 },
      { para: 2, prompt: 'king', key: 'c'.repeat(64), w: 800, h: 600 },
      { para: 3, prompt: 'immortal', key: 'd'.repeat(64), w: 800, h: 600 },
    ],
    study: {
      marks: {
        '0': { at: 100, note: 'first' },
        '3': { at: 200, note: 'king note' },
      },
    },
  });

  const parts = splitChapter(full);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((p) => [p.paraFrom, p.paraTo, p.lineFrom, p.lineTo]), [
    [0, 1, 0, 2],
    [2, 3, 3, 4],
  ]);

  const p1 = sliceChapterPart(full, parts[0]!);
  assert.equal(paragraphs(p1).length, 2);
  assert.deepEqual(p1.pictures?.map((x) => [x.para, x.prompt]), [
    [0, 'stone'],
    [1, 'cave'],
  ]);
  assert.deepEqual(p1.vocab.map((v) => v.w), ['花果山', '水帘洞']);
  assert.deepEqual(p1.grammar.map((g) => g.point), ['有一块']);
  assert.equal(p1.questions.length, 0);
  assert.equal(p1.study?.marks?.['0']?.note, 'first');
  assert.equal(p1.study?.marks?.['3'], undefined);

  const p2 = sliceChapterPart(full, parts[1]!);
  assert.equal(paragraphs(p2).length, 2);
  assert.deepEqual(p2.pictures?.map((x) => [x.para, x.prompt]), [
    [0, 'king'],
    [1, 'immortal'],
  ]);
  assert.deepEqual(p2.vocab.map((v) => v.w), ['长生不老']);
  assert.deepEqual(p2.grammar.map((g) => g.point), ['想去']);
  assert.equal(p2.questions.length, 1);
  // Original line 3 becomes line 0 in part 2.
  assert.equal(p2.study?.marks?.['0']?.note, 'king note');
});

test('part read status and cumulative rollup aggregate across parts and full chapter', () => {
  const full = makeChapter([300, 300, 300]);
  const parts = splitChapter(full);
  assert.equal(parts.length, 3);

  // None read yet, part 1 half scrolled
  const shares: Record<string, number> = { [partProgressKey(full.id, 1)]: 50 };
  const r0 = chapterRollup(full, parts, (k) => shares[k] ?? null);
  assert.equal(r0.partsRead, 0);
  assert.equal(r0.partsTotal, 3);
  assert.equal(r0.totalHanzi, 900);
  assert.equal(r0.pct, 17);
  assert.equal(r0.started, true);
  assert.equal(r0.nextUnreadPart, 1);

  // Part 1 read via parasRead
  const withP1 = { ...full, study: { parasRead: partParas(parts[0]!) } };
  assert.equal(isPartRead(withP1, parts[0]!), true);
  assert.equal(isPartRead(withP1, parts[1]!), false);
  const r1 = chapterRollup(withP1, parts, () => null);
  assert.equal(r1.partsRead, 1);
  assert.equal(r1.pct, 33);
  assert.equal(r1.nextUnreadPart, 2);

  // Reading the last two parts completes the chapter
  assert.equal(allPartsRead(withP1, parts, [...partParas(parts[1]!), ...partParas(parts[2]!)]), true);
  assert.equal(allPartsRead(withP1, parts, partParas(parts[1]!)), false);

  // Full chapter marked read marks every part read and rollup 100%
  const done = { ...full, read: true };
  assert.ok(parts.every((p) => isPartRead(done, p)));
  const rDone = chapterRollup(done, parts, () => null);
  assert.equal(rDone.partsRead, 3);
  assert.equal(rDone.pct, 100);
});
