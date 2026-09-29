import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { GARMENT_ART } from '../art/hero';
import { checkClothes, oneEn, oneZh, paletteOf, parseClothes } from './clothes';
import { diaryLines } from './diary';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave, WORLD_SAVE_VERSION, type SaveAction } from './save';
import { DEFAULT_LOOK, DEFAULT_OUTFIT, DEFAULT_WARDROBE, type HeroLook } from './wardrobe';

const ctx = { now: 1 };
const names = { npc: () => undefined, item: () => undefined, spirit: () => undefined };
const today = (s: ReturnType<typeof newSave>) => Object.values(s.diary).flat();

const buy = (id: string, zh: string, en: string, wear = false): SaveAction => ({ do: 'buy_clothes', id, slot: id.startsWith('qipao') ? 'top' : 'hat', price: 100, wear, zh, en });

describe('the wardrobe in the save (W2)', () => {
  it('a new game arrives in today’s clothes, the creator not yet seen', () => {
    const s = newSave('d', 0);
    assert.equal(s.version, WORLD_SAVE_VERSION);
    assert.deepEqual(s.look, DEFAULT_LOOK);
    assert.deepEqual(s.outfit, DEFAULT_OUTFIT);
    assert.deepEqual(s.wardrobe, [...DEFAULT_WARDROBE]);
    assert.deepEqual(s.outfits, [null, null, null]);
    assert.equal(s.created, false);
  });

  it('an old save (every golden one) upgrades with today’s hero as its look, wardrobe and outfit', () => {
    for (const f of ['chapter-1', 'chapter-2']) {
      const raw = JSON.parse(readFileSync(`content/world/test-saves/${f}.json`, 'utf8'));
      assert.ok(raw.version < 10, `${f} is an old save`);
      const r = readSave(raw);
      assert.ok(r.ok, r.ok ? '' : r.message);
      assert.equal(r.save.version, WORLD_SAVE_VERSION);
      assert.deepEqual(r.save.look, DEFAULT_LOOK);
      assert.deepEqual(r.save.outfit, DEFAULT_OUTFIT);
      assert.deepEqual(r.save.wardrobe, [...DEFAULT_WARDROBE]);
      assert.equal(r.save.created, false);
      assert.deepEqual(r.save.worn.sort(), ['jacket', 'scarf', 'sneakers', 'trousers']);
    }
  });

  it('a version 10 save (the journal’s) takes the same step; junk in the fields falls back to the defaults', () => {
    const v10 = { ...newSave('d', 0), version: 10, look: { build: 'huge' }, outfit: 7, wardrobe: 'x' } as unknown;
    const r = readSave(v10);
    assert.ok(r.ok);
    assert.deepEqual(r.save.look, DEFAULT_LOOK);
    assert.deepEqual(r.save.outfit, DEFAULT_OUTFIT);
  });

  it('the creator’s choices round-trip through the save', () => {
    const look: HeroLook = { build: 'slim', skin: 4, face: { eyes: 'round', brows: 'thick', mouth: 'smile' }, hair: { style: 'buns', colour: 'red' }, address: '姑娘' };
    const s = applyAll(newSave('d', 0), [{ do: 'create', look }], ctx);
    assert.equal(s.created, true);
    const back = readSave(JSON.parse(JSON.stringify(s)));
    assert.ok(back.ok);
    assert.deepEqual(back.save.look, look);
    assert.equal(back.save.created, true);
    // a look that is not in the catalogue is refused
    const bad = applyAll(newSave('d', 0), [{ do: 'create', look: { ...look, skin: 9 } }], ctx);
    assert.equal(bad.created, false);
  });

  it('wear only what you own; a top and a bottom stay on, a hat and a scarf come off', () => {
    let s = newSave('d', 0);
    s = applyAll(s, [{ do: 'wear', slot: 'top', id: 'qipao:red' }], ctx);
    assert.equal(s.outfit.top, 'jacket:blue');
    s = applyAll(s, [{ do: 'take_off', slot: 'top' }, { do: 'take_off', slot: 'accessory' }], ctx);
    assert.equal(s.outfit.top, 'jacket:blue');
    assert.equal(s.outfit.accessory, undefined);
    s = applyAll(s, [{ do: 'wear', slot: 'accessory', id: 'scarf:red' }], ctx);
    assert.equal(s.outfit.accessory, 'scarf:red');
  });

  it('buying at a rack puts it in the wardrobe (on at once with 穿着走), and the diary says so', () => {
    let s = newSave('d', 0);
    s = applyAll(s, [buy('qipao:red', '一件红旗袍', 'a red qipao', true)], ctx);
    assert.ok(s.wardrobe.includes('qipao:red'));
    assert.equal(s.outfit.top, 'qipao:red');
    s = applyAll(s, [buy('beanie:grey', '一顶毛线帽', 'a beanie')], ctx);
    assert.equal(s.outfit.hat, undefined);
    assert.deepEqual(
      diaryLines(today(s), names).map((l) => l.zh),
      ['我买了一件红旗袍。', '我买了一顶毛线帽。'],
    );
    // buying the same thing again adds nothing to the diary
    const again = applyAll(s, [buy('beanie:grey', '一顶毛线帽', 'a beanie')], ctx);
    assert.equal(today(again).length, today(s).length);
  });

  it('the first time a thing is worn the diary says 「今天我穿了……」, once', () => {
    let s = applyAll(newSave('d', 0), [buy('qipao:red', '一件红旗袍', 'a red qipao')], ctx);
    s = applyAll(s, [{ do: 'wear', slot: 'top', id: 'qipao:red', zh: '旗袍', en: 'the qipao' }], ctx);
    s = applyAll(s, [{ do: 'wear', slot: 'top', id: 'jacket:blue', zh: '夹克', en: 'the jacket' }, { do: 'wear', slot: 'top', id: 'qipao:red', zh: '旗袍', en: 'the qipao' }], ctx);
    const lines = diaryLines(today(s), names).map((l) => l.zh);
    assert.deepEqual(lines.filter((l) => l.startsWith('今天我穿了')), ['今天我穿了旗袍。']);
    assert.ok(s.worn.includes('qipao'));
  });

  it('three sets: save the outfit, put a set back on (only what is still owned)', () => {
    let s = applyAll(newSave('d', 0), [buy('beanie:grey', '一顶毛线帽', 'a beanie'), { do: 'wear', slot: 'hat', id: 'beanie:grey' }, { do: 'save_outfit', index: 1 }], ctx);
    assert.equal(s.outfits[1]?.hat, 'beanie:grey');
    s = applyAll(s, [{ do: 'take_off', slot: 'hat' }, { do: 'put_on', index: 1 }], ctx);
    assert.equal(s.outfit.hat, 'beanie:grey');
    s = applyAll(s, [{ do: 'take_off', slot: 'hat' }, { do: 'sell_clothes', id: 'beanie:grey' }, { do: 'put_on', index: 1 }], ctx);
    assert.equal(s.outfit.hat, undefined);
    assert.equal(s.outfits[1]?.hat, undefined);
    // an empty set does nothing
    assert.equal(applyAll(s, [{ do: 'put_on', index: 2 }], ctx).outfit, s.outfit);
  });

  it('what you wear cannot be sold', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'sell_clothes', id: 'jacket:blue' }], ctx);
    assert.ok(s.wardrobe.includes('jacket:blue'));
  });

  it('the barber changes the hair, the rest of the look stays', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'hair', style: 'buzz' }, { do: 'hair', colour: 'brown' }], ctx);
    assert.deepEqual(s.look.hair, { style: 'buzz', colour: 'brown' });
    assert.equal(s.look.build, DEFAULT_LOOK.build);
  });

  it('merge: clothes owned from both phones; look and outfit from the later; a made look is never lost', () => {
    const base = newSave('a', 0);
    const look: HeroLook = { ...DEFAULT_LOOK, hair: { style: 'bob', colour: 'brown' } };
    const ipad = { ...applyAll(base, [{ do: 'create', look }, buy('qipao:red', '一件红旗袍', 'a red qipao', true)], { now: 5, deviceId: 'ipad' }) };
    const mac = { ...applyAll(base, [buy('beanie:grey', '一顶毛线帽', 'a beanie')], { now: 9, deviceId: 'mac' }) };
    const m = merge(ipad, mac);
    assert.ok(m.wardrobe.includes('qipao:red') && m.wardrobe.includes('beanie:grey'));
    assert.equal(m.created, true);
    assert.deepEqual(m.look, look);
    // the Mac saved last: its outfit
    assert.equal(m.outfit.top, 'jacket:blue');
    assert.deepEqual(merge(mac, ipad), m);
  });
});

describe('clothes.json (W2)', () => {
  const raw = JSON.parse(readFileSync('content/world/clothes.json', 'utf8'));

  it('passes its schema and every reference: a drawing, enough palette letters, a measure word that fits, a rack', () => {
    const r = parseClothes(raw);
    assert.ok(r.ok, r.ok ? '' : r.errors.join('\n'));
  });

  it('the checks catch a garment with no drawing, a wrong measure word, too few colours, a missing rack', () => {
    const bad = {
      racks: [],
      clothes: [
        { id: 'cape', zh: '斗篷', en: 'cape', slot: 'top', measure: '件', colours: [{ id: 'red', zh: '红的', en: 'red', palette: 'rR' }], price: 10, shop: 'start' },
        { id: 'qipao', zh: '旗袍', en: 'qipao', slot: 'top', measure: '双', colours: [{ id: 'red', zh: '红的', en: 'red', palette: 'r' }], price: 10, shop: 'ruifuxiang' },
      ],
    };
    const r = parseClothes(bad);
    assert.ok(r.ok);
    const errors = checkClothes(r.value, { npcs: [] }, GARMENT_ART).join('\n');
    assert.match(errors, /cape.*no drawing/);
    assert.match(errors, /measure 双 does not go with a top/);
    assert.match(errors, /gives 1 letters/);
    assert.match(errors, /shop "ruifuxiang" is not a rack/);
    assert.ok(!parseClothes({ ...bad, clothes: [{ ...bad.clothes[0], colours: [{ id: 'red', zh: '红', en: 'red', palette: 'rR' }] }] }).ok, 'a colour is said with 的');
  });

  it('counts one the way a seller does: 一件红旗袍, 一条裤子 (one colour: no colour word)', () => {
    const c = {
      clothes: [
        { id: 'qipao', zh: '旗袍', en: 'qipao', slot: 'top' as const, measure: '件' as const, colours: [{ id: 'red', zh: '红的', en: 'red', palette: 'rRy' }, { id: 'blue', zh: '蓝的', en: 'blue', palette: 'nBy' }], price: 600, shop: 'x' },
        { id: 'trousers', zh: '裤子', en: 'trousers', slot: 'bottom' as const, measure: '条' as const, colours: [{ id: 'dark', zh: '黑的', en: 'dark', palette: 'ak' }], price: 45, shop: 'start' },
      ],
    };
    assert.equal(oneZh(c, 'qipao:red'), '一件红旗袍');
    assert.equal(oneZh(c, 'trousers:dark'), '一条裤子');
    assert.equal(oneEn(c, 'qipao:blue'), 'a blue qipao');
    assert.equal(paletteOf(c, 'qipao:blue'), 'nBy');
    assert.equal(paletteOf(c, 'qipao:green'), undefined);
  });
});
