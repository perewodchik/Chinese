import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bookStyleOf, paragraphScenes } from './bookStyle';

describe('a book dressed as itself', () => {
  it('knows 西游记 by its name, in Chinese or English, or by its hero', () => {
    assert.equal(bookStyleOf('西游记 (easier)'), 'xiyouji');
    assert.equal(bookStyleOf(null, 'Journey to the West'), 'xiyouji');
    assert.equal(bookStyleOf('The Monkey King, chapter 3'), 'xiyouji');
    assert.equal(bookStyleOf('皮卡丘饿了', 'Pikachu is hungry'), null);
  });

  it('sets each paragraph where it happens, and names a place where it first comes', () => {
    const s = paragraphScenes([
      '很久很久以前，有一座花果山。山上有一块大石头。',
      '猴子们在水帘洞里住。',
      '大家都很高兴。',
      '后来，他去海里找龙王。龙王给了他一根金箍棒。',
      '他又飞到天上，见了玉皇大帝。',
    ]);
    assert.deepEqual(
      s.map((p) => p.scene),
      ['mountain', 'cave', 'cave', 'sea', 'heaven'],
    );
    assert.equal(s[0]!.place?.en, 'the Mountain of Flowers and Fruit');
    assert.equal(s[1]!.place?.zh, '水帘洞');
    assert.equal(s[2]!.place, null);
  });

  it('gives the first paragraphs, before a place is said, the first scene that comes', () => {
    assert.deepEqual(
      paragraphScenes(['他说：“好！”', '他们走在去西天的路上。']).map((p) => p.scene),
      ['road', 'road'],
    );
  });
});
