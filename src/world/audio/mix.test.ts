import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CITY_VOICES, mixFor, nextIn } from './mix';

const lane = { crowd: 6, pigeons: 4, bikes: 2 };

describe('the street sounds', () => {
  it('a busy lane by day: people, pigeon whistles, bells', () => {
    const m = mixFor('nanluo-main', lane, 'day');
    assert.ok(m.crowd > 0.3);
    assert.ok(m.pigeonsEvery > 0 && m.bellsEvery > 0);
    assert.equal(m.station, false);
  });

  it('at night the pigeons sleep and the bells stop; the murmur drops', () => {
    const m = mixFor('nanluo-main', lane, 'night');
    assert.equal(m.pigeonsEvery, 0);
    assert.equal(m.bellsEvery, 0);
    assert.ok(m.crowd < mixFor('nanluo-main', lane, 'day').crowd);
  });

  it('a room is nearly quiet; a station has its own sound', () => {
    assert.ok(mixFor('zaodian', { crowd: 0, pigeons: 0, bikes: 0 }, 'day').crowd < 0.1);
    assert.equal(mixFor('station-nanluoguxiang', { crowd: 3, pigeons: 0, bikes: 0 }, 'day').station, true);
  });

  it('never the same interval twice, within ±40 %', () => {
    assert.equal(nextIn(30, () => 0), 18);
    assert.equal(nextIn(30, () => 1), 42);
  });
});

describe('the city’s voices and sounds (§13 N1–N2)', () => {
  const street = { crowd: 6, pigeons: 3, bikes: 2 };
  const room = { crowd: 0, pigeons: 0, bikes: 0 };
  const at = (hour: number, season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring', festival: string | null = null) => ({ hour, season, festival });
  const voices = (map: string, when: ReturnType<typeof at>, life = street) => mixFor(map, life, 'day', when).voices.map((v) => v.id);
  const sounds = (map: string, when: ReturnType<typeof at>, life = street) => mixFor(map, life, 'day', when).sounds;

  it('without the calendar the mix is G1’s, and nothing else', () => {
    const m = mixFor('nanluo-main', street, 'day');
    assert.deepEqual(m.sounds, {});
    assert.deepEqual(m.voices, []);
  });

  it('the recycler’s loudspeaker and the knife grinder in the 胡同, by day only', () => {
    assert.ok(voices('hutong-home', at(9)).includes('huishou'));
    assert.ok(!voices('hutong-home', at(14)).includes('huishou'), 'the recycler comes in the morning');
    assert.ok(voices('hutong-home', at(14)).includes('modao'));
    assert.ok(!voices('hutong-home', at(20)).includes('modao'));
    assert.ok(!voices('wangfujing-street', at(9)).includes('huishou'), 'not on 王府井');
  });

  it('糖葫芦 on the busy streets but not in summer; 烤红薯 only in winter', () => {
    assert.ok(voices('wangfujing-street', at(15, 'autumn')).includes('tanghulu'));
    assert.ok(!voices('wangfujing-street', at(15, 'summer')).includes('tanghulu'));
    assert.ok(voices('qianmen-street', at(15, 'winter')).includes('hongshu'));
    assert.ok(!voices('qianmen-street', at(15, 'spring')).includes('hongshu'));
  });

  it('包子 at the 早点铺 in the morning; the delivery rider at lunch and supper; a scooter reversing by day', () => {
    assert.ok(voices('nanluo-main', at(7)).includes('baozi'));
    assert.ok(voices('zaodian', at(7), room).includes('baozi'), 'inside the 早点铺 too');
    assert.ok(!voices('nanluo-main', at(12)).includes('baozi'));
    assert.ok(voices('sanlitun-street', at(12)).includes('waimai'));
    assert.ok(voices('sanlitun-street', at(18)).includes('waimai'));
    assert.ok(!voices('sanlitun-street', at(15)).includes('waimai'));
    assert.ok(voices('yonghegong-street', at(10)).includes('daoche'));
    assert.ok(!voices('yonghegong-street', at(22)).includes('daoche'));
  });

  it('chanting and the 木鱼 at the temples by day; a 京剧 radio by day and 麻将 at night in the 胡同', () => {
    assert.ok(sounds('yonghegong-wanfuge', at(10)).muyu);
    assert.ok(!sounds('yonghegong-wanfuge', at(20)).muyu);
    assert.ok(!sounds('wangfujing-street', at(10)).muyu);
    assert.ok(sounds('siheyuan-yard', at(11)).jingju);
    assert.ok(sounds('hutong-home', at(21)).mahjong);
    assert.ok(!sounds('hutong-home', at(11)).mahjong);
  });

  it('广场舞 on the squares 18–21, cicadas on summer days, crows at winter dusk, firecrackers at 春节 in the evening only', () => {
    assert.ok(sounds('gulou-square', at(19)).dance);
    assert.ok(!sounds('gulou-square', at(22)).dance);
    assert.ok(!sounds('nanluo-main', at(19)).dance);
    assert.ok(sounds('houhai-lake', at(14, 'summer')).cicadas);
    assert.ok(!sounds('houhai-lake', at(14, 'winter')).cicadas);
    assert.ok(!sounds('zaodian', at(14, 'summer'), room).cicadas, 'not indoors');
    assert.ok(sounds('jingshan-park', at(17, 'winter')).crows);
    assert.ok(!sounds('jingshan-park', at(12, 'winter')).crows);
    assert.ok(sounds('hutong-home', at(20, 'winter', 'chunjie')).firecrackers);
    assert.ok(!sounds('hutong-home', at(3, 'winter', 'chunjie')).firecrackers, 'not all night');
    assert.ok(!sounds('hutong-home', at(20, 'winter')).firecrackers);
  });

  it('every voice has its words and its English, and comes no more than once a minute', () => {
    for (const v of Object.values(CITY_VOICES)) {
      assert.ok(v.zh && v.en && v.who);
      assert.ok(v.every >= 60, v.id);
    }
  });
});
