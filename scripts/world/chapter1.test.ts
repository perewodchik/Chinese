import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { libraryLexicon } from '../../src/world/core/dialogue/lexicon';
import { ScriptedDialogue } from '../../src/world/core/dialogue/scripted';
import { activeQuests, advanceQuests } from '../../src/world/core/quests';
import { applyAll, newSave, type SaveAction } from '../../src/world/core/save';
import { autoScene, sceneFor } from '../../src/world/core/scenes';
import { board, fareOut, getOff, nextStop, runOn, startRide, trainsAt } from '../../src/world/core/ride';
import type { DialogueNode, WorldSave } from '../../src/world/core/types';
import { memoryLocal } from '../../src/world/sync/local';
import type { WorldGateway } from '../../src/world/sync/gateway';
import { WorldSync } from '../../src/world/sync/sync';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const lex = libraryLexicon(lib);
const content = checkContent('content/world', lib).districts;
const scenes = content.flatMap((d) => d.scenes);
const npcs = content.flatMap((d) => d.npcs);
const quests = content.flatMap((d) => d.quests);
const src = new ScriptedDialogue({ scenes, npcs }, lex);

/** Applies a turn's actions the way the page does: the save, then quests move on. */
function act(s: WorldSave, actions: readonly SaveAction[]): WorldSave {
  const ctx = { now: 1, quests: new Map(quests.map((q) => [q.id, q])) };
  return advanceQuests(applyAll(s, actions, ctx), quests, ctx);
}

/**
 * Plays one scene to its end. At each line that expects an answer it says
 * `answers[i]` if given, else the node's hint — the full sentence the
 * companion offers at the third step — which must move the talk on.
 */
function play(s: WorldSave, sceneId: string, answers: string[] = []): { save: WorldSave; said: string[] } {
  const scene = scenes.find((x) => x.id === sceneId);
  assert.ok(scene, `no scene ${sceneId}`);
  let t = src.start(scene, s);
  let save = act(s, t.actions);
  const said = [t.say?.zh ?? ''];
  for (let i = 0, guard = 0; !t.state.ended && guard < 30; guard++) {
    const node: DialogueNode = scene.nodes.find((n) => n.id === t.state.node)!;
    if (node.expect?.length) {
      const answer = answers[i++] ?? node.hint?.full;
      assert.ok(answer, `${sceneId}/${node.id} expects an answer and gives no hint`);
      t = src.reply(t.state, { text: answer, via: 'keyboard' });
      assert.equal(t.kind, 'match', `${sceneId}/${node.id}: “${answer}” did not move the talk on (${t.kind})`);
    } else t = src.proceed(t.state);
    save = act(save, t.actions);
    if (t.say) said.push(t.say.zh);
  }
  assert.ok(t.state.ended, `${sceneId} never ended`);
  return { save, said };
}

const step = (s: WorldSave) => activeQuests(s, quests).find((a) => a.quest.id === 'ch1')?.step.id;

describe('chapter 1, played through the core', () => {
  it('from the first morning to the 交通卡, every step reachable with the hints', () => {
    let s = newSave('d', 0);
    assert.equal(autoScene(scenes, s, 'siheyuan-room')?.id, 'first-morning');
    s = play(s, 'first-morning').save;
    assert.equal(step(s), 'meet-wang');

    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'arrive');
    s = play(s, 'arrive').save;
    assert.equal(step(s), 'breakfast');
    assert.ok('new-home' in s.stamps);
    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'wang-go-eat');

    assert.equal(sceneFor(scenes, s, { npc: 'zaodian-shifu' })?.id, 'breakfast');
    s = play(s, 'breakfast').save;
    assert.equal(s.bag.money, 46);
    assert.equal(s.bag.items.baozi, 1);
    assert.equal(step(s), 'lantern');

    assert.equal(sceneFor(scenes, s, { look: 'old-lantern', map: 'siheyuan-yard' })?.id, 'lantern');
    s = play(s, 'lantern').save;
    assert.ok(s.flags.includes('lantern-broken'));
    assert.equal(s.riddles['lantern/d']?.solved, false);
    assert.equal(step(s), 'rumour');

    // the teahouse: the rumour, then a rest until evening
    assert.equal(sceneFor(scenes, s, { npc: 'lao-liu' })?.id, 'rumour-tea');
    s = play(s, 'rumour-tea').save;
    assert.equal(step(s), 'lion');
    assert.equal(Math.floor(s.clock / 60) % 24, 19);

    // by day the lion sleeps; after dark it asks its riddle
    assert.equal(sceneFor(scenes, { ...s, clock: 12 * 60 }, { look: 'stone-lion', map: 'gulou-square' })?.id, 'lion-day');
    assert.equal(sceneFor(scenes, s, { look: 'stone-lion', map: 'gulou-square' })?.id, 'lion-night');
    s = play(s, 'lion-night').save;
    assert.ok('shishizi' in s.spirits);
    assert.ok('shishizi' in s.stamps);
    assert.equal(s.riddles['lantern/d']?.solved, true);
    assert.equal(step(s), 'card');

    assert.equal(sceneFor(scenes, s, { npc: 'station-staff' })?.id, 'card');
    s = play(s, 'card').save;
    assert.equal(s.bag.card, 20);
    assert.equal(s.bag.money, 6);
    assert.equal(step(s), 'ride');
    assert.ok(s.flags.includes('has-card'));

    // the gates let you through with the card; the ride as the page plays it
    assert.equal(sceneFor(scenes, s, { look: 'gates-in', map: 'station-nanluoguxiang' })?.id, 'nlgx-gates-in');
    s = play(s, 'nlgx-gates-in').save;
    let r = startRide('nanluoguxiang');
    r = board(r, trainsAt('nanluoguxiang').find((t) => t.line === 'l8' && t.dir === 1)!);
    while (r.at !== 'wangfujing') r = runOn(r);
    r = getOff(r);
    r = runOn(board(r, trainsAt('wangfujing').find((t) => t.line === 'l1' && nextStop('l1', 'wangfujing', t.dir) === 'tiananmendong')!));
    s = act(s, [{ do: 'card', amount: -fareOut(r) }, { do: 'station', station: r.at }]);
    assert.equal(s.bag.card, 17);
    assert.deepEqual(activeQuests(s, quests).map((a) => a.quest.id), ['ch2']);
    assert.equal(s.quests.ch1?.done, true);
    assert.equal(s.chapter, 2);

    s = play(s, 'first-ride').save;
    s = play(s, 'tam-arrive').save;
    s = play(s, 'tam-guard').save;
    assert.ok(s.flags.includes('palace-needs-ticket'));
    assert.ok('subway' in s.stamps && 'tiananmen' in s.stamps);
  });

  it('without a card the gates say so', () => {
    assert.equal(sceneFor(scenes, newSave('d', 0), { look: 'gates-in', map: 'station-nanluoguxiang' })?.id, 'nlgx-gates-nocard');

  });

  it('saved on the iPad after the chapter, opened on the Mac in a fresh profile: the same place and progress', async () => {
    let stored: unknown = null;
    let revision = 0;
    const server: WorldGateway = {
      load: async () => ({ revision, save: stored, updatedAt: revision ? 1 : null }),
      save: async (base, save) => {
        if (base !== revision) return { kind: 'conflict', current: { revision, save: stored, updatedAt: 1 } };
        revision++;
        stored = JSON.parse(JSON.stringify(save));
        return { kind: 'saved', revision };
      },
    };
    const ipad = new WorldSync({ gateway: server, local: memoryLocal(), deviceId: 'ipad' });
    const start = await ipad.open();
    let s = start;
    for (const id of ['first-morning', 'arrive', 'breakfast', 'lantern', 'rumour-tea', 'lion-night', 'card']) s = play(s, id).save;
    s = act(s, [{ do: 'enter', map: 'station-nanluoguxiang', tile: [8, 11], facing: 'down', district: 'gulou' }]);
    ipad.update(s, 'important');
    await ipad.flush();
    ipad.dispose();

    const mac = new WorldSync({ gateway: server, local: memoryLocal(), deviceId: 'mac' });
    const there = await mac.open();
    mac.dispose();
    assert.deepEqual(there.place, s.place);
    assert.deepEqual(there.quests, s.quests);
    assert.deepEqual(there.spirits, s.spirits);
    assert.deepEqual(there.stamps, s.stamps);
    assert.equal(there.bag.card, 20);
  });

  it('the corner shop tells the rumour too, and sells water', () => {
    let s = act(newSave('d', 0), [{ do: 'flag', flag: 'lantern-broken' }]);
    s = play(s, 'rumour-shop', ['我要买水', '你看见什么了？']).save;
    assert.ok(s.flags.includes('heard-lion'));
    assert.equal(s.bag.items.water, 1);
  });

  it('the idioms: 一心一意 over tea, 马马虎虎 at the barber', () => {
    let s = newSave('d', 0);
    s = play(s, 'tea').save;
    s = play(s, 'barber').save;
    assert.deepEqual(Object.keys(s.idioms).sort(), ['一心一意', '马马虎虎'].sort());
  });

  it('asking the way, both ways, and sleep', () => {
    const s = newSave('d', 0);
    assert.match(play(s, 'ask-way', ['很好看！', '请问，鼓楼在哪儿？']).said.join(''), /西边/);
    assert.match(play(s, 'ask-way', ['地铁站在哪儿？']).said.join(''), /东边/);
    const slept = play({ ...s, clock: 22 * 60 }, 'bed').save;
    assert.equal(slept.clock, 24 * 60 + 7 * 60);
  });
});

describe('chapter 2, played through the core', () => {
  it('后海 → the fisherman → 景山 → the fox at the corner tower', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 2 }, { do: 'quest', quest: 'ch2', step: 'go-houhai' }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch2')?.step.id;
    assert.equal(autoScene(scenes, s, 'houhai-lake')?.id, 'houhai-arrive');
    s = play(s, 'houhai-arrive').save;
    assert.equal(at(), 'rumour');
    assert.equal(sceneFor(scenes, s, { npc: 'fisher-yeye' })?.id, 'fisher-fox');
    s = play(s, 'fisher-fox').save;
    assert.equal(at(), 'jingshan');
    s = play(s, 'beihai-arrive').save;
    assert.equal(sceneFor(scenes, s, { look: 'view', map: 'jingshan-view' })?.id, 'jingshan-view');
    s = play(s, 'jingshan-view').save;
    assert.equal(sceneFor(scenes, s, { npc: 'jingshan-yeye' })?.id, 'singer');
    s = play(s, 'singer').save;
    assert.equal(at(), 'fox');
    s = play(s, 'bench').save;
    assert.equal(Math.floor(s.clock / 60) % 24, 19);
    assert.equal(sceneFor(scenes, s, { look: 'fox', map: 'jiaolou' })?.id, 'fox');
    s = play(s, 'fox').save;
    assert.ok('jiuweihu' in s.spirits);
    assert.ok('狐假虎威' in s.idioms);
    assert.equal(s.quests.ch2?.done, true);
    assert.equal(s.chapter, 3);
    for (const st of ['houhai', 'baita', 'jingshan', 'jiuweihu']) assert.ok(st in s.stamps, st);
  });

  it('chapter 1 hands over to chapter 2', () => {
    const ch1 = quests.find((q) => q.id === 'ch1')!;
    assert.ok(ch1.reward?.some((a) => a.do === 'quest' && a.quest === 'ch2'));
  });
});

describe('chapter 3, played through the core', () => {
  it('王府井: the bank, the 成语 book; 前门: the opera, the door gods', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 3 }, { do: 'quest', quest: 'ch3', step: 'go' }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch3')?.step.id;
    s = play(s, 'wfj-arrive').save;
    assert.ok('人山人海' in s.idioms);
    assert.equal(at(), 'money');
    s = play(s, 'bank').save;
    assert.equal(s.bag.money, 750);
    assert.equal(at(), 'book');
    s = play(s, 'book').save;
    assert.ok(s.flags.includes('idiom-book'));
    assert.equal(at(), 'qianmen');
    s = play(s, 'qm-arrive').save;
    s = play(s, 'opera').save;
    assert.equal(at(), 'red-paper');
    assert.equal(sceneFor(scenes, s, { look: 'door-gods', map: 'qianmen-street' })?.id, 'menshen-ask');
    assert.equal(sceneFor(scenes, s, { npc: 'shudian-ayi' })?.id, 'red-paper');
    s = play(s, 'red-paper').save;
    assert.equal(at(), 'menshen');
    assert.equal(sceneFor(scenes, s, { look: 'door-gods', map: 'qianmen-street' })?.id, 'menshen-give');
    s = play(s, 'menshen-give').save;
    assert.ok('menshen' in s.spirits);
    assert.ok('画蛇添足' in s.idioms);
    assert.equal(s.bag.items.hongzhi ?? 0, 0);
    assert.equal(s.quests.ch3?.done, true);
    assert.equal(s.chapter, 4);
  });

  it("王阿姨's cold: medicine from the pharmacy", () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 3 }]);
    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'wang-cold');
    s = play(s, 'wang-cold').save;
    s = play(s, 'pharmacy').save;
    assert.equal(s.bag.items.ganmaoyao, 1);
    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'wang-medicine');
    s = play(s, 'wang-medicine').save;
    assert.equal(s.quests['wang-cold']?.done, true);
  });
});
