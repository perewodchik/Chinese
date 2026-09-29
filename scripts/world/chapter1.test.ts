import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { libraryLexicon } from '../../src/world/core/dialogue/lexicon';
import { ScriptedDialogue, answerFor } from '../../src/world/core/dialogue/scripted';
import { activeQuests, advanceQuests } from '../../src/world/core/quests';
import { applyAll, newSave, type SaveAction } from '../../src/world/core/save';
import { autoScene, sceneFor } from '../../src/world/core/scenes';
import { board, fareOut, getOff, nextStop, runOn, startRide, trainsAt } from '../../src/world/core/ride';
import type { DialogueNode, WorldSave } from '../../src/world/core/types';
import { memoryLocal } from '../../src/world/sync/local';
import { hintWithName } from '../../src/world/core/voice';
import type { WorldGateway } from '../../src/world/sync/gateway';
import { WorldSync } from '../../src/world/sync/sync';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const lex = libraryLexicon(lib);
const content = checkContent('content/world', lib).districts;
const scenes = content.flatMap((d) => d.scenes);
const npcs = content.flatMap((d) => d.npcs);
const quests = content.flatMap((d) => d.quests);
const src = new ScriptedDialogue({ scenes, npcs, shops: content.flatMap((d) => d.shops ?? []), items: content.flatMap((d) => d.items) }, lex);

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
    if (node.order || node.bargain) {
      // a shop (Y1) or a stall's bargain (Y6): the given words, else the hint — order the first thing, then 不要了 to pay
      // at a shop: the given words, else what a patient player says — the first thing, 不要了, then the amount on the phone (Y2)
      const u = !t.state.due && answers[i] !== undefined ? { text: answers[i++]!, via: 'keyboard' as const } : src.answer(t.state)!;
      t = src.reply(t.state, u);
      assert.equal(t.kind === 'match' || t.kind === 'polite', true, `${sceneId}/${node.id}: “${u.text || u.paid}” was not taken (${t.kind})`);
    } else if (node.choose || node.trace) {
      // a pick or a written character (X8): the right one moves on
      t = src.reply(t.state, answerFor(node)!);
      assert.equal(t.kind, 'match', `${sceneId}/${node.id}: the right pick did not move the talk on (${t.kind})`);
    } else if (node.expect?.length) {
      const answer = answers[i++] ?? (node.hint ? hintWithName(node.hint, t.state.name ?? '').full : undefined);
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
    // an ordinary order now (Y1): a bun and a soy milk, 3 元 each
    s = play(s, 'breakfast', ['我要一个包子，一杯豆浆。', '不要了。']).save;
    assert.equal(s.bag.money, 194);
    assert.equal(s.bag.items.baozi, 1);
    assert.equal(s.bag.items.doujiang, 1);
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
    assert.equal(s.bag.money, 154);
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

  it('saying no to the card keeps the step and the offer: he sells it next time', () => {
    let s = act(newSave('d', 0), [{ do: 'quest', quest: 'ch1', step: 'card' }]);
    s = play(s, 'card', ['我要买交通卡', '不要']).save;
    assert.equal(s.bag.card, null);
    assert.equal(step(s), 'card');
    assert.ok(!('card' in s.stamps));
    assert.equal(sceneFor(scenes, s, { npc: 'station-staff' })?.id, 'card');
    s = play(s, 'card').save;
    assert.ok(s.flags.includes('has-card'));
    assert.equal(step(s), 'ride');
    assert.ok('card' in s.stamps);
  });

  it('the stone lion keeps still at night until you have heard the rumour, so the quest cannot skip it', () => {
    const night = { ...newSave('d', 0), clock: 20 * 60 };
    assert.equal(sceneFor(scenes, night, { look: 'stone-lion', map: 'gulou-square' })?.id, 'lion-still');
    const heard = act(night, [{ do: 'flag', flag: 'heard-lion' }]);
    assert.equal(sceneFor(scenes, heard, { look: 'stone-lion', map: 'gulou-square' })?.id, 'lion-night');

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
    assert.equal(s.bag.money, 900);
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

describe('chapter 4, played through the core', () => {
  it('天坛 → the Echo Wall whisper → 国子监 → the 麒麟 riddle', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 4 }, { do: 'quest', quest: 'ch4', step: 'go' }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch4')?.step.id;
    s = play(s, 'tiantan-arrive').save;
    s = play(s, 'erhu').save;
    assert.ok('对牛弹琴' in s.idioms);
    assert.equal(at(), 'echo');
    assert.equal(sceneFor(scenes, s, { look: 'wall-spot', map: 'huiyinbi' }), null);
    s = play(s, 'echo-boy').save;
    const wall = sceneFor(scenes, s, { look: 'wall-spot', map: 'huiyinbi' });
    assert.equal(wall?.id, 'wall-listen');
    const first = src.start(wall!, s);
    assert.equal(first.say?.listen, true);
    s = play(s, 'wall-listen').save;
    assert.equal(at(), 'go-gzj');
    s = play(s, 'gzj-arrive').save;
    s = play(s, 'frog').save;
    assert.ok('井底之蛙' in s.idioms);
    assert.equal(sceneFor(scenes, { ...s, clock: 10 * 60 }, { look: 'qilin', map: 'guozijian' })?.id, 'qilin-day');
    s = play({ ...s, clock: 18 * 60 }, 'qilin').save;
    assert.ok('qilin' in s.spirits);
    assert.equal(s.quests.ch4?.done, true);
    assert.equal(s.chapter, 5);
  });
});

describe('chapter 5, played through the core', () => {
  it('三里屯 → the courier → 国贸 bank → gold coins → 貔貅 → the Bird\'s Nest', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 5 }, { do: 'quest', quest: 'ch5', step: 'go' }, { do: 'money', amount: 100 }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch5')?.step.id;
    s = play(s, 'sanlitun-arrive').save;
    s = play(s, 'courier').save;
    assert.ok('半信半疑' in s.idioms);
    assert.equal(at(), 'guomao');
    s = play(s, 'guard').save;
    assert.ok('七上八下' in s.idioms);
    assert.equal(sceneFor(scenes, s, { look: 'pixiu', map: 'guomao-bank' })?.id, 'pixiu-ask');
    s = play(s, 'pixiu-ask').save;
    assert.equal(at(), 'gold');
    s = play(s, 'shop-bianlidian', ['我要一块金币巧克力。', '不要了。']).save;
    assert.equal(sceneFor(scenes, s, { look: 'pixiu', map: 'guomao-bank' })?.id, 'pixiu-give');
    s = play(s, 'pixiu-give').save;
    assert.ok('pixiu' in s.spirits);
    assert.equal(at(), 'olympic');
    s = play(s, 'olympic-arrive').save;
    assert.equal(s.quests.ch5?.done, true);
    assert.equal(s.chapter, 6);
  });

  it('a shop door opens its 点单 game', () => {
    const scene = scenes.find((x) => x.id === 'door-order-luckin')!;
    const t = src.reply(src.start(scene, newSave('d', 0)).state, { text: '好，我去。', via: 'keyboard' });
    assert.ok(t.actions.some((a) => a.do === 'game' && a.game === 'order-luckin'));
  });
});

describe('chapter 6, played through the core', () => {
  it('颐和园 → the rabbit painting → 潘家园 → bargaining for the 年兽', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 6 }, { do: 'quest', quest: 'ch6', step: 'go' }, { do: 'money', amount: 200 }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch6')?.step.id;
    s = play(s, 'yiheyuan-arrive').save;
    assert.equal(sceneFor(scenes, s, { look: 'painting-rabbit', map: 'yiheyuan-changlang' })?.id, 'painting-rabbit');
    s = play(s, 'painting-rabbit').save;
    assert.ok('守株待兔' in s.idioms);
    s = play(s, 'changlang-painter').save;
    assert.equal(at(), 'market');
    s = play(s, 'panjiayuan-arrive').save;
    s = play(s, 'lock').save;
    assert.ok('亡羊补牢' in s.idioms);
    const before = s.bag.money;
    s = play(s, 'bargain', ['这个年兽多少钱？', '太贵了！便宜点儿吧。', '一百吧。']).save;
    assert.equal(s.bag.money, before - 100);
    assert.ok('nianshou' in s.spirits);
    assert.equal(s.quests.ch6?.done, true);
    assert.equal(s.chapter, 7);
  });
});

describe('chapter 7, played through the core', () => {
  it('the ticket in your name → security → 太和殿 → 画龙点睛 → the garden', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 7 }, { do: 'quest', quest: 'ch7', step: 'ticket' }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'ch7')?.step.id;
    assert.equal(sceneFor(scenes, s, { npc: 'wang-ayi' })?.id, 'ticket');
    s = play(s, 'ticket').save;
    assert.ok(s.flags.includes('palace-ticket'));
    assert.equal(at(), 'anjian');
    s = play(s, 'anjian').save;
    s = play(s, 'taihedian-arrive').save;
    assert.equal(at(), 'dragon');
    assert.equal(sceneFor(scenes, s, { look: 'screen', map: 'jiulongbi' })?.id, 'dragon');
    s = play(s, 'dragon').save;
    assert.ok('long' in s.spirits);
    assert.ok('画龙点睛' in s.idioms);
    s = play(s, 'yuhuayuan-arrive').save;
    assert.equal(s.quests.ch7?.done, true);
    assert.equal(s.chapter, 8);
  });
});

describe('the epilogue, played through the core', () => {
  it('a train ticket in your name → the train → 愚公移山 → 一路平安', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 8 }, { do: 'quest', quest: 'epilogue', step: 'ticket' }]);
    const at = () => activeQuests(s, quests).find((a) => a.quest.id === 'epilogue')?.step.id;
    assert.equal(sceneFor(scenes, s, { look: 'train-board', map: 'stop-beijingbeizhan' })?.id, 'no-train-ticket');
    s = play(s, 'train-ticket').save;
    assert.equal(sceneFor(scenes, s, { look: 'train-board', map: 'stop-beijingbeizhan' }), null);
    assert.equal(at(), 'ride');
    let r = startRide('beijingbeizhan');
    r = board(r, trainsAt('beijingbeizhan', 'train')[0]!);
    while (r.at !== 'badalingchangcheng') r = runOn(r);
    assert.equal(fareOut(r, 'train'), 0);
    s = play(s, 'changcheng-arrive').save;
    s = play(s, 'yugong').save;
    assert.ok('愚公移山' in s.idioms);
    s = play(s, 'farewell').save;
    assert.ok('一路平安' in s.idioms);
    assert.equal(s.quests.epilogue?.done, true);
    assert.equal(s.chapter, 9);
  });
});

describe('every scene, and the side quests', () => {
  it('every scene in the city plays to its end with its own hints — no dead ends', () => {
    const rich = act(newSave('d', 0), [{ do: 'chapter', chapter: 9 }, { do: 'money', amount: 5000 }]);
    for (const sc of scenes) play(rich, sc.id);
  });

  it('赵爷爷\'s bird: 小明 has it', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 2 }]);
    assert.equal(sceneFor(scenes, s, { npc: 'zhao-yeye' })?.id, 'bird-lost');
    s = play(s, 'bird-lost').save;
    assert.equal(sceneFor(scenes, s, { npc: 'xiaoming' })?.id, 'bird-kid');
    s = play(s, 'bird-kid').save;
    assert.equal(sceneFor(scenes, s, { npc: 'zhao-yeye' })?.id, 'bird-back');
    s = play(s, 'bird-back').save;
    assert.equal(s.quests['side-bird']?.done, true);
  });

  it('bait for the fisherman, from 李阿姨\'s shop', () => {
    let s = act(newSave('d', 0), [{ do: 'chapter', chapter: 2 }, { do: 'flag', flag: 'heard-fox' }, { do: 'scene_done', scene: 'fisher-fox' }]);
    assert.equal(sceneFor(scenes, s, { npc: 'fisher-yeye' })?.id, 'bait-ask');
    s = play(s, 'bait-ask').save;
    assert.equal(sceneFor(scenes, s, { npc: 'li-ayi' })?.id, 'shop-li-ayi');
    s = play(s, 'shop-li-ayi', ['我要一包鱼饵。', '不要了。']).save;
    assert.equal(s.bag.items.yuer, 1);
    s = play(s, 'bait-give').save;
    assert.equal(s.quests['side-bait']?.done, true);
  });
});

describe('stress: odd input never breaks a conversation', () => {
  const scene = scenes.find((x) => x.id === 'arrive')!;
  const cases: Array<[string, string]> = [
    ['empty', ''],
    ['spaces', '    '],
    ['emoji', '😀🐰🏮'],
    ['very long', '你好'.repeat(3000)],
    ['latin gibberish', 'asdfghjkl qwerty'],
    ['punctuation', '？？？！！！……'],
    ['mixed', '你好 hello 😀 ni3hao3'],
  ];
  for (const [name, text] of cases) {
    it(`${name} input: an answer, the talk still open, the save untouched`, () => {
      const t0 = src.start(scene, newSave('d', 0));
      const t = src.reply(t0.state, { text, via: 'keyboard' });
      assert.ok(t.say === null || typeof t.say.zh === 'string');
      assert.equal(t.state.scene, 'arrive');
      assert.ok(!t.actions.some((a) => a.do === 'money' || a.do === 'give' || a.do === 'take'));
    });
  }

  it('a hundred wrong answers in a row: hints climb to the whole sentence and stay there', () => {
    let t = src.start(scene, newSave('d', 0));
    for (let i = 0; i < 100; i++) t = src.reply(t.state, { text: '苹果', via: 'keyboard' });
    assert.equal(t.companion?.kind, 'hint');
    assert.equal(t.companion?.kind === 'hint' && t.companion.step, 3);
  });
});
