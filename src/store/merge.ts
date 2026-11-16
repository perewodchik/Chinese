import { isExplained } from '../domain/explainText';
import { mergeActivity } from '../domain/activity';
import { mergePlay } from '../domain/play';
import { mergePictures } from '../domain/pictures';
import { mergeStudy } from '../domain/text';
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
    texts: union(account.texts, incoming.texts, (ours, theirs) => {
      const later = (theirs.reads ?? 0) > (ours.reads ?? 0) ? theirs : ours;
      // What the text says comes from the copy edited last (T7), or the one explained (T4) when
      // neither says when — whichever was read more.
      const other = later === ours ? theirs : ours;
      const edited = (other.editedAt ?? 0) !== (later.editedAt ?? 0) ? (other.editedAt ?? 0) > (later.editedAt ?? 0) : !isExplained(later) && isExplained(other);
      const kept = edited
        ? { ...later, lines: other.lines, vocab: other.vocab, questions: other.questions, grammar: other.grammar, note: other.note, title: other.title, titleZh: other.titleZh, model: other.model, ...(other.editedAt ? { editedAt: other.editedAt } : {}) }
        : later;
      // endings found on either device stay found
      const endings = [...new Set([...(ours.endings ?? []), ...(theirs.endings ?? [])])];
      // and so does anything done with the text on either
      const study = mergeStudy(ours.study, theirs.study);
      // and a picture drawn for it on either stays drawn
      const pictures = mergePictures(ours.pictures, theirs.pictures);
      return { ...kept, ...(endings.length ? { endings } : {}), ...(study ? { study } : {}), ...(pictures ? { pictures } : {}) };
    }).sort((a, b) => b.createdAt - a.createdAt),
    sets: union(account.sets, incoming.sets, (ours, theirs) => {
      const study = theirs.study?.length ? { study: [...new Set([...(ours.study ?? []), ...theirs.study])] } : {};
      // The catalogue book it is, at the newer version of the two.
      const catalog = !ours.catalog || (theirs.catalog && theirs.catalog.version > ours.catalog.version) ? theirs.catalog : ours.catalog;
      return { ...ours, ...study, ...(catalog ? { catalog } : {}) };
    }).sort((a, b) => b.createdAt - a.createdAt),
    plan: account.plan ?? incoming.plan,
    listPlan: account.listPlan ?? incoming.listPlan,
    radicals: mergeRadicals(account.radicals, incoming.radicals),
    activity: mergeActivity(account.activity, incoming.activity),
    play: mergePlay(account.play, incoming.play),
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
