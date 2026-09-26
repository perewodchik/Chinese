import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { waitingVideo, type Video } from '../domain/video';
import { reduce, type Action } from './actions';
import { hydrate, serialise } from './migrations';
import { emptyState, type AppState } from './state';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reduce, state);

const withText = (at: number): Video => ({
  ...waitingVideo('TC1szxmbrqg', at),
  title: '猫在哪儿',
  textFrom: 'captions',
  lines: [
    { at: 1, end: 3, zh: '我家有一只猫。', py: 'wǒ jiā yǒu yī zhī māo' },
    { at: 4, end: 6, zh: '猫在哪儿？', py: 'māo zài nǎ ér' },
  ],
  parts: [{ from: 0, to: 2 }],
});

describe('videos in the store', () => {
  it('fills a video kept as a bare link once its text arrives, keeping what was done with it', () => {
    const bare = waitingVideo('TC1szxmbrqg', 1);
    const s = run(
      emptyState(),
      { type: 'video/add', video: bare },
      { type: 'video/watch', id: bare.id, at: 2 },
      { type: 'video/add', video: withText(3) },
    );
    assert.equal(s.videos.length, 1);
    assert.equal(s.videos[0]!.lines.length, 2);
    assert.equal(s.videos[0]!.marks.watched, 1);
    assert.equal(s.videos[0]!.status, 'working');
    // Added again with text it already has: nothing changes.
    assert.equal(run(s, { type: 'video/add', video: withText(9) }), s);
  });

  it('keeps notebook checks, and a re-marked check replaces itself', () => {
    const v = withText(1);
    const check = { id: 'c1', part: 0, at: 5, way: 'quick' as const, total: 11, right: 8 };
    const s = run(
      emptyState(),
      { type: 'video/add', video: v },
      { type: 'video/check', id: v.id, check },
      { type: 'video/check', id: v.id, check: { ...check, at: 6, right: 9 } },
    );
    assert.equal(s.videos[0]!.checks.length, 1);
    assert.equal(s.videos[0]!.checks[0]!.right, 9);
    assert.equal(s.videos[0]!.marks.written, true);
  });

  it("puts a study pack's pinyin and English onto the part's lines", () => {
    const v = withText(1);
    const s = run(
      emptyState(),
      { type: 'video/add', video: v },
      {
        type: 'video/pack',
        id: v.id,
        part: 0,
        at: 5,
        pack: {
          at: 5,
          lines: { 2: { py: 'māo zài nǎ r', en: 'Where is the cat?' } },
          sandhi: [],
          words: [],
          senses: [],
          grammar: [],
          notes: [],
          listening: [],
          questions: [],
          extra: { sentences: [] },
        },
      },
    );
    assert.equal(s.videos[0]!.lines[1]!.py, 'māo zài nǎ r');
    assert.equal(s.videos[0]!.lines[1]!.en, 'Where is the cat?');
    assert.equal(s.videos[0]!.lines[0]!.py, v.lines[0]!.py);
  });

  it('survives a save and a load', () => {
    const v = withText(1);
    const s = run(emptyState(), { type: 'video/add', video: v }, { type: 'video/patch', id: v.id, patch: { marks: { understood: 4 } }, at: 3 });
    const back = hydrate(JSON.parse(JSON.stringify(serialise(s))));
    assert.equal(back.videos.length, 1);
    assert.equal(back.videos[0]!.marks.understood, 4);
    assert.equal(back.videos[0]!.status, 'working');
  });
});
