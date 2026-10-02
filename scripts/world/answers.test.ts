import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { libraryLexicon } from '../../src/world/core/dialogue/lexicon';
import { ScriptedDialogue } from '../../src/world/core/dialogue/scripted';
import type { DialogueState } from '../../src/world/core/dialogue/source';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const lex = libraryLexicon(lib);
const content = checkContent('content/world', lib).districts;
const scenes = content.flatMap((d) => d.scenes);
const npcs = content.flatMap((d) => d.npcs);
const src = new ScriptedDialogue({ scenes, npcs, shops: content.flatMap((d) => d.shops ?? []), items: content.flatMap((d) => d.items) }, lex);
const free = new Set(npcs.filter((n) => n.free).map((n) => n.id));

const at = (scene: string, node: string): DialogueState => ({ scene, node, misses: 0, hint: 0, ended: false });

/** The learner, 2026-10-02: answers to tap instead of guessing what to type. */
describe('answers to tap', () => {
  it('every line that waits for words has answers, except a free-speech person’s', () => {
    const missing: string[] = [];
    for (const s of scenes)
      for (const n of s.nodes)
        if (n.expect?.length && !n.answers && !(s.npc && free.has(s.npc))) missing.push(`${s.id}/${n.id}`);
    assert.deepEqual(missing, []);
  });

  it('every right answer leads on; every wrong guess is a gentle 不对 that never moves on', () => {
    const bad: string[] = [];
    for (const s of scenes)
      for (const n of s.nodes) {
        if (!n.answers) continue;
        const state = at(s.id, n.id);
        const shown = src.answers(state);
        assert.equal(shown.length, n.answers.length, `${s.id}/${n.id}`);
        for (const a of shown) {
          const t = src.reply(state, { text: a.zh, via: 'keyboard' });
          if (a.wrong ? t.kind !== 'wrong' : t.kind !== 'match') bad.push(`${s.id}/${n.id} 「${a.zh}」 → ${t.kind}`);
        }
        // a riddle keeps a right answer among its guesses
        assert.ok(shown.some((a) => !a.wrong), `${s.id}/${n.id} has no right answer`);
      }
    assert.deepEqual(bad, []);
  });

  it('two wrong guesses open 兔儿爷’s hint and mark the way on — never locked', () => {
    const lion = at('lion-night', 'b');
    const t1 = src.reply(lion, { text: '是朋字。', via: 'keyboard' });
    assert.equal(t1.kind, 'wrong');
    assert.equal(t1.state.node, 'b');
    const t2 = src.reply(t1.state, { text: '是早字。', via: 'keyboard' });
    assert.equal(t2.state.hint, 1);
    assert.equal(t2.companion?.kind, 'hint');
    assert.equal(src.reply(t2.state, { text: '是明字。', via: 'keyboard' }).kind, 'match');
  });

  it('a free-speech person has none; you say it yourself', () => {
    const s = scenes.find((x) => x.npc && free.has(x.npc) && x.nodes.some((n) => n.expect?.length));
    assert.ok(s);
    const n = s.nodes.find((x) => x.expect?.length)!;
    assert.deepEqual(src.answers(at(s.id, n.id)), []);
  });

  it('the name in 「我叫{name}。」 is yours', () => {
    const shown = src.answers({ ...at('arrive', 'name'), name: '安娜' });
    assert.equal(shown[0]?.zh, '我叫安娜。');
  });
});
