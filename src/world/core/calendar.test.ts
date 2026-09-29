import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateOf, dateZh, festivalOf, FESTIVALS, seasonOf, weatherOf, WEEKS } from './calendar';
import { holds } from './flags';
import { newSave } from './save';

const at = (day: number, hour = 9) => ({ ...newSave('d', 0), clock: (day - 1) * 1440 + hour * 60 });

describe('the calendar (X4)', () => {
  it('a game day is a week: the game starts in early September and the year turns in 52 days', () => {
    assert.deepEqual(dateOf(1), { month: 9, date: 6 });
    assert.equal(dateZh(2), '9月13日');
    assert.deepEqual(dateOf(1 + WEEKS), dateOf(1));
    assert.equal(seasonOf(1), 'autumn');
    assert.equal(seasonOf(20), 'winter');
    assert.equal(seasonOf(30), 'spring');
    assert.equal(seasonOf(45), 'summer');
  });

  it('every festival comes once a year, 中秋 and 国庆 in the first week of play', () => {
    const days = FESTIVALS.map((f) => [f.id, Array.from({ length: WEEKS }, (_, i) => i + 1).filter((d) => festivalOf(d)?.id === f.id)]);
    for (const [, ds] of days) assert.equal((ds as number[]).length, 1);
    assert.equal(festivalOf(3)?.id, 'zhongqiu');
    assert.equal(festivalOf(5)?.id, 'guoqing');
    assert.equal(festivalOf(23)?.id, 'chunjie');
  });

  it('weather is the same for a day everywhere, sunny at the start, snowy for 春节, and each kind comes round', () => {
    assert.equal(weatherOf(1), 'clear');
    assert.equal(weatherOf(2), 'clear');
    assert.equal(weatherOf(23), 'snow');
    assert.equal(weatherOf(17), weatherOf(17));
    const year = new Set(Array.from({ length: WEEKS }, (_, i) => weatherOf(i + 1)));
    for (const w of ['clear', 'cloudy', 'rain', 'snow', 'wind'] as const) assert.ok(year.has(w), w);
    // no snow in summer
    for (let d = 1; d <= WEEKS; d++) if (seasonOf(d) === 'summer') assert.notEqual(weatherOf(d), 'snow');
  });

  it('conditions on weather, festival and season', () => {
    assert.ok(holds({ festival: 'zhongqiu' }, at(3)));
    assert.ok(!holds({ festival: 'zhongqiu' }, at(4)));
    assert.ok(holds({ weather: 'snow' }, at(23)));
    assert.ok(holds({ season: 'winter' }, at(23)));
    assert.ok(holds({ weather: 'clear' }, at(1, 23)));
  });
});
