import { mergeActivity } from '../domain/activity';
import { mergeVideo } from '../domain/video';
import { learnedFrom, SKILLS, type RecallBook, type SkillBook } from '../domain/memory';
import { mergeRadicals } from './radicalState';
import type { AppState } from './state';

/**
 * Two workspaces made into one, without losing anything either had.
 *
 * Used when work saved in a browser before accounts existed meets an account
 * that already has work of its own. Everything with an id is kept from both
 * sides; where both have the same thing, the side with the more recent
 * evidence wins — the later edit of a collection, the later review of a
 * character. The account keeps its own settings and its own session in
 * progress, if it has one.
 */
export function mergeStates(account: AppState, incoming: AppState): AppState {
  const recall = mergeRecall(account.recall, incoming.recall);
  return {
    ...account,
    collections: union(account.collections, incoming.collections, (ours, theirs) =>
      theirs.updatedAt > ours.updatedAt ? theirs : ours,
    ),
    recall,
    learned: learnedFrom(recall),
    sheets: union(account.sheets, incoming.sheets, (ours, theirs) =>
      ours.gradedAt === null && theirs.gradedAt !== null ? theirs : ours,
    ).sort((a, b) => b.printedAt - a.printedAt),
    texts: union(account.texts, incoming.texts, (ours, theirs) =>
      (theirs.reads ?? 0) > (ours.reads ?? 0) ? theirs : ours,
    ).sort((a, b) => b.createdAt - a.createdAt),
    sets: union(account.sets, incoming.sets, (ours) => ours).sort((a, b) => b.createdAt - a.createdAt),
    plan: account.plan ?? incoming.plan,
    listPlan: account.listPlan ?? incoming.listPlan,
    radicals: mergeRadicals(account.radicals, incoming.radicals),
    activity: mergeActivity(account.activity, incoming.activity),
    videos: union(account.videos, incoming.videos, mergeVideo).sort((a, b) => b.added - a.added),
  };
}

function mergeRecall(ours: RecallBook, theirs: RecallBook): RecallBook {
  const out: RecallBook = { ...ours };
  for (const id in theirs) {
    const merged: SkillBook = { ...out[id] };
    for (const skill of SKILLS) {
      const mine = merged[skill];
      const other = theirs[id][skill];
      if (other && (!mine || other.last > mine.last)) merged[skill] = other;
    }
    out[id] = merged;
  }
  return out;
}

function union<T extends { id: string }>(ours: T[], theirs: T[], pick: (ours: T, theirs: T) => T): T[] {
  const at = new Map(ours.map((item, i) => [item.id, i]));
  const out = [...ours];
  for (const item of theirs) {
    const i = at.get(item.id);
    if (i === undefined) {
      at.set(item.id, out.length);
      out.push(item);
    } else {
      out[i] = pick(out[i], item);
    }
  }
  return out;
}
