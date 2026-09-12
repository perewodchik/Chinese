import {
  DEFAULT_RADICAL_SCOPE,
  type KnownRadicals,
  type RadicalScope,
  type RadicalScopeMode,
  type RadicalSet,
} from '../domain/radicals/sets';
import {
  clampRadicalPerPage,
  DEFAULT_RADICAL_SHEET,
  type RadicalSheet,
} from '../domain/radicals/sheet';

/**
 * The part of storage that belongs to radicals.
 *
 * It travels in the same backup as everything else, so one Export still saves
 * the lot, but nothing outside this slice reads it and it reads nothing outside
 * itself. Marking 氵 known says nothing about the character 水, and no
 * character's review schedule ever sees a radical.
 */
export interface RadicalState {
  sets: RadicalSet[];
  known: KnownRadicals;
  /** how many of the most used radicals the browser shows, or 0 for all 214 */
  limit: number;
}

export const emptyRadicals = (): RadicalState => ({ sets: [], known: {}, limit: 50 });

type Loose = Record<string, unknown>;

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const obj = (v: unknown): Loose => (v && typeof v === 'object' ? (v as Loose) : {});

/** A radical number from either shape it has been stored in: 61, or "r61". */
function radicalNumber(v: unknown): number | null {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string' && /^r?\d+$/.test(v)
        ? Number(v.replace('r', ''))
        : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 214 ? n : null;
}

export const isRadicalId = (id: unknown): id is string =>
  typeof id === 'string' && /^r\d+$/.test(id);

/** A stored radical sheet, field by field, snapped to what is offered now. */
function sheetFrom(v: unknown): RadicalSheet {
  const p = obj(v) as Partial<RadicalSheet>;
  const base = DEFAULT_RADICAL_SHEET;
  return {
    perPage: clampRadicalPerPage(p.perPage),
    gridStyle: p.gridStyle ?? base.gridStyle,
    squareSize: p.squareSize ?? base.squareSize,
    practiceRows: num(p.practiceRows, base.practiceRows),
    traceCount: num(p.traceCount, base.traceCount),
    fadeCount: num(p.fadeCount, base.fadeCount),
    palette: p.palette ?? base.palette,
    style: p.style ?? base.style,
  };
}

/**
 * A stored scope. "Not yet learned" on an old radical collection is "not known
 * yet" here; "due" and "the ones I miss" were never meaningful for a radical,
 * which was never reviewed, and become everything.
 */
const MODE: Record<string, RadicalScopeMode> = {
  all: 'all',
  unknown: 'unknown',
  unlearned: 'unknown',
  range: 'range',
};

function scopeFrom(v: unknown): RadicalScope {
  const s = obj(v);
  return {
    mode: MODE[String(s.mode)] ?? 'all',
    from: Math.max(1, Math.round(num(s.from, DEFAULT_RADICAL_SCOPE.from))),
    count: Math.max(1, Math.round(num(s.count, DEFAULT_RADICAL_SCOPE.count))),
  };
}

function setFrom(v: unknown, now: number): RadicalSet | null {
  const s = obj(v);
  if (typeof s.id !== 'string') return null;
  const items: number[] = [];
  for (const x of Array.isArray(s.items) ? s.items : []) {
    const n = radicalNumber(x);
    if (n !== null && !items.includes(n)) items.push(n);
  }
  return {
    id: s.id,
    name: typeof s.name === 'string' && s.name ? s.name : 'Radicals',
    items,
    // An old radical collection kept its look under `sheet`, an old template
    // under `options`.
    sheet: sheetFrom(s.sheet ?? s.options),
    scope: scopeFrom(s.scope),
    createdAt: num(s.createdAt, now),
    updatedAt: num(s.updatedAt, now),
    presetId: typeof s.presetId === 'string' ? s.presetId : undefined,
  };
}

const setsFrom = (list: unknown, now: number) =>
  (Array.isArray(list) ? list : [])
    .map((x) => setFrom(x, now))
    .filter((x): x is RadicalSet => x !== null);

/** The slice as this version stores it, field by field. */
export function radicalsFrom(v: unknown, now = Date.now()): RadicalState {
  const r = obj(v);
  const known: KnownRadicals = {};
  for (const [k, at] of Object.entries(obj(r.known))) {
    const n = radicalNumber(k);
    if (n !== null && typeof at === 'number' && Number.isFinite(at)) known[n] = at;
  }
  return {
    sets: setsFrom(r.sets, now),
    known,
    limit: num(r.limit, emptyRadicals().limit),
  };
}

/**
 * Radicals as versions before 6 stored them, lifted out of the places they
 * used to share with characters: radical collections among the collections,
 * `r61` ids in the learned list and the review book, and the library's radical
 * filter among the settings.
 *
 * A radical that had been ticked carries over as known, dated by the tick. It
 * had a review record only because ticking made one; no drill ever asked about
 * a radical, so there is no evidence to keep beyond the claim itself.
 */
export function radicalsFromLegacy(
  legacy: {
    collections: unknown[];
    known: Array<{ id: string; at: number }>;
    limit?: unknown;
  },
  now = Date.now(),
): RadicalState {
  const known: KnownRadicals = {};
  for (const { id, at } of legacy.known) {
    const n = radicalNumber(id);
    if (n !== null) known[n] = Math.min(known[n] ?? Infinity, at);
  }
  return {
    sets: setsFrom(legacy.collections, now),
    known,
    limit: num(legacy.limit, emptyRadicals().limit),
  };
}

/** Folds legacy radicals into a stored slice, keeping everything the slice has. */
export function mergeRadicals(stored: RadicalState, legacy: RadicalState): RadicalState {
  const ids = new Set(stored.sets.map((s) => s.id));
  return {
    sets: [...stored.sets, ...legacy.sets.filter((s) => !ids.has(s.id))],
    known: { ...legacy.known, ...stored.known },
    limit: stored.limit,
  };
}
