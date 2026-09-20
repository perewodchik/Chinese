import { DEFAULT_SCOPE, type Collection, type CollectionWord } from '../domain/collection';
import { isCharId, type ItemId } from '../domain/ids';
import {
  learnedFrom,
  spreadAsserted,
  SKILLS,
  type PrintedSheet,
  type Recall,
  type RecallBook,
  type SkillBook,
} from '../domain/memory';
import { DEFAULT_CHAR_SHEET, PER_PAGE_CHOICES, type SheetOptions } from '../domain/sheet';
import type { GeneratedText, TextLine, TextPlan, TextSet, TextSpec } from '../domain/text';
import { emptyListPlan, LIST_STEPS, type WordListPlan } from '../domain/wordlist';
import {
  isRadicalId,
  mergeRadicals,
  radicalsFrom,
  radicalsFromLegacy,
} from './radicalState';
import {
  DEFAULT_SETTINGS,
  emptyState,
  type AppSettings,
  type AppState,
  type PersistedState,
} from './state';

/**
 * Reading a stored workspace back, whichever version of the app wrote it.
 *
 * A document reaches this from the server, or from this browser's storage the
 * first time an account opens where the app used to keep everything locally.
 * Either way it may have been written by any build since the first one, so it
 * is read field by field and brought up to date rather than trusted.
 */

/* ------------------------------------------------------------ version 1 */

/**
 * What the app used to store: a flat list of templates, each one a fixed sheet,
 * with a `collection` string tying the parts of a ready-made set together.
 */
interface LegacyTemplate {
  id: string;
  name: string;
  kind: 'char' | 'radical';
  items: ItemId[];
  options: Partial<SheetOptions> & { density?: string };
  createdAt?: number;
  updatedAt?: number;
  collection?: string;
  note?: string;
}

interface LegacyState {
  version?: number;
  templates?: LegacyTemplate[];
  learned?: ItemId[];
  settings?: Record<string, unknown>;
}

const clampPerPage = (n: number | undefined) => {
  const lo = PER_PAGE_CHOICES[0];
  const hi = PER_PAGE_CHOICES[PER_PAGE_CHOICES.length - 1];
  return Math.min(hi, Math.max(lo, Math.round(n ?? DEFAULT_CHAR_SHEET.perPage)));
};

/**
 * Reads whatever a stored sheet has, and keeps only what a sheet still is.
 *
 * Two things have been taken out since: `density`, because how tightly a block
 * is set now follows from how many share the page, and the eight content
 * switches, because the same choice decides those too. Picking the fields by
 * hand rather than spreading means those never ride along in storage.
 */
function sheetFrom(o: Partial<SheetOptions> | undefined): SheetOptions {
  const base = DEFAULT_CHAR_SHEET;
  const p = o ?? {};
  return {
    perPage: clampPerPage(p.perPage),
    gridStyle: p.gridStyle ?? base.gridStyle,
    squareSize: p.squareSize ?? base.squareSize,
    practiceRows: p.practiceRows ?? base.practiceRows,
    traceCount: p.traceCount ?? base.traceCount,
    fadeCount: p.fadeCount ?? base.fadeCount,
    palette: p.palette ?? base.palette,
    style: p.style ?? base.style,
  };
}

/**
 * Fifteen "HSK 1 — Part n" templates become one HSK 1 collection.
 *
 * Order matters and the old parts carry it only in their names, so they are
 * stitched back together by creation time and then by name, which puts Part 2
 * after Part 1 without parsing the number out of a string the user may have
 * edited.
 */
function migrate(p: LegacyState): AppState {
  const templates = p.templates ?? [];
  const groups = new Map<string, LegacyTemplate[]>();
  for (const t of templates) {
    const key = t.collection ?? ` ${t.id}`;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }

  const collections: Collection[] = [];
  const radicalCollections: unknown[] = [];
  for (const [key, parts] of groups) {
    parts.sort(
      (a, b) =>
        (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.name.localeCompare(b.name),
    );
    const head = parts[0];
    const name = key.startsWith(' ') ? head.name : key;
    const seen = new Set<ItemId>();
    const items: ItemId[] = [];
    for (const part of parts) {
      for (const id of part.items) {
        if (!seen.has(id)) {
          seen.add(id);
          items.push(id);
        }
      }
    }
    if (head.kind === 'radical') {
      radicalCollections.push({ ...head, name, items });
      continue;
    }
    collections.push({
      id: head.id,
      name,
      items: items.filter(isCharId),
      sheet: sheetFrom(head.options),
      scope: { ...DEFAULT_SCOPE },
      createdAt: head.createdAt ?? Date.now(),
      updatedAt: head.updatedAt ?? Date.now(),
      note: head.note,
    });
  }

  const now = Date.now();
  const learned = p.learned ?? [];
  const recall = spreadIntoBook(learned.filter(isCharId), now);
  return {
    ...emptyState(),
    collections,
    recall,
    learned: learnedFrom(recall),
    radicals: radicalsFromLegacy(
      {
        collections: radicalCollections,
        known: learned.filter(isRadicalId).map((id) => ({ id, at: now })),
        limit: (p.settings as Loose | undefined)?.radicalLimit,
      },
      now,
    ),
    settings: settingsFrom(p.settings),
  };
}

/* ------------------------------------------------------------- version 2 */

type Loose = Record<string, unknown>;

const strOr = (v: unknown, fallback: string) =>
  typeof v === 'string' && v ? v : fallback;

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** The four old difficulty names, in the one dial that replaced them. */
const LEVEL_FROM_DIFFICULTY: Record<string, GeneratedText['level']> = {
  gentle: 'comfort',
  steady: 'edge',
  stretch: 'stretch',
  hard: 'beyond',
};

const levelOf = (v: Loose): GeneratedText['level'] =>
  (v.level as GeneratedText['level']) ??
  LEVEL_FROM_DIFFICULTY[String(v.difficulty)] ??
  'edge';

/**
 * A stored text, brought up to date.
 *
 * Texts written before the app taught anything have no `teach`, no grammar
 * notes and no difficulty. They are still perfectly good reading, so they are
 * filled in rather than dropped — an old text simply teaches nothing, which is
 * exactly what it did.
 */
function textFrom(v: unknown): GeneratedText | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Loose;
  const lines = arr<{ zh: string; py: string; en: string }>(t.lines);
  if (!lines.length || typeof t.id !== 'string') return null;
  return {
    id: t.id,
    setId: typeof t.setId === 'string' ? t.setId : undefined,
    title: strOr(t.title, 'Untitled'),
    titleZh: strOr(t.titleZh, strOr(t.title, '')),
    topic: strOr(t.topic, ''),
    length: (t.length as GeneratedText['length']) ?? 'medium',
    level: levelOf(t),
    genre: (t.genre as GeneratedText['genre']) ?? 'story',
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
    model: strOr(t.model, 'Claude'),
    lines,
    vocab: arr(t.vocab),
    questions: arr(t.questions),
    grammar: arr(t.grammar),
    note: strOr(t.note, ''),
    teach: arr<string>(t.teach).filter((c) => typeof c === 'string'),
    glosses:
      t.glosses && typeof t.glosses === 'object'
        ? (t.glosses as GeneratedText['glosses'])
        : {},
    basis: arr<string>(t.basis).filter((c) => typeof c === 'string'),
    read: t.read === true,
    // Texts stored before re-reading was counted have read it once, if at all.
    reads: typeof t.reads === 'number' ? t.reads : t.read === true ? 1 : 0,
    lastReadAt: typeof t.lastReadAt === 'number' ? t.lastReadAt : undefined,
  };
}

function setFrom(v: unknown): TextSet | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Loose;
  if (typeof s.id !== 'string') return null;
  return {
    id: s.id,
    name: strOr(s.name, 'Session'),
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
    note: typeof s.note === 'string' ? s.note : undefined,
  };
}

/** The session in progress. Anything malformed simply means no session. */
function planFrom(v: unknown): TextPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Loose;
  const specs = arr<Loose>(p.specs)
    .filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
    // Field by field: a plan stored before the rarity dial was folded into the
    // level would otherwise carry two dead keys around forever.
    .map(
      (s): TextSpec => ({
        id: String(s.id),
        topic: strOr(s.topic, ''),
        length: (s.length as TextSpec['length']) ?? 'medium',
        level: levelOf(s),
        genre: (s.genre as TextSpec['genre']) ?? 'story',
        newCount: typeof s.newCount === 'number' ? s.newCount : 5,
        questions: s.questions !== false,
        focus: strOr(s.focus, ''),
      }),
    );
  if (!specs.length) return null;
  return {
    id: strOr(p.id, 'plan'),
    name: strOr(p.name, 'Writing session'),
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
    setId: typeof p.setId === 'string' ? p.setId : null,
    basis: arr<string>(p.basis),
    basisSource: strOr(p.basisSource, 'learned'),
    basisCount: typeof p.basisCount === 'number' ? p.basisCount : 150,
    met: arr<string>(p.met),
    specs,
    response: strOr(p.response, ''),
    step: (p.step as TextPlan['step']) ?? 'plan',
    copiedAt: typeof p.copiedAt === 'number' ? p.copiedAt : undefined,
  };
}

/** A collection's explained words, with anything that is not one dropped. */
function wordsFrom(v: unknown): CollectionWord[] | undefined {
  const words = arr<Loose>(v)
    .filter((w) => w && typeof w === 'object' && typeof w.w === 'string' && w.w)
    .map(
      (w): CollectionWord => ({
        w: String(w.w),
        py: strOr(w.py, ''),
        d: strOr(w.d, ''),
        hsk: typeof w.hsk === 'number' ? w.hsk : null,
        explain: strOr(w.explain, ''),
        examples: arr<Loose>(w.examples)
          .filter((l) => l && typeof l === 'object' && typeof l.zh === 'string')
          .map((l): TextLine => ({ zh: String(l.zh), py: strOr(l.py, ''), en: strOr(l.en, '') })),
      }),
    );
  return words.length ? words : undefined;
}

/** The word list in progress. Anything malformed simply means none. */
function listPlanFrom(v: unknown): WordListPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Loose;
  if (typeof p.id !== 'string') return null;
  const base = emptyListPlan(p.id, finite(p.createdAt, Date.now()));
  const step = LIST_STEPS.find((s) => s.id === p.step)?.id ?? base.step;
  return {
    ...base,
    name: strOr(p.name, base.name),
    request: strOr(p.request, ''),
    size: finite(p.size, base.size),
    ceiling: finite(p.ceiling, base.ceiling),
    phrases: p.phrases !== false,
    lang: p.lang === 'ru' ? 'ru' : 'en',
    response: strOr(p.response, ''),
    step,
    copiedAt: typeof p.copiedAt === 'number' ? p.copiedAt : undefined,
  };
}

/**
 * Settings, field by field.
 *
 * Spreading whatever was stored would keep dead keys alive forever — the
 * Anthropic API key the reader used to need, for one, which should not linger
 * anywhere now that nothing sends it anywhere.
 */
function settingsFrom(v: unknown): AppSettings {
  const s = (v ?? {}) as Loose;
  const num = (x: unknown, fallback: number) =>
    typeof x === 'number' && Number.isFinite(x) ? x : fallback;
  return {
    theme: (s.theme as AppSettings['theme']) ?? DEFAULT_SETTINGS.theme,
    hskBand: num(s.hskBand, DEFAULT_SETTINGS.hskBand),
    footerNote: strOr(s.footerNote, DEFAULT_SETTINGS.footerNote),
    readerPalette:
      (s.readerPalette as AppSettings['readerPalette']) ?? DEFAULT_SETTINGS.readerPalette,
    readerStyle:
      (s.readerStyle as AppSettings['readerStyle']) ?? DEFAULT_SETTINGS.readerStyle,
    readerPractice: s.readerPractice !== false,
    practicePerPage: num(s.practicePerPage, DEFAULT_SETTINGS.practicePerPage),
    basisSource: strOr(s.basisSource, DEFAULT_SETTINGS.basisSource),
    basisCount: num(s.basisCount, DEFAULT_SETTINGS.basisCount),
    modelName: strOr(s.modelName, DEFAULT_SETTINGS.modelName),
    pitchChart: s.pitchChart !== false,
  };
}

/* ------------------------------------------------------------- version 3 */

const finite = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** One scheduling record, field by field, with anything unreadable dropped. */
function recallFrom(v: unknown, now: number): Recall | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Loose;
  const s = finite(r.s, 0);
  if (s <= 0) return null;
  return {
    s,
    d: Math.min(10, Math.max(1, finite(r.d, 5))),
    last: finite(r.last, now),
    due: finite(r.due, now),
    reps: Math.max(0, Math.round(finite(r.reps, 1))),
    lapses: Math.max(0, Math.round(finite(r.lapses, 0))),
  };
}

/**
 * The memory, from whatever was stored.
 *
 * Before version 4 there was no memory — there was a list of items you had
 * ticked. Those are not evidence of anything, so they are not treated as
 * evidence: each becomes a record marked believed-but-unverified, falling due
 * over the next three weeks rather than all at once, oldest tick first. The
 * first few review sessions after this migration are therefore an audit of
 * what you had claimed, which is the honest place to start.
 */
function memoryFrom(raw: unknown, learned: ItemId[], now: number): RecallBook {
  const stored = raw && typeof raw === 'object' ? (raw as Loose) : null;
  if (!stored) return spreadIntoBook(learned, now);

  const book: RecallBook = {};
  for (const id in stored) {
    // Radicals had records here when a tick was the only thing a radical could
    // have. They are known-or-not now, and their own slice keeps that.
    if (!isCharId(id)) continue;
    const entry = stored[id];
    if (!entry || typeof entry !== 'object') continue;
    const sk: SkillBook = {};
    for (const skill of SKILLS) {
      const r = recallFrom((entry as Loose)[skill], now);
      if (r) sk[skill] = r;
    }
    if (Object.keys(sk).length) book[id] = sk;
  }

  // A document written here, then ticked in an older build: anything on the
  // list with no record of its own still counts.
  const missing = learned.filter((id) => !book[id]?.recognise);
  if (missing.length) {
    const seeded = spreadAsserted(missing, now);
    for (const id in seeded) book[id] = { ...book[id], recognise: seeded[id] };
  }
  return book;
}

function spreadIntoBook(learned: ItemId[], now: number): RecallBook {
  const seeded = spreadAsserted(learned, now);
  const book: RecallBook = {};
  for (const id in seeded) book[id] = { recognise: seeded[id] };
  return book;
}

/**
 * Recall sheets that were printed and never marked.
 *
 * Dropped rather than repaired if anything is missing: an unmarked sheet is a
 * reminder, and a reminder you cannot act on is worse than none.
 */
function printedSheetFrom(v: unknown): PrintedSheet | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Loose;
  const items = arr<ItemId>(p.items).filter((i) => typeof i === 'string');
  if (typeof p.id !== 'string' || !items.length) return null;
  return {
    id: p.id,
    name: strOr(p.name, 'Recall sheet'),
    items,
    printedAt: finite(p.printedAt, Date.now()),
    gradedAt: typeof p.gradedAt === 'number' ? p.gradedAt : null,
  };
}

/* ------------------------------------------------------------------- io */

/**
 * Radicals a document written before they had a slice of their own is carrying
 * among the characters: a tick in the learned list, or the record that ticking
 * one made in the review book.
 */
function legacyKnownRadicals(raw: unknown, learned: unknown[], now: number) {
  const out: Array<{ id: string; at: number }> = [];
  const stored = raw && typeof raw === 'object' ? (raw as Loose) : {};
  for (const id in stored) {
    if (!isRadicalId(id)) continue;
    const claim = recallFrom((stored[id] as Loose | undefined)?.recognise, now);
    if (claim) out.push({ id, at: claim.last });
  }
  for (const id of learned) if (isRadicalId(id)) out.push({ id, at: now });
  return out;
}

/** Any stored workspace, of any version, as the state the app works with. Never throws. */
export function hydrate(raw: unknown): AppState {
  const p = raw as PersistedState & LegacyState;
  if (!p || typeof p !== 'object') return emptyState();
  if (!Array.isArray(p.collections)) return migrate(p);

  const now = Date.now();
  const learned = arr<ItemId>(p.learned);
  const recall = memoryFrom(p.recall, learned.filter(isCharId), now);
  const stored = p.collections as Array<Collection & { kind?: string }>;

  // Before version 6 a radical collection was a collection like any other, and
  // a radical you had ticked sat in the learned list beside the characters.
  // Both move into the radical slice, and nothing here reads them again.
  const legacy = radicalsFromLegacy(
    {
      collections: stored.filter((c) => c?.kind === 'radical'),
      known: legacyKnownRadicals(p.recall, learned, now),
      limit: (p.settings as Loose | undefined)?.radicalLimit,
    },
    now,
  );

  return {
    collections: stored
      .filter((c) => c && typeof c === 'object' && c.kind !== 'radical')
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: arr<ItemId>(c.items).filter(isCharId),
        sheet: sheetFrom(c.sheet),
        scope: { ...DEFAULT_SCOPE, ...(c.scope ?? {}) },
        createdAt: finite(c.createdAt, now),
        updatedAt: finite(c.updatedAt, now),
        presetId: c.presetId,
        note: c.note,
        words: wordsFrom(c.words),
        brief: typeof c.brief === 'string' && c.brief ? c.brief : undefined,
      })),
    recall,
    sheets: arr<unknown>(p.sheets)
      .map(printedSheetFrom)
      .filter((x): x is PrintedSheet => x !== null),
    learned: learnedFrom(recall),
    texts: arr<unknown>(p.texts)
      .map(textFrom)
      .filter((t): t is GeneratedText => t !== null),
    sets: arr<unknown>(p.sets)
      .map(setFrom)
      .filter((s): s is TextSet => s !== null),
    plan: planFrom(p.plan),
    listPlan: listPlanFrom(p.listPlan),
    radicals: p.radicals ? mergeRadicals(radicalsFrom(p.radicals, now), legacy) : legacy,
    settings: settingsFrom(p.settings),
  };
}

export function serialise(s: AppState): PersistedState {
  return {
    version: 6,
    collections: s.collections,
    recall: s.recall,
    sheets: s.sheets,
    // Written out as well as the memory it comes from, so a document written
    // here still opens in a build that has never heard of scheduling.
    learned: [...s.learned],
    texts: s.texts,
    sets: s.sets,
    plan: s.plan,
    listPlan: s.listPlan,
    radicals: s.radicals,
    settings: s.settings,
  };
}
