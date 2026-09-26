import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { judge, readWritten, summarise } from './dictation';
import { charId, wordId } from './ids';
import {
  autoParts,
  linePinyin,
  linesFromCues,
  linesFromText,
  mergeVideo,
  splitCue,
  transcriptWords,
  videoFrom,
  waitingVideo,
  youTubeId,
  type Video,
} from './video';
import { videoFit } from './videoFit';
import { readFixedPinyin, readPack } from './videoPack';
import { packPrompt } from './videoPrompt';
import { wordKnowledge } from './words';

const read = <T,>(p: string): T => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')) as T;
let cached: Library | null = null;
function lib(): Library {
  if (cached) return cached;
  const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
  const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
  cached = {
    characters: chars,
    components: {},
    themes: [],
    strokes: {},
    byChar: new Map(chars.map((c) => [c.c, c])),
    words,
    byWord: new Map(words.map((w) => [w.w, w])),
  };
  return cached;
}

describe('youTubeId', () => {
  it('finds the video in every shape of link', () => {
    assert.equal(youTubeId('https://www.youtube.com/watch?v=TC1szxmbrqg&list=PL0g3MTl_0rfOeTgfF0lyGQA7bEqhoTymF&index=17'), 'TC1szxmbrqg');
    assert.equal(youTubeId('youtu.be/w3lfaxSVN90'), 'w3lfaxSVN90');
    assert.equal(youTubeId('https://m.youtube.com/shorts/7sjhE6Y9f8c?si=x'), '7sjhE6Y9f8c');
    assert.equal(youTubeId('7sjhE6Y9f8c'), '7sjhE6Y9f8c');
    assert.equal(youTubeId('https://example.com/watch?v=7sjhE6Y9f8c'), null);
    assert.equal(youTubeId('not a link'), null);
  });
});

describe('captions into lines', () => {
  it('splits a caption carrying hanzi, pinyin and English', () => {
    assert.deepEqual(splitCue('这是我的弟弟乔治\nzhè shì wǒ de dìdi qiáozhì\nThis is my brother George.'), {
      zh: '这是我的弟弟乔治',
      py: 'zhè shì wǒ de dìdi qiáozhì',
      en: 'This is my brother George.',
    });
    assert.equal(splitCue('[音乐] 你好').zh, '你好');
  });

  it("lays the caption's pinyin over each character", () => {
    const [line] = linesFromCues([{ at: 4.9, end: 6.7, text: '这是我的弟弟乔治\nzhè shì wǒ de dìdi qiáozhì\nThis is my brother.' }], lib());
    assert.equal(line!.py, 'zhè shì wǒ de dì di qiáo zhì');
    assert.equal(line!.en, 'This is my brother.');
  });

  it('reads a word as the syllabus reads it, not the first reading of each character', () => {
    assert.equal(linePinyin('我去银行', lib()), 'wǒ qù yín háng');
    assert.equal(linePinyin('不行', lib()).split(' ')[1], 'xíng');
  });

  it('leaves out captions with no Chinese, and matches English by time', () => {
    const lines = linesFromCues(
      [
        { at: 0, end: 2, text: '[Music]' },
        { at: 2, end: 4, text: '猫在哪儿' },
      ],
      lib(),
      [{ at: 2.1, end: 3.9, text: 'Where is the cat?' }],
    );
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.en, 'Where is the cat?');
  });

  it('reads an SRT file and plain pasted text', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,500\n我家有一只猫。\n\n2\n00:00:04,000 --> 00:00:06,000\n它很可爱。\n';
    const a = linesFromText(srt, lib());
    assert.equal(a.length, 2);
    assert.equal(a[0]!.at, 1);
    assert.equal(a[1]!.end, 6);
    const b = linesFromText('我家有一只猫。它在哪儿？\nwǒ jiā\n猫在桌子下面。', lib());
    assert.deepEqual(
      b.map((l) => l.zh),
      ['我家有一只猫。', '它在哪儿？', '猫在桌子下面。'],
    );
  });
});

describe('names', () => {
  it('finds the names a transcript keeps repeating, and not everyday pairs', () => {
    const lines = ['我是佩奇', '佩奇在等苏西', '苏西来找佩奇', '我是苏西', '我是医生'].map((zh) => ({ zh }));
    const names = transcriptWords(lines, lib());
    assert.ok(names.has('佩奇'));
    assert.ok(names.has('苏西'));
    assert.ok(!names.has('我是'));
  });
});

describe('parts', () => {
  it('keeps a short video whole and cuts a long one at its pauses', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({ at: i * 3, end: i * 3 + 2 }));
    assert.deepEqual(autoParts(lines), [{ from: 0, to: 30 }]);
    const long = Array.from({ length: 60 }, (_, i) => ({ at: i * 3 + (i >= 32 ? 10 : 0), end: i * 3 + 2 + (i >= 32 ? 10 : 0) }));
    const parts = autoParts(long);
    assert.equal(parts.length, 2);
    assert.equal(parts[0]!.to, 32, 'cut where the long pause is');
    assert.equal(parts[1]!.to, 60);
  });
});

describe('the notebook check', () => {
  it('reads what was typed: numbers, marks, v for ü, nothing', () => {
    assert.deepEqual(readWritten('zhi4'), { py: 'zhì', tone: 4 });
    assert.deepEqual(readWritten('lv3'), { py: 'lǚ', tone: 3 });
    assert.deepEqual(readWritten('ji'), { py: 'ji', tone: null });
    assert.equal(readWritten('  '), null);
  });

  it('names the kind of mistake', () => {
    assert.deepEqual(judge('zhī', 'ji1', 1).kinds, ['initial']);
    assert.deepEqual(judge('zhī', 'zhi2', 1).kinds, ['tone']);
    assert.deepEqual(judge('máng', 'man2', 2).kinds, ['final']);
    assert.deepEqual(judge('shì', '', 4).kinds, ['missed']);
    assert.deepEqual(judge('shì', undefined, 4).kinds, ['unknown']);
    assert.deepEqual(judge('de', 'de', 5).kinds, [], 'no mark on a neutral tone is right');
  });

  it('forgives writing the tone that is said', () => {
    const v = judge('nǐ', 'ni2', 2, 'third');
    assert.deepEqual(v.kinds, []);
    assert.equal(v.sandhi, 'third');
  });

  it('sums a part up: score, kinds and the mix-ups by lesson', () => {
    const lines = [
      { zh: '你好', py: 'nǐ hǎo' },
      { zh: '我是学生', py: 'wǒ shì xué sheng' },
    ];
    const s = summarise(lines, [
      { line: 0, syl: 0, wrote: 'ni2' },
      { line: 1, syl: 1, wrote: 'si4' },
      { line: 1, syl: 3, wrote: 'shen' },
    ]);
    assert.equal(s.total, 6);
    assert.equal(s.right, 4);
    assert.equal(s.sandhi, 1);
    assert.equal(s.counts.initial, 1);
    assert.equal(s.counts.final, 1);
    assert.deepEqual(
      s.confusions.map((c) => c.lesson).sort(),
      ['nasal', 'zh'],
    );
    const missed = summarise(lines, [{ line: 1, syl: 0, whole: true }]);
    assert.equal(missed.right, 2);
    assert.equal(missed.counts.missed, 4);
  });
});

describe('how well a video fits', () => {
  it('counts known words over the words said, leaving names and laughter out', () => {
    const l = lib();
    const recall = {
      [wordId('我')]: { recognise: { last: 1, due: 9e15, interval: 30, ease: 2.5, reps: 5, lapses: 0 } },
      [wordId('是')]: { recognise: { last: 1, due: 9e15, interval: 30, ease: 2.5, reps: 5, lapses: 0 } },
    } as never;
    const knows = wordKnowledge(l, recall, new Set());
    const fit = videoFit(
      [
        { zh: '我是佩奇', at: 0, end: 2 },
        { zh: '哈哈哈', at: 2, end: 3 },
        { zh: '我是医生', at: 3, end: 5 },
      ],
      l,
      knows,
      { target: 1, knownChars: new Set(['我', '是']), ignore: new Set(['佩奇']) },
    );
    assert.equal(fit.words, 5);
    assert.equal(fit.coverage, 0.8);
    assert.deepEqual(
      [...fit.newInBand, ...fit.newAbove].map((w) => w.w),
      ['医生'],
    );
    assert.ok(fit.newChars.includes('医'));
  });
});

const sample = (): Video => ({
  ...waitingVideo('TC1szxmbrqg', 10),
  title: '猫在哪儿',
  lines: [
    { at: 1, end: 3, zh: '我家有一只猫。', py: 'wǒ jiā yǒu yī zhī māo' },
    { at: 4, end: 6, zh: '猫在哪儿？', py: 'māo zài nǎ ér' },
  ],
  parts: [{ from: 0, to: 2 }],
  textFrom: 'captions',
});

describe('the study pack', () => {
  it('prompts with the transcript numbered as in the notebook', () => {
    const p = packPrompt(sample(), 0, { band: 2, known: ['我'], learning: [], chars: ['我'], weak: ['zh written as j'] });
    assert.match(p, /^1 00:01\.0 我家有一只猫。 \| wǒ jiā yǒu yī zhī māo/m);
    assert.match(p, /zh written as j/);
    assert.match(p, /```json/);
  });

  it('reads a pack, dropping what does not fit the part', () => {
    const raw =
      'Here you go:\n```json\n' +
      JSON.stringify({
        lines: [
          { n: 1, py: 'wǒ jiā yǒu yì zhī māo', en: 'We have a cat at home.' },
          { n: 2, py: 'māo zài nǎr', en: 'Where is the cat?' },
          { n: 9, en: 'no such line' },
        ],
        words: [{ w: '只', py: 'zhī', en: 'measure word for animals', hsk: 3, lines: [1, 7], verdict: 'learn_now' }, { w: 'x' }],
        questions: [{ q: { zh: '猫在哪儿？', py: '', en: '' }, answer: { zh: '在外面。', py: '', en: '' }, lines: [2] }],
        level: { verdict: 'easy', why: 'short' },
      }) +
      '\n```';
    const { pack, problems } = readPack(raw, sample().lines, 5);
    assert.ok(pack);
    assert.equal(pack.lines[1]!.py, 'wǒ jiā yǒu yì zhī māo');
    assert.equal(pack.lines[2]!.py, undefined, 'four syllables for five characters: kept the app’s');
    assert.equal(pack.lines[9], undefined);
    assert.deepEqual(pack.words.map((w) => [w.w, w.lines]), [['只', [1]]]);
    assert.equal(pack.questions.length, 1);
    assert.ok(problems.length >= 2);
  });

  it('reads a corrected pinyin line', () => {
    assert.equal(readFixedPinyin('māo zài nǎ r?\nThe 儿 is…', '猫在哪儿'), 'māo zài nǎ r');
    assert.equal(readFixedPinyin('māo zài', '猫在哪儿'), null);
  });
});

describe('storing videos', () => {
  it('reads a stored video back and merges two copies without losing checks', () => {
    const v = sample();
    const back = videoFrom(JSON.parse(JSON.stringify(v)));
    assert.deepEqual(JSON.parse(JSON.stringify(back)), JSON.parse(JSON.stringify(v)));
    assert.equal(videoFrom({ nope: 1 }), null);
    const a = { ...v, updatedAt: 20, checks: [{ id: 'a', part: 0, at: 20, way: 'quick' as const, total: 11, right: 9 }] };
    const b = { ...v, updatedAt: 30, status: 'done' as const, checks: [{ id: 'b', part: 0, at: 30, way: 'overall' as const, total: 11, right: 11 }] };
    const m = mergeVideo(a, b);
    assert.equal(m.status, 'done');
    assert.deepEqual(m.checks.map((c) => c.id), ['a', 'b']);
  });
});

// Keep charId in use for readers of this file who add character cases.
void charId;
