import { wordsBandOf, wordsCollectionName, wordsPresetId, type SweepMark } from '../domain/sweep';
import type { CollectionWord } from '../domain/collection';
import { wordId, type ItemId } from '../domain/ids';
import { addItems, createCollection, gradeItem, setLearned, setWords } from './commands';
import { getState } from './store';

/**
 * Commands about words, built from the ones every item already has.
 *
 * A word is an item like a character — `w东西` beside `c东` — so marking it
 * learned, grading it and collecting it are the same actions. What is here is
 * only what is particular to words: which collection a band's words go into,
 * and what each answer in the sweep means.
 */

/**
 * The collection a band's new words are gathered in: the one the sweep made
 * before, or the whole band where it was taken as a ready-made set — the new
 * word is in it already, and a second "HSK 1 words" is only confusing. Made
 * the first time neither exists.
 */
export function wordsCollection(band: number): string {
  const own = getState().collections;
  const found =
    own.find((c) => c.presetId === wordsPresetId(band)) ?? own.find((c) => wordsBandOf(c) === band);
  if (found) return found.id;
  return createCollection({
    name: wordsCollectionName(band),
    presetId: wordsPresetId(band),
    note: `The HSK ${band} words you marked new while sorting, in the order the syllabus gives them — the commonest first.`,
  }).id;
}

/**
 * One page of the sweep, saved.
 *
 * Known words become claims, the way ticking "learned" does. A word you were
 * not sure of is taken as a first answer that took a while — graded hard — so
 * it is in the review rotation and asked about within the day. New words go
 * into the band's collection.
 */
export function saveSweep(band: number, marks: Record<SweepMark, ItemId[]>): void {
  setLearned(marks.know, true);
  for (const id of marks.unsure) gradeItem(id, 'recognise', 'hard');
  if (marks.new.length) addItems(wordsCollection(band), marks.new);
}

const TALK_PRESET = 'words-talk';

/**
 * A word met in conversation, kept to learn: into one collection for all of
 * them, made the first time, so the Words drill brings it in with the rest.
 */
export function keepTalkWord(id: ItemId): void {
  const found = getState().collections.find((c) => c.presetId === TALK_PRESET);
  const target =
    found?.id ??
    createCollection({
      name: 'Words from conversations',
      presetId: TALK_PRESET,
      note: 'Words you met talking and chose to keep. The Words drill brings them in a few a day.',
    }).id;
  addItems(target, [id]);
}

/**
 * A shop's menu words (the 点单 games), kept as one collection to print: made
 * the first time, brought up to date after. Most menu words are off the HSK
 * lists (拿铁, 燕麦奶), so each goes in with its pinyin and meaning as the
 * collection's own words, which is what the sheet prints them from.
 */
export function keepMenuWords(shop: string, name: string, note: string, words: CollectionWord[]): string {
  const presetId = `menu-${shop}`;
  const items = words.map((w) => wordId(w.w));
  const found = getState().collections.find((c) => c.presetId === presetId);
  if (!found) return createCollection({ name, presetId, note, items, words }).id;
  addItems(found.id, items);
  const fresh = new Map(words.map((w) => [w.w, w]));
  setWords(found.id, [...(found.words ?? []).filter((w) => !fresh.has(w.w)), ...words]);
  return found.id;
}

export const BEIJING_PRESET = 'words-beijing';

/**
 * A word kept in 走走 (the walk through Beijing): into "Words from Beijing",
 * made the first time. Many are off the lists (situation words like 挂号),
 * so each goes in with its reading and meaning, as the menu words do.
 */
export function keepBeijingWord(word: CollectionWord): string {
  const found = getState().collections.find((c) => c.presetId === BEIJING_PRESET);
  if (!found) {
    return createCollection({
      name: 'Words from Beijing',
      presetId: BEIJING_PRESET,
      note: 'Words you kept while walking Beijing in 走走 — from people, signs and the places they belong to.',
      items: [wordId(word.w)],
      words: [word],
    }).id;
  }
  addItems(found.id, [wordId(word.w)]);
  setWords(found.id, [...(found.words ?? []).filter((w) => w.w !== word.w), word]);
  return found.id;
}
