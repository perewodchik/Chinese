/**
 * The word budget (prompt §5, concept §6): every line NPCs say is checked
 * against the HSK 2026 lists when the content is built.
 *
 * - A normal line: HSK 1 free, at most one HSK 2 word, nothing above.
 *   Across a scene of twenty words or more, HSK 2 is at most 15 %.
 * - A 📌 key line: HSK 1–2 free, and either up to three HSK 3+ words or one
 *   成语. Each of those words is explained (`explains`) by some other NPC,
 *   so "X是什么意思？" works out in the street.
 * - Situation words of the scene are free in any of its lines. There are at
 *   most eight, each said at least twice in the scene (fewer than three is
 *   worth a warning, not an error).
 * - Proper names and the district's place names do not count.
 *
 * Each problem names the file, the scene and node, the word and its level.
 */

import type { Library } from '../../data/types';
import { segment } from '../../domain/segment';
import type { DistrictContent, DialogueNode, NpcCard, Scene } from './types';

export interface Leveled {
  w: string;
  /** 2026 band, 7 for 7–9; 0 when no list knows it */
  level: number;
}

/** Cuts a line into words with their levels; `whole` are cut as one piece. */
export type Leveler = (zh: string, whole: ReadonlySet<string>) => Leveled[];

export function libraryLeveler(lib: Library): Leveler {
  return (zh, whole) =>
    segment(zh, lib, whole)
      .filter((t) => t.word)
      .map((t) => ({ w: t.text, level: t.band }));
}

export interface BudgetProblem {
  severity: 'error' | 'warning';
  /** `gulou/scenes.json` */
  file: string;
  scene: string;
  node?: string;
  /** which text of the node: say, simpler, hint */
  field?: string;
  word?: string;
  level?: number;
  message: string;
}

export function formatProblem(p: BudgetProblem): string {
  const where = [p.scene, p.node].filter(Boolean).join('/');
  const field = p.field ? ` (${p.field})` : '';
  const word = p.word ? ` ${p.word}${p.level !== undefined ? ` [HSK ${p.level || '?'}]` : ''}:` : '';
  return `${p.severity === 'error' ? 'error' : 'warn '} ${p.file} · ${where}${field}:${word} ${p.message}`;
}

const MAX_SITUATION = 8;
const MIN_SITUATION = 3;
const SCENE_HSK2_SHARE = 0.15;
const SHARE_FROM_WORDS = 20;

const count = (hay: string, needle: string) => (needle ? hay.split(needle).length - 1 : 0);

interface Texts {
  field: string;
  zh: string;
}

/** The lines of a node that the player reads or says. */
function textsOf(n: DialogueNode): Texts[] {
  const out: Texts[] = [{ field: 'say', zh: n.say }];
  if (n.simpler) out.push({ field: 'simpler', zh: n.simpler });
  if (n.hint) out.push({ field: 'hint', zh: n.hint.full });
  return out;
}

export interface BudgetContext {
  leveler: Leveler;
  /** every district's content, so a key word may be explained anywhere in reach */
  all: readonly DistrictContent[];
}

export function checkScene(scene: Scene, c: DistrictContent, ctx: BudgetContext, file: string): BudgetProblem[] {
  const out: BudgetProblem[] = [];
  const names = new Set(c.district.names);
  const situation = new Set((scene.words ?? []).map((w) => w.w));
  const idioms = new Set(ctx.all.flatMap((d) => d.idioms.map((i) => i.id)));
  const whole = new Set([...names, ...situation, ...idioms]);
  const explainers: NpcCard[] = ctx.all.flatMap((d) => d.npcs).filter((n) => n.id !== scene.npc);
  const at = (node: string, field: string) => ({ file, scene: scene.id, node, field });

  let total = 0;
  let hsk2 = 0;
  for (const n of scene.nodes) {
    for (const t of textsOf(n)) {
      const words = ctx.leveler(t.zh, whole).filter((x) => !names.has(x.w) && !situation.has(x.w));
      const key = !!n.key && t.field !== 'hint';
      const idiomsHere = words.filter((x) => idioms.has(x.w));
      const plain = words.filter((x) => !idioms.has(x.w));
      const hi = plain.filter((x) => x.level >= 3 || x.level === 0);
      const two = plain.filter((x) => x.level === 2);
      if (!key) {
        total += words.length;
        hsk2 += two.length;
        for (const x of idiomsHere) out.push({ severity: 'error', ...at(n.id, t.field), word: x.w, message: 'a 成语 only belongs in a 📌 key line' });
        for (const x of hi) out.push({ severity: 'error', ...at(n.id, t.field), word: x.w, level: x.level, message: 'above HSK 2 in a normal line — use an easier word, a situation word, or make it the key line' });
        if (two.length > 1) out.push({ severity: 'error', ...at(n.id, t.field), word: two.map((x) => x.w).join(' '), level: 2, message: `${two.length} HSK 2 words — at most one per normal line` });
        continue;
      }
      if (idiomsHere.length > 1) out.push({ severity: 'error', ...at(n.id, t.field), word: idiomsHere.map((x) => x.w).join(' '), message: 'at most one 成语 in a key line' });
      if (idiomsHere.length && hi.length) out.push({ severity: 'error', ...at(n.id, t.field), word: hi.map((x) => x.w).join(' '), message: 'a key line has one 成语 or up to three hard words, not both' });
      if (hi.length > 3) out.push({ severity: 'error', ...at(n.id, t.field), word: hi.map((x) => x.w).join(' '), message: `${hi.length} words above HSK 2 — at most three in a key line` });
      for (const x of hi) {
        if (!explainers.some((p) => p.explains[x.w])) {
          out.push({ severity: 'error', ...at(n.id, t.field), word: x.w, level: x.level, message: 'no other NPC explains it — add it to someone\'s `explains`' });
        }
      }
    }
  }
  if (total >= SHARE_FROM_WORDS && hsk2 / total > SCENE_HSK2_SHARE) {
    out.push({ severity: 'error', file, scene: scene.id, message: `HSK 2 is ${Math.round((hsk2 / total) * 100)} % of the scene's words (${hsk2}/${total}) — at most 15 %` });
  }

  const words = scene.words ?? [];
  if (words.length > MAX_SITUATION) out.push({ severity: 'error', file, scene: scene.id, message: `${words.length} situation words — at most ${MAX_SITUATION}` });
  if (words.length > 0 && words.length < MIN_SITUATION) out.push({ severity: 'warning', file, scene: scene.id, message: `${words.length} situation word(s) — usually ${MIN_SITUATION}–${MAX_SITUATION}` });
  const said = scene.nodes.flatMap((n) => textsOf(n).map((t) => t.zh)).join('\n');
  for (const w of words) {
    const times = count(said, w.w);
    if (times < 2) out.push({ severity: 'error', file, scene: scene.id, word: w.w, message: `situation word said ${times} time(s) — say it at least twice in the scene` });
  }
  return out;
}

/** Every scene of every district. */
export function checkBudget(ctx: BudgetContext): BudgetProblem[] {
  return ctx.all.flatMap((c) => c.scenes.flatMap((s) => checkScene(s, c, ctx, `${c.district.id}/scenes.json`)));
}
