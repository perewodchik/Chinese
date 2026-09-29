import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { moodFor, placeOf, PENTA, song, stepMidi, TUNES, type Where } from './music';

const lane = { crowd: 6, pigeons: 4, bikes: 2 };
const room = { crowd: 0, pigeons: 0, bikes: 0 };
const at = (w: Partial<Where>): Where => ({ mapId: 'nanluo-main', life: lane, time: 'day', weather: 'clear', festival: null, ...w });

/** A seeded random, so a song is the same every run. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

describe('the music follows the game', () => {
  it('each kind of place has its own music', () => {
    assert.equal(placeOf('siheyuan-room', room), 'home');
    assert.equal(placeOf('taihedian', room), 'palace');
    assert.equal(placeOf('station-guomao', lane), 'station');
    assert.equal(placeOf('some-new-shop', room), 'shop');
    assert.equal(placeOf('some-new-street', { crowd: 9, pigeons: 0, bikes: 1 }), 'bustle');
    const ids = new Set(['siheyuan-room', 'nanluo-main', 'qianmen-street', 'taihedian', 'tiantan-park', 'changcheng'].map((mapId) => moodFor(at({ mapId })).id));
    assert.equal(ids.size, 6);
  });

  it('busy streets are quicker than the lanes, the palace slowest', () => {
    const bpm = (mapId: string) => moodFor(at({ mapId })).bpm;
    assert.ok(bpm('qianmen-street') > bpm('nanluo-main'));
    assert.ok(bpm('taihedian') < bpm('nanluo-main'));
  });

  it('night is a quiet lullaby without drums, and a different piece', () => {
    const day = moodFor(at({ mapId: 'qianmen-street' }));
    const night = moodFor(at({ mapId: 'qianmen-street', time: 'night' }));
    assert.notEqual(night.id, day.id);
    assert.equal(night.perc, 'none');
    assert.ok(night.bpm < day.bpm && night.level < day.level);
  });

  it('rain thins it; snow brings bells', () => {
    const rain = moodFor(at({ weather: 'rain' }));
    assert.equal(rain.perc, 'none');
    assert.ok(rain.busy < moodFor(at({})).busy);
    assert.equal(moodFor(at({ weather: 'snow' })).answer, 'bells');
    // weather does not reach indoors
    assert.equal(moodFor(at({ mapId: 'siheyuan-room', weather: 'rain' })).id, moodFor(at({ mapId: 'siheyuan-room' })).id);
  });

  it('春节 fills the streets with 锣鼓 and 新年好; 中秋 a moon tune; a room stays a room', () => {
    const cj = moodFor(at({ festival: 'chunjie' }));
    assert.equal(cj.perc, 'luogu');
    assert.equal(cj.tune, 'xinnianhao');
    assert.equal(moodFor(at({ festival: 'zhongqiu', mapId: 'houhai-lake' })).id, 'moon');
    assert.equal(moodFor(at({ festival: 'chunjie', mapId: 'siheyuan-room' })).perc, 'none');
  });

  it('the same place and hour keeps the same mood (no restart walking about)', () => {
    assert.equal(moodFor(at({})).id, moodFor(at({ life: { crowd: 7, pigeons: 1, bikes: 0 } })).id);
  });
});

describe('the notes', () => {
  it('pentatonic steps climb through the octave', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, -1].map((s) => stepMidi(60, s)), [60, 62, 64, 67, 69, 72, 57]);
  });

  it('a composed song: phrases of four bars, only the five notes, the last phrase home', () => {
    for (const mapId of ['nanluo-main', 'taihedian', 'tiantan-park', 'qianmen-street']) {
      for (let seed = 1; seed < 30; seed++) {
        const m = { ...moodFor(at({ mapId })), tune: null };
        const { phrases } = song(m, seeded(seed), 2);
        const music = phrases.filter((p) => p.notes.length);
        assert.equal(music.length, 4);
        for (const p of music) {
          assert.equal(p.beats, 16);
          for (const n of p.notes) {
            assert.ok(n.at >= 0 && n.at < p.beats, `${mapId} note at ${n.at}`);
            if (n.midi) assert.ok((PENTA as readonly number[]).includes((((n.midi - m.key) % 12) + 12) % 12), `${mapId} ${n.midi} off the scale`);
          }
          const lead = p.notes.filter((n) => n.voice === m.lead || n.voice === m.answer);
          const sum = lead.reduce((a, n) => a + n.len, 0);
          assert.equal(sum, 16, 'the tune fills its four bars');
        }
        const last = music[3]!.notes.filter((n) => n.voice === m.lead).at(-1)!;
        assert.equal((((last.midi - stepMidi(m.key, m.home)) % 12) + 12) % 12, 0, 'ends on the home note');
        // and stays in a singable range
        for (const n of music.flatMap((p) => p.notes).filter((n) => n.voice === m.lead)) {
          assert.ok(Math.abs(n.midi - m.key) <= 24, `${mapId} ${n.midi} out of range`);
        }
      }
    }
  });

  it('the folk songs have whole bars and end on do', () => {
    for (const [id, t] of Object.entries(TUNES)) {
      for (const line of t.lines) {
        const eighths = line.reduce((a, [, e]) => a + e, 0);
        assert.equal(eighths % (t.bar * 2), 0, `${id} line of ${eighths} eighths`);
      }
      assert.equal(t.lines.at(-1)!.at(-1)![0], 0, id);
    }
  });

  it('the first song in a place with a folk song is that song', () => {
    const m = moodFor(at({ mapId: 'siheyuan-room' }));
    const { phrases } = song(m, seeded(3), 1);
    const first = phrases[0]!.notes.filter((n) => n.voice === 'zheng').map((n) => n.midi - m.key);
    assert.deepEqual(first.slice(0, 5), [4, 4, 7, 9, 12]);
  });
});
