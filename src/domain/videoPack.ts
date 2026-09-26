import { fences, spans, tryParse } from './parse';
import { hanOf, type PackSentence, type PackWord, type VideoPack, type WordVerdict } from './video';

/**
 * Claude's study pack read back — from the server's answer or from a paste,
 * the same way either time.
 *
 * Nothing in it is trusted as it stands. A line number that is not in the
 * part, a pinyin with more or fewer syllables than the line has characters, a
 * word with no Chinese in it: each is dropped on its own, and the rest of the
 * pack kept. A pack that is half right is still most of a pack.
 */

type Loose = Record<string, unknown>;

const obj = (v: unknown): Loose | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const HAN = /[㐀-鿿]/;

export interface PackResult {
  pack: VideoPack | null;
  problems: string[];
}

/** The first JSON object in the reply that looks like a pack. */
function findPack(raw: string): Loose | null {
  for (const candidate of [...fences(raw), ...spans(raw), raw]) {
    const parsed = tryParse(candidate);
    const o = obj(parsed?.value);
    if (o && (o.lines || o.words || o.questions)) return o;
  }
  return null;
}

/**
 * `zh` for each notebook line number of the part, 1 first — to check line
 * numbers and pinyin lengths against.
 */
export function readPack(raw: string, lines: ReadonlyArray<{ zh: string }>, now: number): PackResult {
  const problems: string[] = [];
  const o = findPack(raw);
  if (!o) return { pack: null, problems: ['No JSON block was found in the answer.'] };

  const count = lines.length;
  const okLine = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= count;
  const lineList = (v: unknown) => arr(v).filter(okLine);
  let dropped = 0;

  const byLine: VideoPack['lines'] = {};
  for (const x of arr(o.lines)) {
    const l = obj(x);
    if (!l || !okLine(l.n)) {
      dropped++;
      continue;
    }
    const entry: VideoPack['lines'][number] = {};
    const py = str(l.py).replace(/\s+/g, ' ');
    if (py) {
      if (py.split(' ').length === hanOf(lines[l.n - 1]!.zh).length) entry.py = py;
      else problems.push(`Line ${l.n}: the pinyin has a different number of syllables from the characters, so the app's is kept.`);
    }
    if (str(l.en)) entry.en = str(l.en);
    if (str(l.who)) entry.who = str(l.who);
    if (str(l.caption_doubt)) entry.doubt = str(l.caption_doubt);
    byLine[l.n] = entry;
  }

  const sentence = (v: unknown): PackSentence | null => {
    const s = obj(v);
    return s && str(s.zh) ? { zh: str(s.zh), py: str(s.py), en: str(s.en) } : null;
  };

  const words: PackWord[] = [];
  for (const x of arr(o.words)) {
    const w = obj(x);
    if (!w || !HAN.test(str(w.w))) {
      dropped++;
      continue;
    }
    const verdict: WordVerdict = w.verdict === 'learn_now' || w.verdict === 'skip' ? w.verdict : 'later';
    const hsk = typeof w.hsk === 'number' && w.hsk >= 1 && w.hsk <= 9 ? Math.round(w.hsk) : 'off-list';
    words.push({ w: str(w.w), py: str(w.py), en: str(w.en), hsk, lines: lineList(w.lines), verdict });
  }

  const pack: VideoPack = {
    at: now,
    lines: byLine,
    sandhi: arr(o.sandhi)
      .map(obj)
      .filter((s): s is Loose => !!s && okLine(s.n))
      .map((s) => ({ n: s.n as number, heard: str(s.heard), why: str(s.why) })),
    words,
    senses: arr(o.new_senses)
      .map(obj)
      .filter((s): s is Loose => !!s && HAN.test(str(s.w)))
      .map((s) => ({ w: str(s.w), en: str(s.en), lines: lineList(s.lines) })),
    grammar: arr(o.grammar)
      .map(obj)
      .filter((g): g is Loose => !!g && !!str(g.pattern))
      .map((g) => ({ pattern: str(g.pattern), lines: lineList(g.lines), explain: str(g.explain), example: sentence(g.example) ?? undefined })),
    notes: arr(o.notes)
      .map((n) => (typeof n === 'string' ? { text: n } : obj(n)))
      .filter((n): n is Loose => !!n && !!str(n.text))
      .map((n) => ({ text: str(n.text), lines: lineList(n.lines) })),
    listening: arr(o.listening)
      .map(obj)
      .filter((s): s is Loose => !!s && okLine(s.n))
      .map((s) => ({ n: s.n as number, why: str(s.why) })),
    questions: arr(o.questions)
      .map(obj)
      .map((q) => (q ? { q: sentence(q.q), answer: sentence(q.answer), lines: lineList(q.lines) } : null))
      .filter((q): q is { q: PackSentence; answer: PackSentence; lines: number[] } => !!q?.q && !!q.answer),
    extra: {
      sentences: arr(obj(o.extra)?.sentences)
        .map(sentence)
        .filter((s): s is PackSentence => !!s),
      topic: str(obj(o.extra)?.talk_topic) || undefined,
    },
  };
  const retell = obj(o.retell);
  if (retell && str(retell.zh))
    pack.retell = { zh: str(retell.zh), en: str(retell.en), words: arr(retell.words).map(str).filter(Boolean) };
  const level = obj(o.level);
  if (level && str(level.verdict)) pack.level = { verdict: str(level.verdict), why: str(level.why) };

  if (dropped) problems.push(`${dropped} entr${dropped === 1 ? 'y was' : 'ies were'} left out: a line number that is not in this part, or no Chinese.`);
  if (!Object.keys(byLine).length && !words.length && !pack.questions.length)
    return { pack: null, problems: ['The answer had none of the parts a study pack has.', ...problems] };
  return { pack, problems };
}

/** The pinyin a small "fix the pinyin" answer gives: its first line, when it fits the characters. */
export function readFixedPinyin(raw: string, zh: string): string | null {
  const first = raw
    .trim()
    .split('\n')[0]!
    .replace(/[`*"“”]/g, '')
    .replace(/^[^a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+/, '')
    .replace(/[,.;:!?，。？！]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return first && first.split(' ').length === hanOf(zh).length ? first : null;
}
