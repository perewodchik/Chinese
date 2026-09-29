import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLeveler } from './budget';
import { libraryLexicon } from './dialogue/lexicon';
import { ScriptedDialogue } from './dialogue/scripted';
import { holds } from './flags';
import { readSave } from './migrate';
import { merge } from './merge';
import { STICKER_REPLY, STICKERS, subjectsIn } from './photo';
import { applyAll, newSave } from './save';
import type { MapObject, Scene } from './types';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
const ctx = { now: 1 };

const objects: MapObject[] = [
  { kind: 'prop', id: 'drum-tower', tile: [3, 11], frame: 'tower/drum', blocks: [5, 3] },
  { kind: 'npc', id: 'n1', npc: 'zhao-yeye', tile: [12, 12] },
  { kind: 'sign', id: 'plate', tile: [30, 4], text: '厕所' },
];

describe('photos (X6)', () => {
  it('a photo shows what lies inside the frame', () => {
    assert.deepEqual(subjectsIn(objects, 'gulou-square', { x: 0, y: 5, w: 14, h: 10 }), ['gulou-square:drum-tower', 'npc:zhao-yeye']);
    assert.deepEqual(subjectsIn(objects, 'gulou-square', { x: 6, y: 0, w: 4, h: 4 }), []);
    // a tall tower counts when only its top is in the frame
    assert.deepEqual(subjectsIn(objects, 'gulou-square', { x: 4, y: 8, w: 2, h: 2 }), ['gulou-square:drum-tower']);
  });

  it('the save remembers what was photographed; photo tasks and the diary see it', () => {
    let s = applyAll(newSave('d', 0), [{ do: 'photo', subjects: ['gulou-square:drum-tower'] }, { do: 'photo', subjects: ['gulou-square:drum-tower'] }], ctx);
    assert.deepEqual(s.photos, ['gulou-square:drum-tower']);
    assert.ok(holds({ photo: 'gulou-square:drum-tower' }, s));
    assert.ok(s.diary['1']?.includes('p'));
    s = applyAll(s, [{ do: 'photo', subjects: [] }], ctx);
    assert.deepEqual(s.photos, ['gulou-square:drum-tower']);
  });

  it('a version 5 save gains an empty list; two devices keep both lists', () => {
    const r = readSave({ ...newSave('d', 0), version: 5, photos: undefined });
    assert.ok(r.ok && r.save.photos.length === 0);
    const a = { ...newSave('a', 0), photos: ['x:1'] };
    const b = { ...newSave('b', 0), photos: ['y:2'] };
    assert.deepEqual(merge(a, b).photos, ['x:1', 'y:2']);
  });
});

describe('stickers (X6)', () => {
  const scene: Scene = {
    id: 'ask',
    map: 'm',
    npc: 'li',
    trigger: 'talk',
    start: 'a',
    nodes: [
      { id: 'a', say: '要雨伞吗？', translate: '', expect: [{ intent: 'yes', match: [['好', '要']], go: 'b' }], hint: { word: '要', frame: '___', full: '要。' } },
      { id: 'b', say: '好，给你。', translate: '' },
    ],
  };
  const d = new ScriptedDialogue({ scenes: [scene], npcs: [] }, libraryLexicon(lib));

  it('a sticker means its word', () => {
    const t = d.reply(d.start(scene).state, { text: '', via: 'keyboard', sticker: 'ok' });
    assert.equal(t.kind, 'match');
    assert.equal(t.intent, 'yes');
  });

  it('one that fits nothing gets a smile, never a miss', () => {
    const s0 = d.start(scene).state;
    const t = d.reply(s0, { text: '', via: 'keyboard', sticker: 'love' });
    assert.equal(t.say?.zh, STICKER_REPLY.zh);
    assert.equal(t.state.misses, 0);
    assert.equal(d.reply(s0, { text: '', via: 'keyboard', sticker: 'thanks' }).intent, 'thanks');
  });

  it('the reply is HSK 1 and every sticker has a word', () => {
    const hard = libraryLeveler(lib)(STICKER_REPLY.zh, new Set()).filter((w) => w.level !== 1);
    assert.deepEqual(hard.map((w) => w.w), []);
    for (const s of STICKERS) assert.ok(s.says && s.en);
  });
});
