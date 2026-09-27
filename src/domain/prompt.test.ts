import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { buildBrief, buildPrompt } from './prompt';
import { planSession } from './session';

const lib = { characters: [], byChar: new Map(), words: [], byWord: new Map() } as unknown as Library;
const plan = planSession({
  id: 'p',
  name: 'Test',
  setId: null,
  now: 0,
  lib,
  learned: new Set(),
  texts: [],
  basisCount: 150,
  hsk: 1,
});

describe('the words a writing prompt hands over', () => {
  it('names the words known as words, and says a word made of known characters is still new', () => {
    const text = buildPrompt(plan, { words: ['我们', '喜欢'], wordsKnown: true, learning: ['东西'] });
    assert.match(text, /## Words I know — 2\n\n我们、喜欢/);
    assert.match(text, /东西 is new to me unless it is here/);
    assert.match(text, /## Words I am learning — 1\n\n东西/);
    assert.doesNotMatch(text, /Words I can already read/);
  });

  it('falls back to the readable compounds before any word is known', () => {
    const text = buildPrompt(plan, { words: ['好看'], wordsKnown: false });
    assert.match(text, /## Words I can already read — 1/);
    assert.doesNotMatch(text, /## Words I know/);
  });

  it('carries the same lists in the JSON brief', () => {
    const brief = JSON.parse(buildBrief(plan, { words: ['我们'], wordsKnown: true, learning: ['东西'] }));
    assert.equal(brief.knownWords, '我们');
    assert.equal(brief.learningWords, '东西');
  });
});

describe('the pinyin a writing prompt asks for', () => {
  it('asks for a word’s syllables together and the words apart, since the reader finds the words by it', () => {
    const text = buildPrompt(plan, {});
    assert.match(text, /`wǒ de péngyou zài chī zǎofàn`, not `wǒ de péng you zài chī zǎo fàn`/);
    assert.match(text, /A name is one word/);
  });
});

describe('stories, speakers and scenes in the prompt', () => {
  const with_ = (patch: Partial<(typeof plan.specs)[number]>) => ({
    ...plan,
    specs: plan.specs.map((s, i) => (i === 0 ? { ...s, ...patch } : s)),
  });

  it('asks a dialogue for its speakers', () => {
    assert.match(buildPrompt(with_({ genre: 'dialogue' })), /"who"/);
  });

  it('explains the story shape only when a passage is a story with choices', () => {
    assert.doesNotMatch(buildPrompt(plan), /A story with choices/);
    const text = buildPrompt(with_({ genre: 'branching' }));
    assert.match(text, /## A story with choices/);
    assert.match(text, /"start": "a"/);
    assert.match(buildBrief(with_({ genre: 'branching' })), /"choices"/);
  });

  it('lists the photos and rooms a scene may use when a passage asks for pictures', () => {
    const text = buildPrompt(with_({ pictures: true }));
    assert.match(text, /## Scenes/);
    assert.match(text, /火车/);
    assert.match(text, /`classroom`/);
    assert.doesNotMatch(buildPrompt(plan), /## Scenes/);
  });
});
