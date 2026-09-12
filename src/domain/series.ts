import type { CharacterEntry, Library } from '../data/types';
import { withoutTone } from './drill';
import { unlockCount } from './vocab';

/**
 * Sound families, and what you are ready for.
 *
 * Somewhere around four fifths of Chinese characters are 形声字: one part for
 * the meaning, one part for the sound. The app has carried that fact per
 * character since the first build — 1,798 of the three thousand name a
 * phonetic component — and has only ever used it to print one line at the
 * bottom of a block.
 *
 * Read the other way round it is the most useful structure an adult learner
 * has. 青 qīng gives 请 qǐng, 清 qīng, 情 qíng, 晴 qíng, 睛 jīng: five
 * characters that are one fact, not five. Meeting them together is worth more
 * than meeting them a year apart in frequency order, and it is the difference
 * between three thousand arbitrary shapes and a few hundred families.
 */

export interface SeriesMember {
  c: string;
  py: string;
  def: string;
  hsk: number;
  /** the reading matches the sound part's own, tone aside */
  keeps: boolean;
}

export interface Series {
  /** the shared sound part */
  phonetic: string;
  /** how the sound part itself is read, when it is a character in its own right */
  py: string | null;
  members: SeriesMember[];
  /** how many members keep the sound part's reading */
  kept: number;
}

const cache = new WeakMap<Library, Map<string, Series>>();

const bare = (py: string) => withoutTone(py).replace(/\s+/g, '').toLowerCase();

function build(lib: Library): Map<string, Series> {
  const groups = new Map<string, CharacterEntry[]>();
  for (const c of lib.characters) {
    const p = c.ety?.phonetic;
    if (!p) continue;
    const list = groups.get(p);
    if (list) list.push(c);
    else groups.set(p, [c]);
  }

  const out = new Map<string, Series>();
  for (const [phonetic, members] of groups) {
    // How the sound part sounds: as a character in its own right where the
    // syllabus has one, otherwise from the component table.
    const own =
      lib.byChar.get(phonetic)?.py[0] ?? lib.components[phonetic]?.py ?? null;
    const rows = members
      .sort((a, b) => a.hsk - b.hsk || a.i - b.i)
      .map((c) => ({
        c: c.c,
        py: c.py[0] ?? '',
        def: c.def,
        hsk: c.hsk,
        keeps: Boolean(own && c.py[0] && bare(c.py[0]) === bare(own)),
      }));
    out.set(phonetic, {
      phonetic,
      py: own,
      members: rows,
      kept: rows.filter((r) => r.keeps).length,
    });
  }
  cache.set(lib, out);
  return out;
}

export function seriesIndex(lib: Library): Map<string, Series> {
  return cache.get(lib) ?? build(lib);
}

/** The family one character belongs to, if it belongs to one worth showing. */
export function seriesFor(lib: Library, char: string): Series | null {
  const p = lib.byChar.get(char)?.ety?.phonetic;
  if (!p) return null;
  const s = seriesIndex(lib).get(p);
  // A family of one is not a family; it is just a character with a note.
  return s && s.members.length > 1 ? s : null;
}

/** Every family with at least `min` members, largest first. */
export function allSeries(lib: Library, min = 3): Series[] {
  return [...seriesIndex(lib).values()]
    .filter((s) => s.members.length >= min)
    .sort((a, b) => b.members.length - a.members.length);
}

/* ------------------------------------------------------------ what is next */

export interface ReadyCharacter {
  entry: CharacterEntry;
  /** words it would complete out of characters already known */
  unlocks: number;
}

/**
 * Characters every part of which you can already write.
 *
 * The app already scores this when it picks what a reading passage should
 * teach, and then throws the ordering away. Exposed instead, it is the most
 * useful list in the library: not "what comes next in the syllabus" but "what
 * costs you almost nothing today, because you already know both halves".
 *
 * Ordered by what each one *unlocks* — how many words it completes out of
 * characters you have — rather than by raw frequency, because a middling
 * character that finishes nine half-known words is worth more than a common
 * one that finishes none.
 */
export function readyToLearn(
  lib: Library,
  known: ReadonlySet<string>,
  limit = 200,
): ReadyCharacter[] {
  const out: ReadyCharacter[] = [];
  for (const c of lib.characters) {
    if (known.has(c.c)) continue;
    if (!c.parts.length || c.parts.length === 1) continue;
    if (!c.parts.every((p) => known.has(p) || Boolean(lib.components[p]))) continue;
    // Every part is either a character you know or a component the app can
    // name — the second is what stops this collapsing to nothing early on.
    const familiar = c.parts.filter((p) => known.has(p)).length;
    if (familiar < c.parts.length) continue;
    out.push({ entry: c, unlocks: unlockCount(lib, c.c, known) });
  }
  return out
    .sort(
      (a, b) =>
        b.unlocks - a.unlocks ||
        (a.entry.freq || 99999) - (b.entry.freq || 99999),
    )
    .slice(0, limit);
}
