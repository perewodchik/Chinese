import {
  coverageOf,
  hanziIn,
  isHanzi,
  type GeneratedText,
  type GrammarNote,
  type TextLine,
  type TextPlan,
  type TextSpec,
  type TextWord,
} from './text';

/**
 * Reading Claude's reply.
 *
 * This is the part of the feature that has to be forgiving, because it is the
 * part a person operates by hand. What arrives on the clipboard might be a
 * clean JSON block; it might also have a sentence of preamble, a trailing
 * "hope this helps", smart quotes, a trailing comma, a comment, a literal
 * newline inside a string, or a reply that ran out of room halfway through the
 * fourth passage. All of those are recoverable, and refusing them would send
 * the reader back to the chat window for no good reason.
 *
 * The order of attack is: parse the code block, parse the whole thing, repair
 * and retry, and finally go looking for individual passage objects wherever
 * they are. Only then does it give up.
 */

export type Route = 'clean' | 'repaired' | 'salvaged' | 'none';

/** A character the writer says it introduced, with its own gloss. */
export interface TaughtChar {
  c: string;
  py: string;
  d: string;
}

export interface DraftText {
  /** the brief this answers, if it said */
  specId: string | null;
  title: string;
  titleZh: string;
  /** what the writer says it taught */
  teach: TaughtChar[];
  lines: TextLine[];
  vocab: TextWord[];
  questions: TextLine[];
  grammar: GrammarNote[];
  note: string;
}

export interface ParseResult {
  drafts: DraftText[];
  route: Route;
  problems: string[];
}

/* ----------------------------------------------------------- json finding */

/** Every fenced block in the reply, closed or not. */
export function fences(raw: string): string[] {
  const out: string[] = [];
  const re = /```[a-zA-Z]*\s*\n([\s\S]*?)(?:```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) if (m[1].trim()) out.push(m[1]);
  return out;
}

/**
 * One pass over the text that fixes the four things models actually get wrong
 * in JSON: comments, trailing commas, raw control characters inside strings,
 * and curly quotes standing in for the straight ones around a key or value.
 *
 * It is string-aware, so a comma inside a sentence and a `//` inside a URL are
 * left alone — and Chinese curly quotes inside a string, which are ordinary
 * punctuation here, are never touched.
 */
function repair(src: string): string {
  const s = src.replace(/[\uFEFF\u200B-\u200D]/g, '').replace(/\u00A0/g, ' ');
  // Built as pieces rather than one growing string: the trailing-comma fix has
  // to reach backwards, and doing that to a 50KB string at every closing brace
  // is how reading a paste starts taking a visible second.
  const out: string[] = [];
  let inString = false;
  let escape = false;

  /** Index of the last piece that is not whitespace, or -1. */
  const lastSolid = () => {
    let k = out.length - 1;
    while (k >= 0 && (out[k] === '' || /^\s*$/.test(out[k]))) k--;
    return k;
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inString) {
      if (escape) {
        out.push(c);
        escape = false;
        continue;
      }
      if (c === '\\') {
        out.push(c);
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        out.push(c);
        continue;
      }
      // A literal newline inside a string is invalid JSON, and a very common
      // way for a long English sentence to come back wrapped.
      if (c === '\n') {
        out.push('\\n');
        continue;
      }
      if (c === '\r') continue;
      if (c === '\t') {
        out.push('\\t');
        continue;
      }
      out.push(c);
      continue;
    }

    // Outside a string.
    if (c === '"') {
      inString = true;
      out.push(c);
      continue;
    }
    // A curly quote where a straight one belongs — but only where a string can
    // legally start, so the ones inside Chinese dialogue are never touched.
    if (c === '“' || c === '”') {
      const k = lastSolid();
      const prev = k < 0 ? '' : out[k];
      if (prev === '' || '{[:,'.includes(prev)) {
        inString = true;
        out.push('"');
        continue;
      }
    }
    if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      out.push('\n');
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (c === '}' || c === ']') {
      const k = lastSolid();
      if (k >= 0 && out[k] === ',') out[k] = '';
      out.push(c);
      continue;
    }
    out.push(c);
  }

  // A reply that stopped mid-sentence: close what is still open, so at least
  // the passages before the cut survive.
  if (inString) out.push('"');
  return out.join('');
}

export function tryParse(text: string): { value: unknown; repaired: boolean } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return { value: JSON.parse(trimmed), repaired: false };
  } catch {
    /* fall through to the repair pass */
  }
  try {
    return { value: JSON.parse(repair(trimmed)), repaired: true };
  } catch {
    return null;
  }
}

/** Walks from `start` to the brace that closes it, ignoring braces in strings. */
export function balancedEnd(s: string, start: number): number {
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

/** The outermost JSON-looking spans in a blob of prose. */
export function spans(raw: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{' && raw[i] !== '[') continue;
    const end = balancedEnd(raw, i);
    if (end < 0) {
      out.push(raw.slice(i));
      break;
    }
    out.push(raw.slice(i, end + 1));
    i = end;
  }
  return out;
}

/**
 * Last resort: pull individual passage objects out of the text, wherever they
 * are, ignoring whatever container was meant to hold them. This is what saves
 * a reply that was cut off — the finished passages parse, the half-written one
 * does not, and nothing else is lost.
 */
function salvage(raw: string): unknown[] {
  const out: unknown[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '{') continue;
    const peek = raw.slice(i, i + 400);
    if (!/"(lines|zh|title|titleZh|id)"\s*:/.test(peek)) continue;
    const end = balancedEnd(raw, i);
    const body = end < 0 ? raw.slice(i) : raw.slice(i, end + 1);
    const parsed = tryParse(body);
    if (parsed && asText(parsed.value)) {
      out.push(parsed.value);
      if (end < 0) break;
      i = end;
    }
  }
  return out;
}

/* ------------------------------------------------------------ normalising */

export type Bag = Record<string, unknown>;

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const pick = (o: Bag, ...keys: string[]): string => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return '';
};

export const arrayOf = (o: Bag, ...keys: string[]): unknown[] => {
  for (const k of keys) if (Array.isArray(o[k])) return o[k] as unknown[];
  return [];
};

export function asLine(v: unknown): TextLine | null {
  if (typeof v === 'string') {
    return hanziIn(v).length ? { zh: v.trim(), py: '', en: '' } : null;
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Bag;
  const zh = pick(o, 'zh', 'hanzi', 'chinese', 'cn', 'text', 'sentence', 'q');
  if (!zh || !hanziIn(zh).length) return null;
  return {
    zh,
    py: pick(o, 'py', 'pinyin', 'p', 'reading'),
    en: pick(o, 'en', 'english', 'translation', 'tr', 'meaning'),
  };
}

function asWord(v: unknown): TextWord | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Bag;
  const w = pick(o, 'w', 'word', 'hanzi', 'zh', 'term');
  if (!w) return null;
  return {
    w,
    py: pick(o, 'py', 'pinyin', 'p', 'reading'),
    d: pick(o, 'd', 'def', 'definition', 'meaning', 'en', 'english'),
    isNew: o.new === true || o.isNew === true,
  };
}

function asGrammar(v: unknown): GrammarNote | null {
  if (typeof v === 'string') return v.trim() ? { point: v.trim(), zh: '', en: '' } : null;
  if (!v || typeof v !== 'object') return null;
  const o = v as Bag;
  const point = pick(o, 'point', 'name', 'title', 'grammar', 'pattern', 'note');
  if (!point) return null;
  return {
    point,
    zh: pick(o, 'zh', 'example', 'hanzi', 'sentence'),
    en: pick(o, 'en', 'english', 'translation', 'explanation'),
  };
}

function asTaught(v: unknown): TaughtChar | null {
  if (typeof v === 'string') {
    const c = [...v].find(isHanzi);
    return c ? { c, py: '', d: '' } : null;
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as Bag;
  const raw = pick(o, 'c', 'char', 'character', 'hanzi', 'zh', 'w');
  const c = [...raw].find(isHanzi);
  if (!c) return null;
  return {
    c,
    py: pick(o, 'py', 'pinyin', 'p', 'reading'),
    d: pick(o, 'd', 'def', 'definition', 'meaning', 'en', 'english', 'gloss'),
  };
}

function asText(v: unknown): DraftText | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Bag;
  const lines = arrayOf(o, 'lines', 'passage', 'sentences', 'text', 'body')
    .map(asLine)
    .filter((l): l is TextLine => l !== null);
  if (!lines.length) return null;

  const id = pick(o, 'id', 'specId', 'ref', 'key');
  return {
    specId: id || null,
    title: pick(o, 'title', 'titleEn', 'englishTitle') || 'Untitled',
    titleZh: pick(o, 'titleZh', 'title_zh', 'chineseTitle', 'zhTitle'),
    teach: arrayOf(o, 'teach', 'newCharacters', 'new', 'taught', 'characters')
      .map(asTaught)
      .filter((t): t is TaughtChar => t !== null),
    lines,
    vocab: arrayOf(o, 'vocab', 'words', 'vocabulary', 'newWords')
      .map(asWord)
      .filter((w): w is TextWord => w !== null),
    questions: arrayOf(o, 'questions', 'qs', 'comprehension')
      .map(asLine)
      .filter((l): l is TextLine => l !== null),
    grammar: arrayOf(o, 'grammar', 'grammarNotes', 'points', 'notes')
      .map(asGrammar)
      .filter((g): g is GrammarNote => g !== null),
    note: pick(o, 'note', 'teacherNote', 'advice', 'comment', 'tip'),
  };
}

/** Pulls every passage out of one parsed value, whatever it is wrapped in. */
function harvest(v: unknown, out: DraftText[], seen: Set<string>) {
  if (Array.isArray(v)) {
    v.forEach((x) => harvest(x, out, seen));
    return;
  }
  if (!v || typeof v !== 'object') return;
  const o = v as Bag;
  const nested = ['texts', 'passages', 'items', 'results', 'output', 'data'].find((k) =>
    Array.isArray(o[k]),
  );
  if (nested) {
    harvest(o[nested], out, seen);
    return;
  }
  const t = asText(o);
  if (!t) {
    // Not a passage: look inside. Whatever container the model reached for —
    // `{"result": {"texts": …}}`, one object per passage keyed by its id — the
    // passages are somewhere in there, and finding them costs one walk.
    for (const child of Object.values(o)) {
      if (child && typeof child === 'object') harvest(child, out, seen);
    }
    return;
  }
  const key = `${t.specId ?? ''}|${t.titleZh || t.title}|${t.lines[0]?.zh ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(t);
}

/* ---------------------------------------------------------------- parsing */

export function parseResponse(raw: string): ParseResult {
  const problems: string[] = [];
  if (!raw.trim()) return { drafts: [], route: 'none', problems: [] };

  const drafts: DraftText[] = [];
  const seen = new Set<string>();
  let route: Route = 'none';

  // Every fenced block, not just the first: a long answer often arrives as two
  // messages, and pasting both one after the other should simply work.
  for (const c of fences(raw)) {
    const parsed = tryParse(c);
    if (!parsed) continue;
    const before = drafts.length;
    harvest(parsed.value, drafts, seen);
    if (drafts.length > before && route !== 'repaired') {
      route = parsed.repaired ? 'repaired' : 'clean';
    }
  }

  if (!drafts.length) {
    for (const c of [raw, ...spans(raw)]) {
      const parsed = tryParse(c);
      if (!parsed) continue;
      harvest(parsed.value, drafts, seen);
      if (drafts.length) {
        route = parsed.repaired ? 'repaired' : 'clean';
        break;
      }
    }
  }

  if (!drafts.length) {
    for (const v of salvage(raw)) harvest(v, drafts, seen);
    if (drafts.length) {
      route = 'salvaged';
      problems.push(
        'The reply was not valid JSON end to end, so the passages were read out of it one at a time. Check each one below before saving.',
      );
    }
  }

  if (!drafts.length) {
    problems.push(
      'No passages found. Paste Claude’s whole reply, including the ```json block — or ask it to send the JSON again.',
    );
  }

  return { drafts, route, problems };
}

/* --------------------------------------------------------------- matching */

const normId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface Match {
  draft: DraftText;
  /** the brief it answers, when one could be found */
  spec: TextSpec | null;
}

/**
 * Ties each passage back to the brief it was written for.
 *
 * By id first, because that is what the prompt asked for, then by position for
 * the ones that lost their id on the way. Position is a fair guess: the prompt
 * lists the briefs in order and models answer in order.
 */
export function matchToSpecs(drafts: DraftText[], specs: TextSpec[]): Match[] {
  const byId = new Map(specs.map((s) => [normId(s.id), s]));
  const used = new Set<string>();
  const out: Match[] = drafts.map((draft) => {
    const spec = draft.specId ? byId.get(normId(draft.specId)) : undefined;
    if (spec && !used.has(spec.id)) {
      used.add(spec.id);
      return { draft, spec };
    }
    return { draft, spec: null };
  });

  const spare = specs.filter((s) => !used.has(s.id));
  for (const m of out) {
    if (m.spec) continue;
    const next = spare.shift();
    if (next) {
      m.spec = next;
      used.add(next.id);
    }
  }
  return out;
}

/**
 * Turns a matched passage into the text the app stores.
 *
 * What counts as new is decided here, not taken on trust: every character in
 * the passage that was in neither the inventory nor the "already met" list is
 * new, in the order the passage introduces it. The writer's own list is used
 * for its glosses — it knows what it meant by a character the library has
 * never heard of — but it does not get to leave one out.
 */
export function toText(
  match: Match,
  plan: TextPlan,
  model: string,
): Omit<GeneratedText, 'id' | 'createdAt' | 'read'> {
  const { draft, spec } = match;
  const basis = [...new Set([...plan.basis, ...plan.met])];
  const known = new Set(basis);
  const cover = coverageOf(draft, known);
  const teach = cover.fresh;
  const fresh = new Set(teach);

  const glosses: Record<string, { py: string; d: string }> = {};
  for (const t of draft.teach) {
    if (fresh.has(t.c) && (t.py || t.d)) glosses[t.c] = { py: t.py, d: t.d };
  }

  return {
    setId: undefined,
    title: draft.title,
    titleZh: draft.titleZh || draft.title,
    topic: spec?.topic.trim() || draft.title,
    length: spec?.length ?? 'medium',
    level: spec?.level ?? 'edge',
    genre: spec?.genre ?? 'story',
    model,
    lines: draft.lines,
    vocab: draft.vocab.map((w) => ({
      ...w,
      // Trust the flag, but check it: a word is new if it is built from a
      // character that was new in this passage.
      isNew: w.isNew || [...w.w].some((c) => fresh.has(c)),
    })),
    questions: draft.questions,
    grammar: draft.grammar,
    note: draft.note,
    teach,
    glosses,
    basis,
  };
}
