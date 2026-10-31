import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { breakAtCommas, DEFAULT_LOOK, lookOf, momentAt, speakerOf, videoPlan } from './textVideo';

const line = (zh: string, p = false) => ({ zh, py: '', en: '', ...(p ? { p: true } : {}) });
const text = {
  genre: 'story' as const,
  lines: [line('一。', true), line('二。'), line('三。', true), line('四。')],
  questions: [line('谁？')],
  pictures: [{ para: 0, prompt: 'x', key: 'a'.repeat(64) }],
};
const reading = { timings: [[0, 900], [1000, 1900], [2000, 2900], [3000, 3900]] as Array<[number, number]>, durationMs: 4000 };

describe('a text as a video', () => {
  it('plays each paragraph to the middle of the quiet before the next, with the pauses, title and questions', () => {
    const plan = videoPlan(text, reading, DEFAULT_LOOK);
    assert.deepEqual(
      plan.steps.map((s) => [s.kind, s.at, s.dur]),
      [['title', 0, 2500], ['para', 2500, 1950], ['pause', 4450, 1000], ['para', 5450, 2050], ['question', 7500, 7500], ['answer', 15000, 3000]],
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

  it('opens with the question asked, over the cover chosen', () => {
    const plan = videoPlan(text, reading, DEFAULT_LOOK, { hook: ' 他饿了吗？ ', cover: 1 });
    assert.deepEqual(plan.steps.slice(0, 2).map((s) => [s.kind, s.at]), [['hook', 0], ['title', 2200]]);
    assert.equal(plan.hook, '他饿了吗？');
    assert.equal(plan.cover, 'a'.repeat(64));
    assert.equal(videoPlan(text, reading, DEFAULT_LOOK, { hook: '  ' }).steps[0]!.kind, 'title');
  });

  it('cuts a long video into parts of under a minute, at paragraphs and questions only', () => {
    const long = { ...reading, timings: [[0, 900], [30_000, 31_000], [40_000, 41_000], [70_000, 71_000]] as Array<[number, number]>, durationMs: 90_000 };
    const plan = videoPlan(text, long, { ...DEFAULT_LOOK, parts: true });
    // ¶1 is cut at 35.5 s, midway between 31 s and 40 s: title 2.5 + 35.5 + pause 1 = 39 s; ¶2 is 54.5 s more,
    // so it starts part 2; the questions after it would make 65 s: a third part.
    assert.deepEqual(plan.parts, [{ at: 0, dur: 39_000 }, { at: 39_000, dur: 54_500 }, { at: 93_500, dur: 10_500 }]);
    const m = momentAt(plan, 39_000 + 27_250, long.timings);
    assert.equal(m.part, 1);
    assert.equal(m.of, 3);
    assert.equal(m.progress, 0.5);
  });

  it('says the questions and their answers in the narrator\'s voice when they were read', () => {
    const asked = { timings: [[0, 3000], [3500, 4500]] as Array<[number, number]>, durationMs: 5000 };
    const withA = { ...text, questions: [{ zh: '谁？', py: '', en: '', a: '小智。' }] };
    const plan = videoPlan(withA, reading, DEFAULT_LOOK, {}, asked);
    const q = plan.steps.find((s) => s.kind === 'question')!;
    const a = plan.steps.find((s) => s.kind === 'answer')!;
    assert.deepEqual([q.kind === 'question' && q.said, q.dur], [{ from: 0, to: 3400 }, 3900 + 5000]);
    assert.deepEqual([a.kind === 'answer' && a.said, a.dur], [{ from: 3500, to: 4900 }, 3000]);
    // Not asked to: the questions are silent, as before.
    assert.equal(videoPlan(withA, reading, { ...DEFAULT_LOOK, voiceQuestions: false }, {}, asked).steps.find((s) => s.kind === 'question')!.dur, 7500);
  });

  it('cuts only an upright video into parts: a wide one stays whole', () => {
    const long = { ...reading, timings: [[0, 900], [30_000, 31_000], [40_000, 41_000], [70_000, 71_000]] as Array<[number, number]>, durationMs: 90_000 };
    assert.equal(videoPlan(text, long, { ...DEFAULT_LOOK, parts: true, shape: '16:9' }).parts.length, 1);
    assert.equal(lookOf({ shape: '4:3' }).shape, '9:16');
  });

  it('names who says a line where the text says so, and guesses nothing else', () => {
    assert.equal(speakerOf({ zh: '小智也笑了：“好吧，我们有吃的了！”' }), '小智');
    assert.equal(speakerOf({ zh: '妈妈说：“吃饭吧。”' }), '妈妈');
    assert.equal(speakerOf({ zh: '“皮卡，皮卡！”' }), '皮卡丘');
    assert.equal(speakerOf({ zh: '“皮卡丘，我下不来了！”' }), null);
    assert.equal(speakerOf({ zh: '他们坐在树下吃苹果。' }), null);
    assert.equal(speakerOf({ zh: '你好。', who: '老师' }), '老师');
  });

  it('keeps a signature short and a theme it knows', () => {
    assert.equal(lookOf({ mark: 'x'.repeat(60), background: 'board' }).mark.length, 40);
    assert.equal(lookOf({ background: 'pink' }).background, 'paper');
  });

  it('breaks a long line at its commas, never leaving a scrap', () => {
    assert.deepEqual(breakAtCommas('小智饿了，皮卡丘也饿了。'), ['小智饿了，', '皮卡丘也饿了。']);
    assert.deepEqual(breakAtCommas('好吧，我们有吃的了！'), ['好吧，我们有吃的了！']);
  });

  it('takes a kept look, putting back what it does not know', () => {
    assert.deepEqual(lookOf({ layout: 'over', size: 'huge', pinyin: false }), { ...DEFAULT_LOOK, layout: 'over', pinyin: false });
  });
});
