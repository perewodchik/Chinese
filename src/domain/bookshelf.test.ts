import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reduce } from '../store/actions';
import { hydrate, serialise } from '../store/migrations';
import { emptyState } from '../store/state';
import { bookcase, bookOf, chapterHead, coverArt, coverColor, kindOf, SHELF_FROM_BOOKS, SHELF_MINE, SHELF_STORIES } from './bookshelf';
import { BOOK, type GeneratedText, type TextSet } from './text';

// Texts shaped as the learner's are (November 2026): only what a shelf reads of them.
const text = (o: Partial<GeneratedText> & { titleZh: string }): GeneratedText =>
  ({ id: o.titleZh + (o.title ?? ''), title: '', topic: '', genre: 'story', model: 'claude', lines: [], vocab: [], questions: [], grammar: [], glosses: {}, teach: [], basis: [], level: 'edge', length: 'short', createdAt: 1, ...o }) as GeneratedText;
const set = (name: string, o: Partial<TextSet> = {}): TextSet => ({ id: name, name, createdAt: 1, ...o });

const pikachu = [
  text({ titleZh: '人物和词语', title: 'Before you read', genre: 'story' }),
  text({ titleZh: '第一章 森林里的苹果', title: 'Chapter 1: Apples in the Forest', pictures: [{} as never] }),
  text({ titleZh: '第二章 河里的大鱼', title: 'Chapter 2: The Big Fish in the River' }),
  text({ titleZh: '第三章 城里的比赛', title: 'Chapter 3: The Contest in the City' }),
  text({ titleZh: '第五章 坏人和出租车', title: 'Chapter 5: The Bad Guys and the Taxi' }),
  text({ titleZh: '第六章 在机场', title: 'Chapter 6: At the Airport' }),
];
const practice = [text({ titleZh: '广州一日游', title: 'A Visit to Guangzhou' }), text({ titleZh: '坐火车', title: 'Taking the Train' })];
const why = [text({ titleZh: '为什么面包里有很多小孔？', title: 'Why does bread have so many little holes', genre: 'description', model: BOOK })];
const monkey = [text({ titleZh: '美猴王横空出世', title: 'The Monkey King is born', pictures: [{} as never] })];
const monkeyEasy = [text({ titleZh: '美猴王横空出世', title: 'The Monkey King is born (easier)', model: 'claude, adapted from Book', pictures: [{} as never] })];

describe('books on shelves', () => {
  it('draws a cover for a story told as a book, and a label for anything else', () => {
    assert.equal(kindOf(pikachu), 'story');
    assert.equal(kindOf(monkey), 'story');
    // A few short stories for practice stay an exercise book.
    assert.equal(kindOf(practice), 'plain');
    assert.equal(kindOf(why), 'plain');
  });

  it('draws the cover from where the story opens, else its title', () => {
    // 皮卡丘饿了 opens in a forest of apples: not a bowl because its title says hungry.
    assert.equal(coverArt('皮卡丘饿了', pikachu), 'tree');
    assert.equal(coverArt('西游记', monkey), 'mountain');
    assert.equal(coverArt('天官赐福 1', [text({ titleZh: '第一话', title: 'Chapter 1' })]), 'lantern');
    assert.equal(coverArt('无题', [text({ titleZh: '你好', title: 'Hello' })]), 'night');
  });

  it('marks the easier edition, gives both editions one title and one colour', () => {
    const easy = bookOf(set('西游记 (easier)'), monkeyEasy);
    const orig = bookOf(set('西游记 (original)'), monkey);
    assert.equal(easy.easier, true);
    assert.equal(orig.easier, false);
    assert.equal(easy.title, '西游记');
    assert.deepEqual(easy.color, orig.color);
    assert.deepEqual(coverColor('西游记'), coverColor('西游记'));
  });

  it('puts a book on its shelf: stories, real books, your own texts, or where you put it', () => {
    assert.equal(bookOf(set('皮卡丘饿了'), pikachu).shelf, SHELF_STORIES);
    assert.equal(bookOf(set('十万个为什么'), why).shelf, SHELF_FROM_BOOKS);
    assert.equal(bookOf(set('Reading, 14 September'), practice).shelf, SHELF_MINE);
    assert.equal(bookOf(set('Reading, 14 September', { shelf: 'Trips' }), practice).shelf, 'Trips');
  });

  it('lists Stories first, and both editions of a book side by side, the original first', () => {
    const sets = [set('Reading, 14 September', { createdAt: 9 }), set('西游记 (easier)', { createdAt: 5 }), set('皮卡丘饿了', { createdAt: 3 }), set('西游记 (original)', { createdAt: 4 })];
    const by = new Map<string, GeneratedText[]>([['Reading, 14 September', practice], ['西游记 (easier)', monkeyEasy], ['皮卡丘饿了', pikachu], ['西游记 (original)', monkey]]);
    const shelves = bookcase(sets, by);
    assert.deepEqual(shelves.map((s) => s.name), [SHELF_STORIES, SHELF_MINE]);
    assert.deepEqual(shelves[0]!.books.map((b) => `${b.title}${b.easier ? ' 简' : ''}`), ['西游记', '西游记 简', '皮卡丘饿了']);
  });

  it('keeps a shelf put by hand through saving and loading, and takes it back on null', () => {
    const start = { ...emptyState(), sets: [set('西游记 (easier)')] };
    const moved = reduce(start, { type: 'set/shelf', id: '西游记 (easier)', shelf: '  Classics ' });
    assert.equal(moved.sets[0]!.shelf, 'Classics');
    const back = hydrate(JSON.parse(JSON.stringify(serialise(moved))));
    assert.equal(back.sets[0]!.shelf, 'Classics');
    assert.equal(reduce(moved, { type: 'set/shelf', id: '西游记 (easier)', shelf: null }).sets[0]!.shelf, undefined);
  });
});

it('a chapter head takes its number out of both titles', () => {
  const t = (titleZh: string, title: string) => ({ titleZh, title }) as GeneratedText;
  assert.deepEqual(chapterHead(t('第六章 在机场', 'Chapter 6: At the Airport'), 6), { kicker: '第六章', zh: '在机场', en: 'At the Airport' });
  // A story whose titles carry no number takes its place among the chapters.
  assert.deepEqual(chapterHead(t('河里的大鱼', 'The Big Fish (easier)'), 12), { kicker: '第十二章', zh: '河里的大鱼', en: 'The Big Fish' });
  // A text that is not a chapter keeps its titles whole.
  assert.deepEqual(chapterHead(t('广州一日游', 'A Visit to Guangzhou'), null), { kicker: null, zh: '广州一日游', en: 'A Visit to Guangzhou' });
  // A title that is only the number keeps it.
  assert.deepEqual(chapterHead(t('第一章', 'Chapter 1'), 1), { kicker: null, zh: '第一章', en: 'Chapter 1' });
});
