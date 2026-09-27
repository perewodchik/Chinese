/**
 * Passages that are more than prose: stories with choices in them, and
 * scenes drawn beside the paragraphs.
 *
 * Both arrive in the same JSON the writer already sends back — pasted on the
 * iPad, or fetched on the computer — so neither needs anything but text. Both
 * are read defensively: a story that does not hold together is dropped and
 * the passage reads as prose; a scene with a thing the app has no photo of
 * loses that thing and keeps the rest.
 *
 * A branching story keeps every one of its sentences in the passage's `lines`,
 * each tagged with the node it belongs to. That way everything that works on
 * lines — the coverage check, the new characters, reading aloud, the word
 * drawer — works on a story unchanged; the reader only has to decide which
 * nodes' lines to show.
 */

import type { TextLine } from './text';

/* ------------------------------------------------------------------ story */

export interface StoryChoice {
  zh: string;
  py: string;
  en: string;
  /** the node it leads to */
  to: string;
}

export interface StoryNode {
  choices: StoryChoice[];
  /** set on a node that ends the story: a word for how ("home safe", "lost") */
  end?: string;
}

export interface Story {
  start: string;
  nodes: Record<string, StoryNode>;
}

type Bag = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * A story out of what the writer sent: `{ start, nodes: { a: { lines, choices } } }`.
 *
 * Returns the story and its lines in reading order (breadth first from the
 * start), each tagged with its node, or null when the nodes do not make a
 * story: a choice leading nowhere, a node nobody can reach, no ending.
 */
export function storyOf(
  raw: unknown,
  asLine: (v: unknown) => TextLine | null,
): { story: Story; lines: TextLine[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Bag;
  const nodesRaw = (o.nodes && typeof o.nodes === 'object' ? o.nodes : null) as Bag | null;
  if (!nodesRaw) return null;
  const ids = Object.keys(nodesRaw);
  const start = str(o.start) || ids[0];
  if (!start || !nodesRaw[start]) return null;

  const nodes: Record<string, StoryNode> = {};
  const linesOf: Record<string, TextLine[]> = {};
  for (const id of ids) {
    const n = nodesRaw[id] as Bag;
    if (!n || typeof n !== 'object') continue;
    const lines = (Array.isArray(n.lines) ? n.lines : []).map(asLine).filter((l): l is TextLine => l !== null);
    const choices = (Array.isArray(n.choices) ? n.choices : [])
      .map((c): StoryChoice | null => {
        if (!c || typeof c !== 'object') return null;
        const b = c as Bag;
        const zh = str(b.zh);
        const to = str(b.to);
        return zh && to ? { zh, py: str(b.py), en: str(b.en), to } : null;
      })
      .filter((c): c is StoryChoice => c !== null);
    const end = str(n.end) || (n.end === true ? 'the end' : '');
    nodes[id] = { choices, ...(end || !choices.length ? { end: end || 'the end' } : {}) };
    linesOf[id] = lines;
  }

  const problem = storyProblem({ start, nodes }, linesOf);
  if (problem) return null;

  const order = reachable({ start, nodes });
  const lines: TextLine[] = [];
  for (const id of order) {
    linesOf[id].forEach((l, i) => lines.push({ ...l, node: id, ...(i === 0 ? { p: true } : {}) }));
  }
  return { story: { start, nodes }, lines };
}

/** Node ids in reading order: breadth first from the start. */
export function reachable(s: Story): string[] {
  const seen = [s.start];
  for (let i = 0; i < seen.length; i++) {
    for (const c of s.nodes[seen[i]]?.choices ?? []) if (s.nodes[c.to] && !seen.includes(c.to)) seen.push(c.to);
  }
  return seen;
}

/** Why a story does not hold together, or null when it does. */
export function storyProblem(s: Story, linesOf?: Record<string, TextLine[]>): string | null {
  for (const [id, n] of Object.entries(s.nodes)) {
    for (const c of n.choices) if (!s.nodes[c.to]) return `a choice in ${id} leads to ${c.to}, which is not there`;
    if (linesOf && !linesOf[id]?.length) return `${id} has nothing to read`;
  }
  const seen = reachable(s);
  const lost = Object.keys(s.nodes).filter((id) => !seen.includes(id));
  if (lost.length) return `nothing leads to ${lost.join(', ')}`;
  if (!seen.some((id) => s.nodes[id].end)) return 'it never ends';
  return null;
}

/** The endings a story has, in reading order. */
export const endingsOf = (s: Story) => reachable(s).filter((id) => s.nodes[id].end);

/** A stored story, checked again: anything that no longer holds together is dropped. */
export function storyFrom(v: unknown): Story | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Bag;
  if (typeof o.start !== 'string' || !o.nodes || typeof o.nodes !== 'object') return undefined;
  const nodes: Record<string, StoryNode> = {};
  for (const [id, n] of Object.entries(o.nodes as Bag)) {
    if (!n || typeof n !== 'object') continue;
    const b = n as Bag;
    nodes[id] = {
      choices: (Array.isArray(b.choices) ? b.choices : []).filter(
        (c): c is StoryChoice => Boolean(c && typeof c === 'object' && typeof (c as Bag).zh === 'string' && typeof (c as Bag).to === 'string'),
      ),
      ...(typeof b.end === 'string' ? { end: b.end } : {}),
    };
  }
  const s = { start: o.start, nodes };
  return storyProblem(s) ? undefined : s;
}

/* ----------------------------------------------------------------- scenes */

/** The rooms a scene can be set in; each is drawn by the app. */
export const BACKDROPS = {
  home: '家 — a room at home, table and chairs',
  bedroom: '房间 — a bedroom',
  classroom: '教室 — a classroom with a blackboard',
  shop: '商店 — a shop with shelves',
  restaurant: '饭店 — a restaurant',
  street: '路上 — a street with buildings',
  park: 'a park, trees and a path',
  hospital: '医院 — a hospital room',
  station: '车站 — a station platform',
  office: '公司 — an office with desks',
} as const;

export type Backdrop = keyof typeof BACKDROPS;

export interface SceneThing {
  /** a word the app has a photo of */
  w: string;
  /** where, as shares of the stage (0–1) */
  x: number;
  y: number;
  /** size, 0.6–1.6 */
  s: number;
}

export interface ScenePerson {
  /** a name, or one of the conversation partners' ids */
  who: string;
  x: number;
  y: number;
}

export interface Scene {
  /** the paragraph it is drawn before, 0 for the first */
  para: number;
  bg: Backdrop;
  things: SceneThing[];
  people: ScenePerson[];
  /** a question to answer by tapping a thing: 「杯子在哪儿？」 */
  ask?: { q: string; w: string };
}

const unit = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(0.95, Math.max(0.05, v)) : fallback;

/**
 * Scenes out of what the writer sent (or what was stored). `hasPicture` says
 * which words can be drawn; anything else is left out.
 */
export function scenesOf(raw: unknown, hasPicture: (w: string) => boolean): Scene[] {
  if (!Array.isArray(raw)) return [];
  const out: Scene[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Bag;
    const bg = str(o.bg) as Backdrop;
    if (!(bg in BACKDROPS)) continue;
    const things = (Array.isArray(o.things) ? o.things : [])
      .map((t): SceneThing | null => {
        if (!t || typeof t !== 'object') return null;
        const b = t as Bag;
        const w = str(b.w);
        if (!w || !hasPicture(w)) return null;
        const s = typeof b.s === 'number' ? Math.min(1.6, Math.max(0.6, b.s)) : 1;
        return { w, x: unit(b.x, 0.5), y: unit(b.y, 0.6), s };
      })
      .filter((t): t is SceneThing => t !== null)
      .slice(0, 8);
    const people = (Array.isArray(o.people) ? o.people : [])
      .map((p): ScenePerson | null => {
        if (!p || typeof p !== 'object') return null;
        const b = p as Bag;
        const who = str(b.who);
        return who ? { who: who.slice(0, 12), x: unit(b.x, 0.2), y: unit(b.y, 0.6) } : null;
      })
      .filter((p): p is ScenePerson => p !== null)
      .slice(0, 3);
    const askRaw = o.ask && typeof o.ask === 'object' ? (o.ask as Bag) : null;
    const ask =
      askRaw && str(askRaw.q) && things.some((t) => t.w === str(askRaw.w))
        ? { q: str(askRaw.q), w: str(askRaw.w) }
        : undefined;
    const para = typeof o.para === 'number' && o.para >= 0 ? Math.floor(o.para) : out.length;
    if (!things.length && !people.length) continue;
    out.push({ para, bg, things, people, ...(ask ? { ask } : {}) });
  }
  return out;
}
