/**
 * A radical's family: every character it grows into, and how.
 *
 * The data (public/data/families.json, from scripts/build_families.py) is a
 * list of steps per radical — [child, parent, role] — where the first
 * generation's parents are the radical's own forms: 讠 → 说, 口 → 吾 → 语.
 * This turns those steps into the tree a page draws, cut down to the bands the
 * learner has asked for.
 *
 * The role is the point of the whole thing. A radical is in a character for
 * one of three reasons: it says what the character is about (氵 in 河, 洗,
 * 游 — they are wet), it says how the character sounds (马 in 妈 and 吗, which
 * have nothing to do with horses), or it is only there as a shape. The first
 * two are families you can learn from; the page draws them apart.
 */

/** What a part does in the character it goes into. */
export type FamilyRole = 'meaning' | 'sound' | 'shape';

export const ROLE_OF: Record<string, FamilyRole> = { m: 'meaning', s: 'sound', p: 'shape' };

/** One step: `child` is built with `parent` in it, doing `role`. */
export type FamilyEdge = [child: string, parent: string, role: 'm' | 's' | 'p'];

export interface FamilyData {
  /** steps that are not syllabus characters: 吾 on the way from 口 to 语 */
  parts: Record<string, { py: string; d: string }>;
  /** by Kangxi number */
  trees: Record<string, FamilyEdge[]>;
}

/** What the tree needs to know about a syllabus character. */
export interface CharFacts {
  hsk: number;
  py: string;
  gloss: string;
  /** Jun Da rank; lower is commoner */
  freq: number;
}

export interface FamilyNode {
  g: string;
  /** a syllabus character, or only a part on the way to one */
  kind: 'char' | 'part';
  /** what its parent does in it: 马 gives 妈 its sound */
  role: FamilyRole;
  hsk: number | null;
  py: string;
  gloss: string;
  /** a syllabus character above the band asked for, kept because a character in the band is built on it */
  above: boolean;
  children: FamilyNode[];
}

export interface FamilyBranch {
  /** the form of the radical this branch grows from: 忄, 心 or ⺗ */
  form: string;
  nodes: FamilyNode[];
}

export interface FamilySection {
  role: FamilyRole;
  branches: FamilyBranch[];
  /** syllabus characters in the band, anywhere below this section */
  count: number;
}

export interface Family {
  sections: FamilySection[];
  /** syllabus characters in the band, in the whole tree */
  count: number;
  /** the forms that have anything under them, in the order the radical lists them */
  forms: string[];
}

const ROLE_ORDER: FamilyRole[] = ['meaning', 'sound', 'shape'];

/**
 * The family of one radical, up to `band` (7 = everything).
 *
 * A syllabus character above the band is left out unless something in the
 * band is built on it — then it stays, marked `above`, because the path is
 * the lesson: 语 is under 吾 whether or not 吾 is on anybody's list. A part
 * that is not a syllabus character stays on the same terms.
 */
export function familyOf(
  edges: readonly FamilyEdge[],
  forms: readonly string[],
  facts: (g: string) => CharFacts | null,
  parts: FamilyData['parts'],
  band: number,
): Family {
  const byParent = new Map<string, FamilyEdge[]>();
  for (const e of edges) {
    const list = byParent.get(e[1]);
    if (list) list.push(e);
    else byParent.set(e[1], [e]);
  }

  const build = (edge: FamilyEdge, seen: Set<string>): FamilyNode | null => {
    const [g, , r] = edge;
    if (seen.has(g)) return null;
    const next = new Set(seen).add(g);
    const children = (byParent.get(g) ?? [])
      .map((e) => build(e, next))
      .filter((n): n is FamilyNode => n !== null)
      .sort(byRoleThenBand);
    const f = facts(g);
    const inBand = f !== null && f.hsk <= band;
    if (!inBand && children.length === 0) return null;
    const part = parts[g];
    return {
      g,
      kind: f ? 'char' : 'part',
      role: ROLE_OF[r] ?? 'shape',
      hsk: f?.hsk ?? null,
      py: f?.py ?? part?.py ?? '',
      gloss: f?.gloss ?? part?.d ?? '',
      above: f !== null && !inBand,
      children,
    };
  };

  const byRoleThenBand = (a: FamilyNode, b: FamilyNode) =>
    ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
    (a.kind === b.kind ? 0 : a.kind === 'char' ? -1 : 1) ||
    (a.hsk ?? 99) - (b.hsk ?? 99) ||
    (facts(a.g)?.freq ?? 1e9) - (facts(b.g)?.freq ?? 1e9);

  const sections: FamilySection[] = [];
  const used = new Set<string>();
  for (const role of ROLE_ORDER) {
    const branches: FamilyBranch[] = [];
    for (const form of forms) {
      const nodes = (byParent.get(form) ?? [])
        .filter((e) => (ROLE_OF[e[2]] ?? 'shape') === role)
        .map((e) => build(e, new Set([form])))
        .filter((n): n is FamilyNode => n !== null)
        .sort(byRoleThenBand);
      if (nodes.length) {
        branches.push({ form, nodes });
        used.add(form);
      }
    }
    if (branches.length) {
      sections.push({ role, branches, count: branches.reduce((a, b) => a + countIn(b.nodes), 0) });
    }
  }

  return {
    sections,
    count: sections.reduce((a, s) => a + s.count, 0),
    forms: forms.filter((f) => used.has(f)),
  };
}

/** Syllabus characters inside the band, in these nodes and under them. */
export function countIn(nodes: readonly FamilyNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === 'char' && !node.above) n++;
    n += countIn(node.children);
  }
  return n;
}

/** The first sense of a definition, short enough for a tile. */
export function shortGloss(def: string): string {
  const first = def.split(/[;,]/)[0]?.trim() ?? '';
  return first.slice(0, 26);
}
