import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { trackPitch } from '../../platform/audio/pitch';
import { analyse, calibrate } from './analyse';
import { classify, judge, TEMPLATES, templateFor, toChao, type VoiceRange } from './contour';
import { spokenTones } from './sandhi';
import { parseSyllable, withTone } from './syllable';

const RATE = 16000;
const VOICE: VoiceRange = { floorHz: 100, ceilHz: 200 };

/** Hz for a Chao value in VOICE: 1 → 100 Hz, 5 → 200 Hz. */
const hzAt = (chao: number) => 100 * 2 ** ((chao - 1) / 4);

/**
 * A voice-like signal following a pitch track: a fundamental with a few
 * falling harmonics, which is what YIN is built to find. Syllables are given
 * as Chao contours, with silence between them.
 */
function synth(syllables: number[][], opts: { gap?: number; length?: number } = {}): Float32Array {
  const len = opts.length ?? 0.3;
  const gap = opts.gap ?? 0.08;
  const total = Math.ceil(RATE * (gap + syllables.length * (len + gap)));
  const out = new Float32Array(total);
  let phase = 0;
  let at = Math.floor(gap * RATE);
  for (const contour of syllables) {
    const n = Math.floor(len * RATE);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * (contour.length - 1);
      const lo = Math.floor(x);
      const hi = Math.min(contour.length - 1, lo + 1);
      const chao = contour[lo]! + (contour[hi]! - contour[lo]!) * (x - lo);
      phase += (2 * Math.PI * hzAt(chao)) / RATE;
      const env = Math.min(1, i / 400, (n - i) / 400);
      out[at + i] = env * 0.5 * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
    }
    at += n + Math.floor(gap * RATE);
  }
  return out;
}

describe('syllables', () => {
  it('takes a reading apart into initial, final and tone', () => {
    assert.deepEqual(
      (({ initial, final, tone }) => ({ initial, final, tone }))(parseSyllable('zhōng')),
      { initial: 'zh', final: 'ong', tone: 1 },
    );
    assert.equal(parseSyllable('qù').final, 'ü');
    assert.equal(parseSyllable('xué').final, 'üe');
    assert.equal(parseSyllable('yuè').final, 'üe');
    assert.equal(parseSyllable('yī').final, 'i');
    assert.equal(parseSyllable('wǒ').final, 'uo');
    assert.equal(parseSyllable('jiǔ').final, 'iou');
    assert.equal(parseSyllable('duì').final, 'uei');
    assert.equal(parseSyllable('ài').initial, '');
    assert.equal(parseSyllable('le').tone, 5);
    // ü carries its own two dots; they are not a tone.
    assert.equal(parseSyllable('nǚ').tone, 3);
    assert.equal(parseSyllable('lǜ').tone, 4);
    assert.equal(parseSyllable('lǘ').tone, 2);
    assert.equal(parseSyllable('lǖ').tone, 1);
  });

  it('puts the tone mark where pinyin puts it', () => {
    assert.equal(withTone('hao', 3), 'hǎo');
    assert.equal(withTone('dou', 1), 'dōu');
    assert.equal(withTone('gui', 4), 'guì');
    assert.equal(withTone('xue', 2), 'xué');
    assert.equal(withTone('lü', 4), 'lǜ');
  });
});

describe('tone sandhi', () => {
  const surface = (tones: number[], chars = '') => spokenTones(tones, [...chars]).map((s) => s.surface);

  it('turns the first of two thirds into a second', () => {
    assert.deepEqual(surface([3, 3], '你好'), [2, 3]);
  });

  it('turns all but the last of a longer run into seconds, and says it is approximate', () => {
    const s = spokenTones([3, 3, 3], [...'我很好']);
    assert.deepEqual(s.map((x) => x.surface), [2, 2, 3]);
    assert.ok(s[0]!.approximate);
  });

  it('says 一 as yì before tones 1–3 and yí before a fourth', () => {
    assert.deepEqual(surface([1, 1], '一天'), [4, 1]);
    assert.deepEqual(surface([1, 4], '一样'), [2, 4]);
    assert.deepEqual(surface([1, 4], '一下'), [2, 4]);
  });

  it('leaves 一 alone when it is a number being counted', () => {
    assert.deepEqual(surface([4, 1], '第一'), [4, 1]);
    assert.deepEqual(surface([2, 1], '十一'), [2, 1]);
  });

  it('says 不 as bú before a fourth, and only then', () => {
    assert.deepEqual(surface([4, 4], '不是'), [2, 4]);
    assert.deepEqual(surface([4, 1], '不吃'), [4, 1]);
  });

  it('marks a third with something after it as a half third', () => {
    const s = spokenTones([3, 1], [...'好吃']);
    assert.ok(s[0]!.halfThird);
    assert.ok(!spokenTones([3], ['好'])[0]!.halfThird);
  });
});

describe('telling the tones apart', () => {
  it('recognises each template as itself', () => {
    for (const t of TEMPLATES) assert.equal(classify(t.points)!.tone, t.tone, `tone ${t.tone}${t.half ? ' half' : ''}`);
  });

  it('still hears a rising tone that starts high, and a level one that sits at 4', () => {
    assert.equal(classify([3.8, 3.8, 4, 4.3, 4.6, 5, 5.3, 5.5, 5.6])!.tone, 2);
    assert.equal(classify([4, 4.1, 4, 4, 3.9, 4, 4.1, 4, 4])!.tone, 1);
  });

  it('calls it nearly rather than wrong when the expected tone is a close second', () => {
    // Halfway between a fall and a low dip.
    const j = judge([4, 3.6, 3.1, 2.5, 2, 1.6, 1.3, 1.2, 1.2], 3);
    assert.notEqual(j.verdict, 'right');
    assert.ok(j.guess);
  });

  it('does not judge a neutral tone', () => {
    assert.equal(judge([3, 3, 3, 3, 3], 5).verdict, 'light');
  });

  it('gives an English-speaker tip for a miss', () => {
    const j = judge(templateFor(4)!, 1);
    assert.equal(j.verdict, 'wrong');
    assert.match(j.tip!, /level/);
  });
});

describe('pitch tracking', () => {
  it('finds a steady pitch within a couple of hertz', () => {
    const frames = trackPitch(synth([[3, 3, 3]]), { sampleRate: RATE });
    const voiced = frames.filter((f) => f.hz > 0);
    assert.ok(voiced.length > 20);
    const mid = voiced[voiced.length >> 1]!.hz;
    assert.ok(Math.abs(mid - hzAt(3)) < 2, `heard ${mid.toFixed(1)} Hz`);
  });

  it('puts a voice on its own scale', () => {
    assert.ok(Math.abs(toChao(100, VOICE) - 1) < 1e-9);
    assert.ok(Math.abs(toChao(200, VOICE) - 5) < 1e-9);
  });
});

describe('an attempt, end to end', () => {
  const run = (contours: number[][], tones: number[], chars: string, range: VoiceRange | null = VOICE) =>
    analyse(trackPitch(synth(contours), { sampleRate: RATE }), spokenTones(tones, [...chars]), range);

  it('marks a well-said 你好 right, expecting ní hǎo', () => {
    const a = run([templateFor(2)!, templateFor(3)!], [3, 3], '你好');
    assert.deepEqual(a.syllables.map((s) => s.judged.verdict), ['right', 'right']);
  });

  it('marks 你好 said with two textbook thirds wrong on the first', () => {
    const a = run([templateFor(3)!, templateFor(3)!], [3, 3], '你好');
    assert.notEqual(a.syllables[0]!.judged.verdict, 'right');
    assert.equal(a.syllables[1]!.judged.verdict, 'right');
  });

  it('judges each of the four tones on one syllable', () => {
    for (const tone of [1, 2, 3, 4]) {
      const a = run([templateFor(tone)!], [tone], 'ma');
      assert.equal(a.syllables[0]!.judged.verdict, 'right', `tone ${tone}`);
    }
  });

  it('finds the syllables when the voice runs straight through them', () => {
    const joined = synth([[...templateFor(4)!, ...templateFor(1)!]], { length: 0.6 });
    // A dip in loudness between the two, where one hands over to the next.
    const mid = Math.floor(joined.length / 2);
    for (let i = -300; i < 300; i++) joined[mid + i]! *= 0.15 + Math.abs(i) / 360;
    const a = analyse(trackPitch(joined, { sampleRate: RATE }), spokenTones([4, 1]), VOICE);
    assert.equal(a.syllables.length, 2);
  });

  it('says so when nothing was said', () => {
    const a = analyse(trackPitch(new Float32Array(RATE), { sampleRate: RATE }), spokenTones([1]), VOICE);
    assert.equal(a.problem, 'silent');
  });

  it('calibrates a range from mā má mǎ mà', () => {
    const frames = trackPitch(synth([templateFor(1)!, templateFor(2)!, templateFor(3)!, templateFor(4)!]), {
      sampleRate: RATE,
    });
    const r = calibrate(frames)!;
    assert.ok(r.floorHz > 95 && r.floorHz < 115, `floor ${r.floorHz}`);
    assert.ok(r.ceilHz > 180 && r.ceilHz < 205, `ceil ${r.ceilHz}`);
  });
});
