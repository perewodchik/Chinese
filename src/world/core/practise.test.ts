import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { merge } from './merge';
import { readSave } from './migrate';
import { bestTeacher, buildRound, canPractise, isRight, knownIdioms, QUESTION_KINDS, saidRight, weakFirst } from './practise';
import { applyAll, newSave, WORLD_SAVE_VERSION, type SaveAction } from './save';
import type { Idiom, WorldSave } from './types';

const idiom = (id: string, pinyin: string, meaning: string, tier: Idiom['tier'] = 'basic'): Idiom => ({
  id,
  pinyin,
  parts: [...id].map((c) => ({ c, gloss: '' })),
  meaning,
  story: { zh: '', en: `The story of ${id}. More.` },
  tier,
});

const IDIOMS: Idiom[] = [
  idiom('一路平安', 'yí lù píng ān', 'have a safe journey'),
  idiom('马马虎虎', 'mǎ mǎ hū hū', 'so-so'),
  idiom('一举两得', 'yì jǔ liǎng dé', 'two birds with one stone'),
  idiom('画龙点睛', 'huà lóng diǎn jīng', 'the finishing touch', 'story'),
  idiom('百无禁忌', 'bǎi wú jìn jì', 'nothing is forbidden', 'story'),
  idiom('所向披靡', 'suǒ xiàng pī mǐ', 'sweeping all before one', 'story'),
  idiom('一念之间', 'yí niàn zhī jiān', 'in a single thought', 'story'),
];

/** a fixed "random" so a round is the same every run */
function seeded(seed = 1) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

const ctx = { now: 1 };
const heard = (ids: string[], npc?: string): WorldSave =>
  applyAll(
    newSave('d', 0),
    ids.map((idiom): SaveAction => ({ do: 'idiom', idiom })),
    { ...ctx, ...(npc ? { npc } : {}) },
  );

describe('成语 Practise (§10 P3)', () => {
  it('opens only once four 成语 are known, and asks only those', () => {
    const three = heard(['一路平安', '马马虎虎', '一举两得']);
    assert.equal(canPractise(three, IDIOMS), false);
    assert.deepEqual(buildRound(three, IDIOMS, seeded()), []);
    const four = heard(['一路平安', '马马虎虎', '一举两得', '画龙点睛']);
    assert.equal(canPractise(four, IDIOMS), true);
    const round = buildRound(four, IDIOMS, seeded());
    assert.equal(round.length, 4);
    const known = new Set(knownIdioms(four, IDIOMS).map((i) => i.id));
    for (const q of round) assert.ok(known.has(q.idiom.id), `${q.idiom.id} was never heard`);
  });

  it('every question with options has four distinct ones, the answer among them', () => {
    const s = heard(IDIOMS.slice(0, 5).map((i) => i.id));
    for (let seed = 1; seed < 40; seed++) {
      for (const q of buildRound(s, IDIOMS, seeded(seed))) {
        if (q.kind === 'say') {
          assert.deepEqual(q.options, []);
          continue;
        }
        assert.equal(q.options.length, 4, `${q.kind} ${q.idiom.id}`);
        assert.equal(new Set(q.options).size, 4);
        assert.ok(q.options.includes(q.answer));
        if (q.kind === 'gap') {
          assert.equal(q.answer, [...q.idiom.id][q.gap!]);
          // no other option would also fill the gap
          for (const o of q.options) if (o !== q.answer) assert.ok(![...q.idiom.id].includes(o));
        }
      }
    }
  });

  it('distractors come from the 成语 you know first', () => {
    const s = heard(IDIOMS.slice(0, 5).map((i) => i.id));
    const known = new Set(IDIOMS.slice(0, 5).map((i) => i.id));
    for (let seed = 1; seed < 20; seed++)
      for (const q of buildRound(s, IDIOMS, seeded(seed), { kinds: ['pick-idiom'] })) for (const o of q.options) assert.ok(known.has(o), `${o} is not known`);
  });

  it('mixes the kinds, and leaves out the ones asked to', () => {
    const s = heard(IDIOMS.map((i) => i.id));
    const kinds = new Set(buildRound(s, IDIOMS, seeded()).map((q) => q.kind));
    assert.equal(kinds.size, QUESTION_KINDS.length);
    const quiet = buildRound(s, IDIOMS, seeded(), { kinds: QUESTION_KINDS.filter((k) => k !== 'listen') });
    assert.ok(quiet.every((q) => q.kind !== 'listen'));
  });

  it('asks the weak ones first: never asked, then most missed, then longest ago', () => {
    let s = heard(['一路平安', '马马虎虎', '一举两得', '画龙点睛', '百无禁忌']);
    s = applyAll(
      s,
      [
        { do: 'practised', idiom: '一路平安', right: true },
        { do: 'practised', idiom: '一路平安', right: true },
        { do: 'practised', idiom: '马马虎虎', right: false },
        { do: 'practised', idiom: '一举两得', right: true },
        { do: 'practised', idiom: '画龙点睛', right: true },
      ],
      ctx,
    );
    assert.deepEqual(
      weakFirst(s, IDIOMS).map((i) => i.id),
      ['百无禁忌', '马马虎虎', '一举两得', '画龙点睛', '一路平安'],
    );
    assert.deepEqual(
      buildRound(s, IDIOMS, seeded(), { max: 2 }).map((q) => q.idiom.id),
      ['百无禁忌', '马马虎虎'],
    );
  });

  it('say it: the characters, the same sounds in other characters, or pinyin', () => {
    const x = IDIOMS[3]!;
    assert.ok(saidRight('画龙点睛', x));
    assert.ok(saidRight('画龙点睛！', x));
    assert.ok(saidRight('hua long dian jing', x));
    assert.ok(saidRight('hualongdianjing', x));
    assert.ok(saidRight('huà lóng diǎn jīng', x));
    assert.ok(!saidRight('画龙', x));
    assert.ok(!saidRight('', x));
    // the recogniser heard the sound in other characters
    const sounds = (zh: string) => (zh === '话笼点睛' ? ['hua', 'long', 'dian', 'jing'] : []);
    assert.ok(saidRight('话笼点睛', x, sounds));
    assert.ok(!saidRight('话笼点睛', x));
    assert.ok(isRight({ kind: 'say', idiom: x, answer: x.id, options: [] }, 'hua long dian jing'));
    assert.ok(!isRight({ kind: 'pick-idiom', idiom: x, answer: x.id, options: [] }, '一路平安'));
  });

  it('thanks the person who taught the most, the one met first on a tie', () => {
    let s = heard(['一路平安'], 'wang');
    s = applyAll(s, [{ do: 'meet', npc: 'wang' }, { do: 'meet', npc: 'zhao' }], ctx);
    s = applyAll(s, [{ do: 'idiom', idiom: '马马虎虎' }], { ...ctx, npc: 'zhao' });
    assert.equal(bestTeacher(s), 'wang');
    s = applyAll(s, [{ do: 'idiom', idiom: '一举两得' }], { ...ctx, npc: 'zhao' });
    assert.equal(bestTeacher(s), 'zhao');
    assert.equal(bestTeacher(heard(['一路平安'])), null);
  });

  it('counts are kept in the save, merged by the larger, and survive a reload (v12)', () => {
    const base = heard(['一路平安', '马马虎虎']);
    const ipad = applyAll(base, [{ do: 'practised', idiom: '一路平安', right: true }, { do: 'tick', minutes: base.clock + 60 }, { do: 'practised', idiom: '一路平安', right: false }], { now: 2, deviceId: 'ipad' });
    const mac = applyAll(base, [{ do: 'practised', idiom: '一路平安', right: true }, { do: 'practised', idiom: '一路平安', right: true }, { do: 'practised', idiom: '马马虎虎', right: false }], { now: 3, deviceId: 'mac' });
    assert.deepEqual(ipad.practised?.['一路平安'], { right: 1, wrong: 1, last: Math.floor(base.clock) + 60 });
    const both = merge(ipad, mac);
    assert.deepEqual(both.practised, {
      一路平安: { right: 2, wrong: 1, last: Math.floor(base.clock) + 60 },
      马马虎虎: { right: 0, wrong: 1, last: Math.floor(base.clock) },
    });
    assert.deepEqual(merge(mac, ipad), both);
    const r = readSave(JSON.parse(JSON.stringify(both)));
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.save.practised, both.practised);
  });

  it('an 11 save upgrades to 12 with nothing practised; a 12 save is refused by an 11 build', () => {
    assert.equal(WORLD_SAVE_VERSION, 12);
    const old = { ...JSON.parse(JSON.stringify(newSave('d', 0))), version: 11 };
    delete old.practised;
    const r = readSave(old);
    assert.ok(r.ok && r.upgraded);
    assert.equal(r.ok && r.save.version, 12);
    assert.equal(r.ok && r.save.practised, undefined);
    const junk = readSave({ ...old, version: 12, practised: { 一路平安: { right: 'x' }, 马马虎虎: { right: 1, wrong: 0, last: 5 } } });
    assert.deepEqual(junk.ok && junk.save.practised, { 马马虎虎: { right: 1, wrong: 0, last: 5 } });
    const newer = readSave({ version: 12 }, undefined, 11);
    assert.equal(newer.ok, false);
  });
});
