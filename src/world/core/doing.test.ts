import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { checkReferences } from './content';
import { libraryLexicon } from './dialogue/lexicon';
import { answerFor, ScriptedDialogue, WRONG_CHOICE } from './dialogue/scripted';
import type { Scene } from './types';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };

const dance: Scene = {
  id: 'dance',
  map: 'm',
  npc: 'auntie',
  trigger: 'talk',
  start: 'a',
  words: [{ w: '左', explain: '左边。', en: 'left' }],
  nodes: [
    { id: 'a', say: '左！', translate: 'Left!', choose: { options: [{ id: 'l', label: '⬅️', right: true }, { id: 'r', label: '➡️' }], go: 'b' } },
    { id: 'b', say: '写一个“大”字。', translate: 'Write 大.', trace: { chars: '大', go: 'c' } },
    { id: 'c', say: '好！', translate: 'Good!', onEnter: [{ do: 'flag', flag: 'danced' }] },
  ],
};

describe('doing what the line says (X8)', () => {
  const d = new ScriptedDialogue({ scenes: [dance], npcs: [] }, libraryLexicon(lib));

  it('the right pick moves on, the writing moves on, and the scene ends', () => {
    const t0 = d.start(dance);
    const t1 = d.reply(t0.state, { text: '', via: 'keyboard', choice: 'l' });
    assert.equal(t1.kind, 'match');
    assert.equal(t1.state.node, 'b');
    assert.ok(!t1.end, 'a writing line is not the end of the talk');
    const t2 = d.reply(t1.state, { text: '', via: 'keyboard', traced: true });
    assert.equal(t2.state.node, 'c');
    assert.ok(t2.end);
    assert.ok(t2.actions.some((a) => a.do === 'flag' && a.flag === 'danced'));
  });

  it('a wrong pick is "not that one", and from the second the right one is shown', () => {
    const t0 = d.start(dance);
    const w1 = d.reply(t0.state, { text: '', via: 'keyboard', choice: 'r' });
    assert.equal(w1.kind, 'wrong');
    assert.equal(w1.say?.zh, WRONG_CHOICE[0]!.zh);
    assert.equal(w1.state.hint, 0);
    const w2 = d.reply(w1.state, { text: '', via: 'keyboard', choice: 'r' });
    assert.equal(w2.state.hint, 3);
    assert.equal(w2.state.node, 'a');
  });

  it('words at a pick line: a question is answered, a tap does not skip it', () => {
    const t0 = d.start(dance);
    assert.equal(d.reply(t0.state, { text: '左是什么意思？', via: 'keyboard' }).kind, 'explain');
    assert.equal(d.reply(t0.state, { text: '你好', via: 'keyboard' }).kind, 'repeat');
    assert.equal(d.proceed(t0.state).state.node, 'a');
  });

  it('a patient player picks the right one', () => {
    assert.deepEqual(answerFor(dance.nodes[0]!), { text: '', via: 'keyboard', choice: 'l' });
    assert.deepEqual(answerFor(dance.nodes[1]!), { text: '', via: 'keyboard', traced: true });
  });

  it('the checker wants exactly one right option', () => {
    const bad = { ...dance, nodes: [{ ...dance.nodes[0]!, choose: { options: [{ id: 'l', label: '⬅️' }, { id: 'r', label: '➡️' }], go: 'b' } }, ...dance.nodes.slice(1)] };
    const c = { district: { id: 'x', name: 'x', en: 'x', chapter: 1, maps: [], stations: [], names: [] }, npcs: [], scenes: [bad], quests: [], spirits: [], idioms: [], stamps: [], items: [] };
    const errors = checkReferences(c as never, { npcs: ['auntie'] });
    assert.ok(errors.some((e: string) => /exactly one right option/.test(e)), errors.join('\n'));
  });
});
