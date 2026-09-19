import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { withoutTone } from '../drill';
import { bestHeard, compareHeard, describeMiss } from './heard';
import { SOUND_LESSONS } from './sounds';
import { parseSyllable, syllables } from './syllable';

interface Entry {
  c: string;
  py: string[];
  words: Array<{ w: string; p: string }>;
}

const data = JSON.parse(readFileSync(new URL('../../../public/data/characters.json', import.meta.url), 'utf8')) as {
  items: Entry[];
};
const byChar = new Map(data.items.map((e) => [e.c, e]));
const readings = (ch: string) => byChar.get(ch)?.py ?? [];

/**
 * A character's readings, including the ones only its words show: the
 * dictionary gives 乐 as lè alone, while 音乐 is yīn yuè.
 */
const bare = (py: string) => withoutTone(py).toLowerCase();
const known = new Map<string, Set<string>>();
for (const e of data.items) {
  for (const r of e.py) (known.get(e.c) ?? known.set(e.c, new Set()).get(e.c)!).add(bare(r));
  for (const w of e.words) {
    const syl = w.p.split(/\s+/);
    if (syl.length !== [...w.w].length) continue;
    [...w.w].forEach((ch, i) => (known.get(ch) ?? known.set(ch, new Set()).get(ch)!).add(bare(syl[i]!)));
  }
}

describe('the sound lessons', () => {
  const words = SOUND_LESSONS.flatMap((l) => [
    ...l.words,
    ...l.notes.map((n) => n.example),
    ...l.pairs.flatMap((p) => [p.a, p.b]),
  ]);

  it('give one syllable per character', () => {
    for (const w of words) assert.equal(syllables(w.reading).length, [...w.word].length, w.word);
  });

  // A typo in a reading would teach the wrong sound with total confidence, so
  // every character the library knows is checked against it (tone aside, since
  // 一 and 不 are written here as they are said).
  it('spell every known character the way the dictionary does', () => {
    for (const w of words) {
      const syl = syllables(w.reading);
      [...w.word].forEach((ch, i) => {
        const has = known.get(ch);
        if (has) assert.ok(has.has(syl[i]!.bare), `${ch} read ${syl[i]!.py}, library has ${[...has]}`);
      });
    }
  });

  it('pair words that differ in sound and share a tone', () => {
    for (const l of SOUND_LESSONS) {
      for (const p of l.pairs) {
        const a = parseSyllable(p.a.reading);
        const b = parseSyllable(p.b.reading);
        assert.ok(a.initial !== b.initial || a.final !== b.final, `${p.a.word}/${p.b.word} sound the same`);
        assert.equal(a.tone, b.tone, `${p.a.word}/${p.b.word} differ in tone too`);
      }
    }
  });
});

describe('what recognition heard', () => {
  it('counts a homophone as heard right', () => {
    const r = compareHeard('shì', '事', readings);
    assert.ok(r.clean);
  });

  it('names the sound that went wrong', () => {
    const r = compareHeard('qǐ chuáng', '吃床', readings);
    assert.deepEqual(r.syllables[0]!.off, ['initial']);
    assert.equal(describeMiss(r.syllables[0]!), 'q heard as ch');
    assert.deepEqual(r.syllables[1]!.off, []);
    assert.ok(!r.clean);
  });

  it('ignores punctuation, and takes the closest reading of a many-reading character', () => {
    assert.ok(compareHeard('jué de', '觉得。', readings).clean);
  });

  it('picks the closest of several alternatives', () => {
    const r = bestHeard('xīn qíng', ['星星', '心情'], readings)!;
    assert.ok(r.clean);
  });

  it('marks a -n heard as -ng on the final', () => {
    const r = compareHeard('xīn', '星', readings);
    assert.deepEqual(r.syllables[0]!.off, ['final']);
  });
});
