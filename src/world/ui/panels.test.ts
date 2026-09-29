import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { districtInfo } from '../core/districts';
import { apply, applyAll, newSave } from '../core/save';
import type { Idiom, NpcCard, Quest, Scene, Stamp } from '../core/types';
import { giveTo } from '../core/gifts';
import { merge } from '../core/merge';
import { readSave } from '../core/migrate';
import { FIRST_MEMORY, markSeen, menuNews, panelTarget, remember, tabForKey, tabHasNews } from './menu';
import { BAG_FILTERS, bagRows, filterOf, friendRows, itemFacts, peopleRows, whereText, idiomRows, mapHint, riddleRows, stampRows, taskRows } from './panelRows';

const ctx = { now: 1 };
const fresh = () => newSave('d', 0);

const quests: Quest[] = [
  { id: 'arrive', title: 'A new home', chapter: 1, kind: 'main', steps: [{ id: 'meet', past: '', now: 'Say hello to 王阿姨.' }, { id: 'eat', past: '', now: 'Find breakfast.' }] },
  { id: 'done-one', title: 'Old', chapter: 1, kind: 'main', steps: [{ id: 'x', past: '', now: 'x' }] },
];
const scene: Scene = {
  id: 'rumour',
  map: 'm',
  npc: 'grandpa',
  trigger: 'talk',
  start: 'k',
  nodes: [{ id: 'k', say: '在城墙的西北角附近。', translate: 'Near the north-west corner of the wall.', key: true }],
};

describe('the panels', () => {
  it('lists quests under way with what now, then the finished ones', () => {
    const s = applyAll(fresh(), [{ do: 'quest', quest: 'arrive', step: 'eat' }, { do: 'quest_done', quest: 'done-one' }], { ...ctx, quests: new Map(quests.map((q) => [q.id, q])) });
    const rows = taskRows(s, quests);
    assert.deepEqual(rows.map((r) => [r.quest.id, r.done, r.now]), [
      ['arrive', false, 'Find breakfast.'],
      ['done-one', true, ''],
    ]);
  });

  it('shows pinned key lines with their text, unsolved first', () => {
    const s = applyAll(fresh(), [{ do: 'pin', riddle: 'rumour/k' }], ctx);
    assert.deepEqual(riddleRows(s, [scene]), [
      { id: 'rumour/k', zh: '在城墙的西北角附近。', en: 'Near the north-west corner of the wall.', solved: false, npc: 'grandpa' },
    ]);
    const solved = applyAll(s, [{ do: 'solve', riddle: 'rumour/k' }], ctx);
    assert.equal(riddleRows(solved, [scene])[0]?.solved, true);
  });

  it('the bag holds only what there is, with names', () => {
    const s = applyAll(fresh(), [{ do: 'give', item: 'baozi', count: 2 }, { do: 'give', item: 'x' }, { do: 'take', item: 'x' }], ctx);
    assert.deepEqual(bagRows(s, [{ id: 'baozi', name: '包子', en: 'steamed bun' }]), [{ id: 'baozi', name: '包子', en: 'steamed bun', count: 2 }]);
  });

  it('the map says the way, and asks for a 交通卡 first', () => {
    const s = { ...fresh(), district: 'gulou' };
    const to = districtInfo('tiananmen')!;
    const noCard = mapHint(s, to);
    assert.equal(noCard.kind, 'no-card');
    assert.match('text' in noCard ? noCard.text : '', /交通卡/);
    const withCard = mapHint({ ...s, bag: { ...s.bag, card: 20 } }, to);
    assert.equal(withCard.kind, 'route');
    assert.match('text' in withCard ? withCard.text : '', /天安门东/);
    assert.equal(mapHint(s, districtInfo('gulou')!).kind, 'here');
  });

  it('the 成语 book: plain ones before stories', () => {
    const idiom = (id: string, tier: Idiom['tier']): Idiom => ({ id, pinyin: '', parts: [{ c: id, gloss: '' }], meaning: '', story: { zh: '好', en: '' }, tier });
    const s = applyAll(fresh(), [{ do: 'idiom', idiom: '狐假虎威' }, { do: 'idiom', idiom: '马马虎虎' }], ctx);
    assert.deepEqual(idiomRows(s, [idiom('狐假虎威', 'story'), idiom('马马虎虎', 'basic')]).map((r) => r.idiom.id), ['马马虎虎', '狐假虎威']);
  });

  it('stamps: landmark seals first, the missing ones as frames', () => {
    const st = (id: string, landmark = false): Stamp => ({ id, name: id, en: id, place: 'p', design: id, ...(landmark ? { landmark } : {}) });
    const s = applyAll(fresh(), [{ do: 'stamp', stamp: 'ticket' }], ctx);
    assert.deepEqual(stampRows(s, [st('ticket'), st('鼓楼', true)]).map((r) => [r.stamp.id, r.got]), [
      ['鼓楼', false],
      ['ticket', true],
    ]);
  });

  it('lists the people met, warmest first, with what they remember (X2)', () => {
    const card = (id: string, name: string): NpcCard => ({ id, name, role: 'r', look: { sprite: 'x' }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {} });
    const s = applyAll(fresh(), [
      { do: 'meet', npc: 'wang' },
      { do: 'meet', npc: 'ghost' },
      { do: 'meet', npc: 'zhao' },
      { do: 'hearts', npc: 'zhao', delta: 2 },
      { do: 'remember', npc: 'zhao', note: 'brought his bird back' },
    ], ctx);
    const rows = friendRows(s, [card('wang', '王阿姨'), card('zhao', '赵爷爷')]);
    assert.deepEqual(rows.map((r) => [r.name, r.hearts, r.notes]), [
      ['赵爷爷', 2, ['brought his bird back']],
      ['王阿姨', 0, []],
    ]);
  });

  it('the bag sorts things under six filters, and its card says where they are sold and who liked them (Y5)', () => {
    assert.deepEqual(BAG_FILTERS.map((f) => f.label), ['全部', '食物', '礼物', '工具', '装饰', '重要']);
    assert.deepEqual((['food', 'drink', 'gift', 'toy', 'tool', 'decor', 'key', undefined] as const).map((kind) => filterOf({ id: 'x', name: 'x', en: 'x', ...(kind ? { kind } : {}) })), ['food', 'food', 'gift', 'gift', 'tool', 'decor', 'key', 'tool']);
    const hulu = { id: 'tanghulu', name: '糖葫芦', en: 'candied haws', kind: 'food' as const, gift: true, price: 10 };
    const wang: NpcCard = { id: 'wang', name: '王阿姨', role: '', look: { sprite: 'auntie' }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {}, likes: ['tanghulu'] };
    const zhao: NpcCard = { ...wang, id: 'zhao', name: '赵爷爷', likes: [], dislikes: ['tanghulu'] };
    const shops = [{ id: 's', npc: 'li', map: 'm', name: '李阿姨小卖部', stock: [{ item: 'tanghulu', price: 10, measure: '串' }] }];
    let s = applyAll(fresh(), [{ do: 'give', item: 'tanghulu', count: 2 }], ctx);
    assert.deepEqual(itemFacts(hulu, s, shops, [wang, zhao]), { sold: [{ shop: '李阿姨小卖部', price: 10, measure: '串' }], worth: 10, liked: [], disliked: [] });
    s = applyAll(s, giveTo(wang, hulu, s).actions, ctx);
    s = applyAll(s, giveTo(zhao, hulu, s).actions, ctx);
    const f = itemFacts(hulu, s, shops, [wang, zhao]);
    assert.deepEqual([f.liked, f.disliked], [['王阿姨'], ['赵爷爷']]);
  });
});

describe('the People tab (§10 P2)', () => {
  const card = (id: string, name: string, extra: Partial<NpcCard> = {}): NpcCard => ({ id, name, role: 'r', look: { sprite: id }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {}, ...extra });
  const zhao = card('zhao', '赵爷爷', { routine: [{ hours: [6, 9], map: 'gulou-square', tile: [1, 1] }, { hours: [9, 18], map: 'nanluo-main', tile: [1, 1] }], explains: { 鸟: '会飞的动物' } });
  const liu = card('liu', '老刘');
  const wang = card('wang', '王阿姨');
  const scenes: Scene[] = [{ ...scene, id: 'tea', map: 'chaguan', npc: 'liu' }];
  const hulu = { id: 'tanghulu', name: '糖葫芦', en: 'candied haws' };
  const qs: Quest[] = [{ id: 'bird', title: 'Bird', chapter: 1, kind: 'side', giver: 'zhao', blurb: 'b', steps: [{ id: 'a', now: 'a', past: 'a' }] }];
  const c = { npcs: [zhao, liu, wang], scenes, quests: qs, items: [hulu] };

  it('someone with a quest under way first, then the warmest; where each is at this hour', () => {
    let s = applyAll(fresh(), [{ do: 'meet', npc: 'wang' }, { do: 'meet', npc: 'liu' }, { do: 'meet', npc: 'zhao' }, { do: 'hearts', npc: 'liu', delta: 3 }], ctx);
    let rows = peopleRows(s, c);
    assert.deepEqual(rows.map((r) => r.id), ['liu', 'wang', 'zhao']);
    s = applyAll(s, [{ do: 'quest', quest: 'bird', step: 'a' }], ctx);
    rows = peopleRows(s, c);
    assert.deepEqual(rows.map((r) => [r.id, r.asking]), [['zhao', true], ['liu', false], ['wang', false]]);
    // 7:00 — 赵爷爷 is on the 鼓楼 square until 9; 老刘 is where people talk to him; 王阿姨 has no place known
    const name = (m: string) => m;
    assert.equal(whereText(rows[0]!, name), 'gulou-square · until 9:00');
    assert.equal(whereText(rows[1]!, name), 'chaguan');
    assert.equal(whereText(rows[2]!, name), 'somewhere in Beijing');
    const night = applyAll(s, [{ do: 'tick', minutes: 22 * 60 }], ctx);
    assert.equal(whereText(peopleRows(night, c)[0]!, name), 'not about now · usually at gulou-square from 6:00');
    assert.deepEqual(rows[0]!.topics, ['鸟']);
    assert.deepEqual(rows[0]!.quests.map((q) => [q.quest.id, q.done]), [['bird', false]]);
  });

  it('gift notes become likes, the rest stay what they remember; the 成语 they taught', () => {
    const s = applyAll(fresh(), [
      { do: 'meet', npc: 'liu' },
      { do: 'remember', npc: 'liu', note: 'likes 包子' },
      { do: 'remember', npc: 'liu', note: 'liked the candied haws you gave' },
    ], ctx);
    const withIdiom = apply(s, { do: 'idiom', idiom: '一心一意' }, { ...ctx, npc: 'liu' });
    const [r] = peopleRows(withIdiom, c);
    assert.deepEqual([r!.notes, r!.likes, r!.dislikes, r!.idioms], [['likes 包子'], ['糖葫芦'], [], ['一心一意']]);
  });
});

describe('the menu (§10 P1)', () => {
  it('maps every old panel id onto a tab and view', () => {
    assert.deepEqual(panelTarget('tasks'), { tab: 'journal', view: 'now' });
    assert.deepEqual(panelTarget('diary'), { tab: 'journal', view: 'diary' });
    assert.deepEqual(panelTarget('spirits'), { tab: 'collection', view: 'spirits' });
    assert.deepEqual(panelTarget('idioms'), { tab: 'collection', view: 'idioms' });
    assert.deepEqual(panelTarget('stamps'), { tab: 'collection', view: 'stamps' });
    assert.deepEqual(panelTarget('album'), { tab: 'collection', view: 'album' });
    assert.deepEqual(panelTarget('friends'), { tab: 'people' });
    assert.deepEqual(panelTarget('settings'), { tab: 'settings' });
    assert.deepEqual(panelTarget('bag'), { tab: 'bag' });
    assert.deepEqual(panelTarget('map'), { tab: 'map' });
  });

  it('reopens on the last tab and on each tab’s last view', () => {
    let mem = remember(FIRST_MEMORY, { tab: 'collection', view: 'stamps' });
    mem = remember(mem, { tab: 'bag' });
    mem = remember(mem, { tab: 'settings' });
    assert.deepEqual(panelTarget('menu', mem), { tab: 'bag' });
    assert.deepEqual(panelTarget('collection', mem), { tab: 'collection', view: 'stamps' });
    assert.deepEqual(panelTarget('journal', mem), { tab: 'journal', view: 'now' });
    assert.deepEqual(panelTarget('menu'), { tab: 'journal', view: 'now' });
    // an unknown remembered view falls back to the first
    assert.deepEqual(panelTarget('journal', { tab: 'journal', views: { journal: 'nope' } }), { tab: 'journal', view: 'now' });
    assert.equal(remember(mem, { tab: 'bag' }), mem);
  });

  it('keys 1–5 are the tabs in order', () => {
    assert.deepEqual(['1', '2', '3', '4', '5', '6', 'a'].map(tabForKey), ['journal', 'bag', 'map', 'people', 'collection', null, null]);
  });

  it('dots news until the view is opened, then clears it', () => {
    let s = applyAll(fresh(), [{ do: 'idiom', idiom: '马马虎虎' }, { do: 'stamp', stamp: 'st' }], ctx);
    let news = menuNews(s);
    assert.ok(news.has('collection/idioms') && news.has('collection/stamps'));
    assert.ok(tabHasNews(news, 'collection') && !tabHasNews(news, 'bag'));
    s = applyAll(s, markSeen(s, { tab: 'collection', view: 'idioms' }), ctx);
    news = menuNews(s);
    assert.ok(!news.has('collection/idioms') && news.has('collection/stamps'));
    // later news dots it again
    s = applyAll(s, [{ do: 'tick', minutes: s.clock + 30 }, { do: 'idiom', idiom: '一心一意' }], ctx);
    assert.ok(menuNews(s).has('collection/idioms'));
  });

  it('dots a lead until the journal is opened', () => {
    let s = fresh();
    assert.ok(menuNews(s, ['side-kite']).has('journal/now'));
    s = applyAll(s, markSeen(s, { tab: 'journal', view: 'now' }, ['side-kite']), ctx);
    assert.ok(!menuNews(s, ['side-kite']).has('journal/now'));
    assert.ok(menuNews(s, ['side-kite', 'side-bird']).has('journal/now'));
  });

  it('merges seen markers by the later minute, and keeps them through a reload', () => {
    const a = applyAll(fresh(), [{ do: 'seen', key: 'journal/now', at: 500 }, { do: 'seen', key: 'people', at: 10 }], ctx);
    const b = applyAll(newSave('e', 0), [{ do: 'seen', key: 'journal/now', at: 400 }, { do: 'seen', key: 'bag', at: 7 }], ctx);
    assert.deepEqual(merge(a, b).seen, { bag: 7, 'journal/now': 500, people: 10 });
    assert.deepEqual(merge(b, a).seen, merge(a, b).seen);
    const back = readSave(JSON.parse(JSON.stringify(a)));
    assert.ok(back.ok);
    assert.deepEqual(back.save.seen, a.seen);
  });
});
