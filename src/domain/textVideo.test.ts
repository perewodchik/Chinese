import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { breakAtCommas, DEFAULT_LOOK, lookOf, momentAt, videoPlan } from './textVideo';

const line = (zh: string, p = false) => ({ zh, py: '', en: '', ...(p ? { p: true } : {}) });
const text = {
  genre: 'story' as const,
  lines: [line('一。', true), line('二。'), line('三。', true), line('四。')],
  questions: [line('谁？')],
  pictures: [{ para: 0, prompt: 'x', key: 'a'.repeat(64) }],
};
const reading = { timings: [[0, 900], [1000, 1900], [2000, 2900], [3000, 3900]] as Array<[number, number]>, durationMs: 4000 };

describe('a text as a video', () => {
  it('plays each paragraph from where it starts to where the next starts, with the pauses, title and questions', () => {
    const plan = videoPlan(text, reading, DEFAULT_LOOK);
    assert.deepEqual(
      plan.steps.map((s) => [s.kind, s.at, s.dur]),
      [['title', 0, 2500], ['para', 2500, 2000], ['pause', 4500, 1000], ['para', 5500, 2000], ['question', 7500, 7500], ['answer', 15000, 3000]],
    );
    assert.equal(plan.duration, 18000);
  });

  it('keeps the last picture for a paragraph without its own', () => {
    assert.deepEqual(videoPlan(text, reading, DEFAULT_LOOK).pictureOf, ['a'.repeat(64), 'a'.repeat(64)]);
  });

  it('knows the line being read at any moment', () => {
    const plan = videoPlan(text, reading, { ...DEFAULT_LOOK, titleCard: false, pause: 0, questions: false });
    assert.equal(momentAt(plan, 500, reading.timings).line, 0);
    assert.equal(momentAt(plan, 1500, reading.timings).line, 1);
    assert.equal(momentAt(plan, 3100, reading.timings).line, 3);
  });

  it('breaks a long line at its commas, never leaving a scrap', () => {
    assert.deepEqual(breakAtCommas('小智饿了，皮卡丘也饿了。'), ['小智饿了，', '皮卡丘也饿了。']);
    assert.deepEqual(breakAtCommas('好吧，我们有吃的了！'), ['好吧，我们有吃的了！']);
  });

  it('takes a kept look, putting back what it does not know', () => {
    assert.deepEqual(lookOf({ layout: 'over', size: 'huge', pinyin: false }), { ...DEFAULT_LOOK, layout: 'over', pinyin: false });
  });
});
