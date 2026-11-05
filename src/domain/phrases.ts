import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import { parseSyllable } from './pinyin/syllable';

/**
 * Phrases said aloud and scored: the everyday ones to start from, what to say
 * about each kind of fault the service finds, and what keeps going wrong
 * across every phrase said.
 *
 * The feedback follows the service's report as it is. iFlytek says only that
 * a syllable's initial, final or tone was wrong, or that it was left out;
 * SpeechSuper also says what it sounded like instead (k for q, a second tone
 * for a first) and the tone a syllable takes in the phrase (一 before a third
 * tone is yì) — said when it is known, the advice always how it is made right.
 */

export interface Phrase {
  zh: string;
  py: string;
  en: string;
}

/** Things said every day, HSK 1–2, short enough to say in a breath. */
export const EVERYDAY: Phrase[] = [
  { zh: '你好，很高兴认识你。', py: 'nǐ hǎo, hěn gāoxìng rènshi nǐ', en: 'Hello, nice to meet you.' },
  { zh: '我叫小明，你叫什么名字？', py: 'wǒ jiào Xiǎomíng, nǐ jiào shénme míngzi', en: 'I am Xiaoming. What is your name?' },
  { zh: '我是俄罗斯人。', py: 'wǒ shì Éluósī rén', en: 'I am Russian.' },
  { zh: '我在学习中文。', py: 'wǒ zài xuéxí Zhōngwén', en: 'I am learning Chinese.' },
  { zh: '请再说一遍。', py: 'qǐng zài shuō yí biàn', en: 'Please say it again.' },
  { zh: '请说慢一点儿。', py: 'qǐng shuō màn yìdiǎnr', en: 'Please speak a little slower.' },
  { zh: '这个用中文怎么说？', py: 'zhège yòng Zhōngwén zěnme shuō', en: 'How do you say this in Chinese?' },
  { zh: '我听不懂。', py: 'wǒ tīng bu dǒng', en: 'I do not understand.' },
  { zh: '这个多少钱？', py: 'zhège duōshao qián', en: 'How much is this?' },
  { zh: '太贵了，便宜一点儿吧。', py: 'tài guì le, piányi yìdiǎnr ba', en: 'Too expensive, a bit cheaper please.' },
  { zh: '我要一杯咖啡。', py: 'wǒ yào yì bēi kāfēi', en: 'I would like a cup of coffee.' },
  { zh: '洗手间在哪儿？', py: 'xǐshǒujiān zài nǎr', en: 'Where is the toilet?' },
  { zh: '现在几点了？', py: 'xiànzài jǐ diǎn le', en: 'What time is it now?' },
  { zh: '今天天气很好。', py: 'jīntiān tiānqì hěn hǎo', en: 'The weather is good today.' },
  { zh: '我饿了，我们去吃饭吧。', py: 'wǒ è le, wǒmen qù chīfàn ba', en: 'I am hungry, let us go and eat.' },
  { zh: '你喜欢喝茶吗？', py: 'nǐ xǐhuan hē chá ma', en: 'Do you like drinking tea?' },
  { zh: '我明天去北京。', py: 'wǒ míngtiān qù Běijīng', en: 'I am going to Beijing tomorrow.' },
  { zh: '谢谢你的帮助。', py: 'xièxie nǐ de bāngzhù', en: 'Thank you for your help.' },
  { zh: '没关系，不客气。', py: 'méi guānxi, bú kèqi', en: 'It is fine, you are welcome.' },
  { zh: '明天见！', py: 'míngtiān jiàn', en: 'See you tomorrow!' },
];

/* ------------------------------------------------------------ syllables */

const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];

/** A syllable as iFlytek writes it (zhi4) taken apart: initial, final, tone (5 neutral). */
export function partsOf(symbol: string): { initial: string; final: string; tone: number; marked: string } {
  const m = symbol.toLowerCase().match(/^([a-zü:v]+)([0-5])?$/);
  const bare = m?.[1] ?? symbol;
  const tone = Number(m?.[2] ?? 5) || 5;
  const initial = INITIALS.find((i) => bare.startsWith(i)) ?? '';
  return { initial, final: bare.slice(initial.length).replace(/v|u:/g, 'ü'), tone, marked: marked(bare, tone) };
}

/**
 * Each character's reading numbered, as the scoring service takes it (kǎ → ka3,
 * nǚ → nv3, the r of erhua → er5), so a character with two readings is scored
 * as this one; none when any is unknown, since one missing would shift the rest.
 */
export function numbered(readings: string[]): string[] | undefined {
  const out: string[] = [];
  for (const py of readings) {
    if (/^r$/i.test(py.trim())) {
      out.push('er5');
      continue;
    }
    const s = parseSyllable(py.trim());
    const bare = s.bare.replace(/ü/g, 'v');
    if (!/^[a-z]{1,6}$/.test(bare)) return undefined;
    out.push(`${bare}${s.tone}`);
  }
  return out.length ? out : undefined;
}

const MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/** xiao3 → xiǎo: the mark on a, else e, else the o of ou, else the last vowel. */
export function marked(bare: string, tone: number): string {
  const s = bare.replace(/v|u:/g, 'ü');
  if (tone < 1 || tone > 4) return s;
  let i = s.search(/[ae]/);
  if (i < 0) i = s.indexOf('ou');
  if (i < 0) {
    for (let k = s.length - 1; k >= 0; k--) if ('iouü'.includes(s[k]!)) {
      i = k;
      break;
    }
  }
  if (i < 0) return s;
  return s.slice(0, i) + MARKS[s[i]!]![tone - 1] + s.slice(i + 1);
}

const TONE_NAME: Record<number, string> = { 1: 'a first tone', 2: 'a second tone', 3: 'a third tone', 4: 'a fourth tone', 5: 'a neutral tone' };

const TONE_HOW: Record<number, string> = {
  1: 'A first tone stays high and level, held at the top of your voice like a sung note.',
  2: 'A second tone rises from the middle to the top, like a surprised “What?”.',
  3: 'A third tone dips low and stays low; in a phrase, keep it low and short, a creak at the bottom of your voice.',
  4: 'A fourth tone starts high and falls all the way down, short and firm, like a decided “No!”.',
  5: 'A neutral tone is light and short, with no shape of its own: let it fall off the syllable before.',
};

const INITIAL_HOW: Record<string, string> = {
  zh: 'zh: the tongue tip curled back to the roof of the mouth, then released without a puff — not z.',
  ch: 'ch: tongue curled back as for zh, then released with a strong puff of air.',
  sh: 'sh: tongue curled back, not touching, air hissing past it — not s.',
  r: 'r: tongue curled back as for sh, but voiced and buzzing, not the English r.',
  z: 'z: tongue tip flat behind the upper teeth, like the ds in “beds”, no puff.',
  c: 'c: tongue flat behind the teeth, like ts in “cats”, with a strong puff.',
  s: 's: tongue flat behind the teeth, a plain hiss.',
  j: 'j: tongue tip down behind the lower teeth, the middle of the tongue up, lips spread; no puff.',
  q: 'q: as j, with a strong puff of air — not ch.',
  x: 'x: as j, but the air hisses through without stopping — not sh.',
  p: 'p, t, k: a strong puff of air after them; hold a hand in front of your mouth to feel it.',
  t: 'p, t, k: a strong puff of air after them; hold a hand in front of your mouth to feel it.',
  k: 'p, t, k: a strong puff of air after them; hold a hand in front of your mouth to feel it.',
  b: 'b, d, g: no puff at all and no voice either — softer than English p, t, k.',
  d: 'b, d, g: no puff at all and no voice either — softer than English p, t, k.',
  g: 'b, d, g: no puff at all and no voice either — softer than English p, t, k.',
  h: 'h: from further back, a little rasp at the back of the mouth, like the ch in “loch”.',
  n: 'n and l: n through the nose, l with the tongue tip up and the air round its sides.',
  l: 'n and l: n through the nose, l with the tongue tip up and the air round its sides.',
};

/** What to say about a final, by what it ends in or holds. */
function finalHow(final: string, initial: string): string {
  // After j, q, x and y a written u is ü.
  if (/ü/.test(final) || (['j', 'q', 'x', 'y'].includes(initial) && /^u/.test(final))) return `${final}: rounded lips with the tongue as for i — ü, as in German “über”.`;
  if (final.endsWith('ng')) return `${final}: end at the back of the mouth, as in “sing”, the tongue never touching the teeth — not -n.`;
  if (final.endsWith('n')) return `${final}: end with the tongue tip touching behind the upper teeth, a short n — not -ng.`;
  if (final === 'e') return 'e: the tongue back and the lips unrounded, between “uh” and “er” — not the English e.';
  if (final === 'i') return 'i after zh ch sh r z c s is not “ee”: the tongue stays where the initial left it, a buzz.';
  return `${final}: hear it slowly and copy the shape of the mouth.`;
}

export interface Fault {
  /** what kind, for counting: tone4, initial:zh, final:ing, missed, added */
  kind: string;
  /** one line naming it */
  title: string;
  /** how it is made right */
  how: string;
}

/** What went wrong with a syllable, worst first; none when it was said well. */
export function faultsOf(s: SyllableEval): Fault[] {
  const p = partsOf(s.symbol);
  const out: Fault[] = [];
  if (s.said === 'missed') out.push({ kind: 'missed', title: 'Not heard', how: `${s.char} ${p.marked} was not heard in the recording: say every syllable, the small ones too.` });
  else if (s.said === 'added') out.push({ kind: 'added', title: 'Something extra said here', how: 'Say only what is written: no sound before or after the syllable.' });
  else if (s.said === 'repeated') out.push({ kind: 'repeated', title: 'Said twice', how: 'Say it once and go on; a restart breaks the phrase.' });
  else if (s.said === 'replaced') out.push({ kind: 'replaced', title: 'Another syllable said in its place', how: `Say ${p.marked} as written; hear it once more first.` });
  if (s.said !== 'missed') {
    // Something said between it and the syllable before is about the line's flow, not this
    // character: the service still scores the character itself, and Flow counts the extra sound.
    if (s.tone) {
      // The tone it takes here: its own, or the one sandhi gives it.
      const want = s.sandhi ?? p.tone;
      const heard = s.heardTone && s.heardTone !== want ? `, it sounded like ${TONE_NAME[s.heardTone]}` : ', not as it should be';
      const here = s.sandhi ? ` Here ${s.char} is ${marked(s.symbol.toLowerCase().replace(/[0-5]$/, ''), want)}, ${TONE_NAME[want]}: its tone changes before the next syllable.` : '';
      out.push({ kind: `tone${want}`, title: `Tone: ${TONE_NAME[want]}${heard}`, how: TONE_HOW[want]! + here });
    }
    if (s.initial && p.initial) {
      const like = s.initialLike ? ` — it sounded like ${s.initialLike}` : '';
      out.push({ kind: `initial:${p.initial}`, title: `The initial ${p.initial}${like}`, how: INITIAL_HOW[p.initial] ?? `${p.initial}: hear it slowly and copy it.` });
    }
    if (s.final) {
      const like = s.finalLike ? ` — it sounded like ${s.finalLike}` : '';
      out.push({ kind: `final:${p.final}`, title: `The final ${p.final}${like}`, how: finalHow(p.final, p.initial) });
    }
  }
  return out;
}

/** How a character came out: green, nearly, wrong — and what to change when it is not green. */
export interface CharNote {
  band: 'good' | 'mid' | 'low';
  /** what went wrong, or for a nearly one what fell short; empty when green */
  faults: Fault[];
}

/** Below this a character is not green. */
export const GREEN = 75;

/**
 * A character's note. The service's own faults first; a character it found
 * nothing wrong with but scored under green is "nearly", and what fell short
 * is the part (initial, final, tone) it scored lowest, by the service's numbers.
 */
/**
 * One number for a character: the service's score for it, or the weakest of
 * its initial, final and tone when one is lower — so a character whose tone
 * was wrong never shows 100.
 */
export function charScore(s: SyllableEval): number | undefined {
  if (s.said === 'missed') return 0;
  const parts = [s.score, s.initialScore, s.finalScore, s.toneScore].filter((n): n is number => n !== undefined);
  return parts.length ? Math.min(...parts) : undefined;
}

export function noteOf(s: SyllableEval): CharNote {
  const faults = faultsOf(s);
  const p = partsOf(s.symbol);
  if (s.said === 'missed') return { band: 'low', faults };
  const score = charScore(s);
  const bandOf = (n: number): CharNote['band'] => (n >= GREEN ? 'good' : n >= 60 ? 'mid' : 'low');
  if (faults.length) return { band: score !== undefined && score >= 60 ? 'mid' : 'low', faults };
  if (score === undefined || score >= GREEN) return { band: 'good', faults: [] };
  const want = s.sandhi ?? p.tone;
  const short: Fault[] = [];
  const parts: Array<[number | undefined, Fault]> = [
    [s.toneScore, { kind: `tone${want}`, title: `Tone a little off (${Math.round(s.toneScore ?? 0)})`, how: TONE_HOW[want]! }],
    [s.initialScore, { kind: `initial:${p.initial}`, title: `The initial ${p.initial} a little off (${Math.round(s.initialScore ?? 0)})`, how: INITIAL_HOW[p.initial] ?? `${p.initial}: hear it slowly and copy it.` }],
    [s.finalScore, { kind: `final:${p.final}`, title: `The final ${p.final} a little off (${Math.round(s.finalScore ?? 0)})`, how: finalHow(p.final, p.initial) }],
  ];
  for (const [n, f] of parts) if (n !== undefined && n < GREEN && !(f.kind.startsWith('initial') && !p.initial)) short.push(f);
  if (!short.length) {
    const lowest = parts.filter(([n]) => n !== undefined).sort((a, b) => a[0]! - b[0]!)[0];
    if (lowest) short.push(lowest[1]);
  }
  return { band: bandOf(score), faults: short };
}

/**
 * What the service heard wrong in a syllable, in its own terms and nothing
 * more: the part and what it sounded like (zh → z), the tone wanted and the
 * tone heard (tone 2 → 1), not heard; for one with nothing marked but under
 * green, its lowest part and number (tone 68). Empty when it was green.
 */
export function heardTag(s: SyllableEval): string {
  if (s.said === 'missed') return 'not heard';
  const p = partsOf(s.symbol);
  const want = s.sandhi ?? p.tone;
  const out: string[] = [];
  if (s.initial && p.initial) out.push(s.initialLike ? `${p.initial} → ${s.initialLike}` : p.initial);
  if (s.final) out.push(s.finalLike ? `${p.final} → ${s.finalLike}` : p.final);
  if (s.tone) out.push(s.heardTone && s.heardTone !== want ? `tone ${want} → ${s.heardTone}` : `tone ${want}`);
  if (s.extraBefore) out.push('extra before');
  if (out.length) return out.join(' · ');
  const n = charScore(s);
  if (n === undefined || n >= GREEN) return '';
  const parts: Array<[string, number | undefined]> = [
    [p.initial, s.initialScore],
    [p.final, s.finalScore],
    [`tone ${want}`, s.toneScore],
  ];
  const low = parts.filter(([name, v]) => name && v !== undefined).sort((a, b) => a[1]! - b[1]!)[0];
  return low ? `${low[0]} ${Math.round(low[1]!)}` : '';
}

/** The phrase's one line of verdict: what let it down, or that it was good. */
export function verdictOf(r: EvalResult): { headline: string; detail: string } {
  if (r.rejected) return { headline: 'That did not sound like the phrase', detail: 'Hear it once more, then say all of it, from the first word to the last.' };
  const parts = [
    { name: 'the tones', score: r.tone },
    { name: 'the sounds', score: r.sounds },
    { name: 'the flow', score: r.fluency },
    { name: 'the words left out', score: r.completeness },
  ].sort((a, b) => a.score - b.score);
  const worst = parts[0]!;
  const word = r.total >= 90 ? 'Very good' : r.total >= 75 ? 'Good' : r.total >= 60 ? 'Getting there' : 'Not yet';
  const wrong = r.syllables.filter((s) => faultsOf(s).length);
  const detail = wrong.length
    ? `${wrong.length} of ${r.syllables.length} syllables to look at: ${wrong.map((s) => s.char).join(' ')}.`
    : 'Every syllable as it should be.';
  return { headline: worst.score >= 85 ? word : `${word} — ${worst.name} let it down`, detail };
}

/* ------------------------------------------------------------ attempts */

export interface Attempt {
  at: number;
  total: number;
  tone: number;
  sounds: number;
  fluency: number;
  completeness: number;
  /** the faults found, by kind, with the character each was on */
  faults: Array<{ kind: string; char: string; symbol: string }>;
  /** how each character was said: its number, its colour and what was wrong (kept since November 2026) */
  chars?: CharSummary[];
}

/** One character of a try, as it is looked back on. */
export interface CharSummary {
  char: string;
  /** the reading scored, with the tone it takes here: xiao3 */
  symbol: string;
  score?: number;
  band: CharNote['band'];
  missed?: boolean;
  initial?: number;
  final?: number;
  tone?: number;
  /** what was wrong, a line each: "The initial zh — it sounded like z" */
  notes: string[];
}

export function charSummary(s: SyllableEval): CharSummary {
  const note = noteOf(s);
  const n = charScore(s);
  const p = partsOf(s.symbol);
  return {
    char: s.char,
    symbol: s.sandhi ? `${s.symbol.replace(/\d$/, '')}${s.sandhi}` : s.symbol || `${p.initial}${p.final}${p.tone}`,
    ...(n !== undefined ? { score: Math.round(n) } : {}),
    band: note.band,
    ...(s.said === 'missed' ? { missed: true } : {}),
    ...(s.initialScore !== undefined ? { initial: Math.round(s.initialScore) } : {}),
    ...(s.finalScore !== undefined ? { final: Math.round(s.finalScore) } : {}),
    ...(s.toneScore !== undefined ? { tone: Math.round(s.toneScore) } : {}),
    notes: note.faults.map((f) => f.title),
  };
}

export const attemptOf = (r: EvalResult, at: number): Attempt => ({
  at,
  total: r.total,
  tone: r.tone,
  sounds: r.sounds,
  fluency: r.fluency,
  completeness: r.completeness,
  faults: r.syllables.flatMap((s) => faultsOf(s).map((f) => ({ kind: f.kind, char: s.char, symbol: s.symbol }))),
  chars: r.syllables.filter((s) => s.said !== 'added').map(charSummary),
});

export interface Trouble {
  kind: string;
  title: string;
  count: number;
  /** the characters it happened on, most often first */
  chars: Array<{ char: string; symbol: string }>;
}

const TROUBLE_TITLE = (kind: string): string => {
  if (kind.startsWith('tone')) return `The ${['neutral', 'first', 'second', 'third', 'fourth'][Number(kind.slice(4)) % 5]} tone`;
  if (kind.startsWith('initial:')) return `The initial ${kind.slice(8)}`;
  if (kind.startsWith('final:')) return `The final ${kind.slice(6)}`;
  return { missed: 'Syllables not heard', added: 'Sounds added', repeated: 'Syllables said twice', replaced: 'Syllables said as others' }[kind] ?? kind;
};

/** What keeps going wrong across phrases' latest attempts, most often first. */
export function troubles(latest: Attempt[], limit = 6): Trouble[] {
  const by = new Map<string, Trouble>();
  for (const a of latest) {
    for (const f of a.faults) {
      const t = by.get(f.kind) ?? { kind: f.kind, title: TROUBLE_TITLE(f.kind), count: 0, chars: [] };
      t.count += 1;
      if (!t.chars.some((c) => c.char === f.char)) t.chars.push({ char: f.char, symbol: f.symbol });
      by.set(f.kind, t);
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * A try kept without the service's whole answer, as a result to show: what was
 * kept of it is enough to draw the line and its cards. Since November 2026 a
 * try keeps each character's numbers (`chars`); one older than that, or moved
 * over from a device, has only its faults, so its characters are right or
 * wrong by part, with no numbers. `symbols` is the line's numbered pinyin, a
 * syllable per character, for the characters with nothing to say.
 */
export function resultOfAttempt(zh: string, symbols: string[] | undefined, a: Attempt): EvalResult {
  const chars = [...zh].filter((c) => /\p{Script=Han}/u.test(c));
  let at = 0;
  const syllables = chars.map((c, i): SyllableEval => {
    const kept = a.chars?.[i]?.char === c ? a.chars[i] : undefined;
    // Faults are kept in the line's order, so a character's own are the run of its at the front.
    const own: Array<{ kind: string; symbol: string }> = [];
    while (a.faults[at]?.char === c) own.push(a.faults[at++]!);
    const missed = kept?.missed ?? own.some((f) => f.kind === 'missed');
    const wrong = (k: string) => !missed && own.some((f) => f.kind.startsWith(k));
    return {
      char: c,
      symbol: kept?.symbol ?? own[0]?.symbol ?? symbols?.[i] ?? '',
      said: missed ? 'missed' : 'ok',
      initial: wrong('initial'),
      final: wrong('final'),
      tone: wrong('tone'),
      from: 0,
      to: 0,
      ...(kept?.score !== undefined ? { score: kept.score } : {}),
      ...(kept?.initial !== undefined ? { initialScore: kept.initial } : {}),
      ...(kept?.final !== undefined ? { finalScore: kept.final } : {}),
      ...(kept?.tone !== undefined ? { toneScore: kept.tone } : {}),
    };
  });
  return {
    by: 'speechsuper',
    total: a.total,
    tone: a.tone,
    sounds: a.sounds,
    fluency: a.fluency,
    completeness: a.completeness,
    rejected: false,
    syllables,
  };
}

/**
 * What the service heard, in a few words, from its own data only: the part it
 * marked wrong and what that sounded like when it says (tone 3, heard as 2;
 * zh, heard as z), or that it fell short (tone 3 off).
 */
export function heardNote(s: SyllableEval): string {
  if (s.said === 'missed') return 'not heard';
  const p = partsOf(s.symbol);
  const want = s.sandhi ?? p.tone;
  const out: string[] = [];
  if (s.initial && p.initial) out.push(s.initialLike ? `${p.initial}, heard as ${s.initialLike}` : `${p.initial} off`);
  if (s.final) out.push(s.finalLike ? `${p.final}, heard as ${s.finalLike}` : `${p.final} off`);
  if (s.tone) out.push(s.heardTone && s.heardTone !== want ? `tone ${want}, heard as ${s.heardTone}` : `tone ${want} off`);
  if (s.extraBefore) out.push('something said before it');
  return out.join(' · ');
}

/**
 * Each character of a line, in order, with how it was said in a try: its band,
 * or null for punctuation and for a character the service did not score. The
 * scored syllables follow the characters; one is matched to a character only
 * when it is that character, so a syllable left out never shifts the rest.
 */
export function charBands(zh: string, r: EvalResult): Array<CharNote['band'] | null> {
  const scored = r.syllables.filter((s) => s.said !== 'added');
  let k = 0;
  return [...zh].map((c) => {
    if (!/\p{Script=Han}/u.test(c)) return null;
    let j = k;
    while (j < scored.length && scored[j]!.char !== c) j++;
    if (j >= scored.length) return null;
    k = j + 1;
    return noteOf(scored[j]!).band;
  });
}
