import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_SCOPE, type Collection } from '../domain/collection';
import { DEFAULT_RADICAL_SCOPE } from '../domain/radicals/sets';
import { DEFAULT_RADICAL_SHEET } from '../domain/radicals/sheet';
import { defaultSheet } from '../domain/sheet';
import { shelve, type GeneratedText, type TextPlan } from '../domain/text';
import { coalesce, reduce, type Action } from './actions';
import { mergeStates } from './merge';
import { emptyState, type AppState } from './state';

const collection = (id: string, items: string[], at = 1): Collection => ({
  id,
  name: id,
  items,
  sheet: defaultSheet(),
  scope: { ...DEFAULT_SCOPE },
  createdAt: at,
  updatedAt: at,
});

const plan = (id: string): TextPlan => ({
  id,
  name: id,
  createdAt: 1,
  setId: null,
  basis: [],
  basisCount: 150,
  met: [],
  supplement: '',
  script: 'simplified',
  specs: [],
  response: '',
  step: 'plan',
});

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reduce, state);

describe('reduce', () => {
  it('keeps what another device added when a reorder is replayed', () => {
    const start = run(emptyState(), { type: 'collection/create', collection: collection('c', ['c一', 'c二', 'c三']) });
    const elsewhere = run(start, { type: 'collection/addItems', id: 'c', items: ['c四'], at: 2 });
    const replayed = run(elsewhere, { type: 'collection/reorder', id: 'c', items: ['c三', 'c一', 'c二'], at: 3 });
    assert.deepEqual(replayed.collections[0].items, ['c三', 'c一', 'c二', 'c四']);
  });

  it('adds nothing when what it adds is already there', () => {
    const start = run(emptyState(), { type: 'collection/create', collection: collection('c', ['c好']) });
    assert.equal(run(start, { type: 'collection/addItems', id: 'c', items: ['c好'], at: 2 }), start);
  });

  it('does not count the marks on one sheet twice', () => {
    const sheet = { id: 's', name: 'From memory', items: ['c好'], printedAt: 1, gradedAt: null };
    const mark: Action = { type: 'sheet/grade', id: 's', results: [{ id: 'c好', rating: 'good' }], at: 10 };
    const twice = run(emptyState(), { type: 'sheet/record', sheet }, mark, mark);
    assert.equal(twice.recall['c好'].write?.reps, 1);
  });

  it('keeps the day a character was first marked when it is marked again', () => {
    const tick: Action = { type: 'recall/setLearned', ids: ['c好'], value: true, at: 1_000 };
    const marked = run(emptyState(), tick);
    // Missed twice, so it no longer counts as learned — and ticking it again
    // is a renewed claim about the same character, not a new one.
    const miss: Action = {
      type: 'recall/grade',
      results: [{ id: 'c好', skill: 'recognise', rating: 'again' }],
      at: 5_000,
    };
    const missed = run(marked, miss, { ...miss, at: 6_000 });
    const again = run(missed, { type: 'recall/setLearned', ids: ['c好'], value: true, at: 9_000 });
    assert.equal(again.recall['c好'].recognise?.since, 1_000);
    assert.equal(again.recall['c好'].recognise?.last, 9_000);
  });

  it('adds a text once however many times the action is replayed', () => {
    const text = {
      id: 't',
      title: 'A day',
      titleZh: '一天',
      topic: '',
      length: 'short' as const,
      level: 'edge' as const,
      genre: 'story' as const,
      createdAt: 1,
      model: 'Claude',
      lines: [{ zh: '你好。', py: 'nǐ hǎo.', en: 'Hello.' }],
      vocab: [],
      questions: [],
      grammar: [],
      note: '',
      teach: [],
      glosses: {},
      basis: [],
      read: false,
    };
    const add: Action = { type: 'text/add', texts: [text], newSet: { id: 'set', name: 'Week one', createdAt: 1 } };
    const twice = run(emptyState(), add, add);
    assert.equal(twice.texts.length, 1);
    assert.equal(twice.sets.length, 1);
  });

  it('leaves a writing session alone when the change was meant for another one', () => {
    const state = run(emptyState(), { type: 'plan/start', plan: plan('mine') });
    const after = run(state, { type: 'plan/patch', planId: 'other', patch: { name: 'Renamed' } }, { type: 'plan/discard', planId: 'other' });
    assert.equal(after.plan?.name, 'mine');
  });

  it('takes away the claim when a character is unticked, but not what was earned', () => {
    const ticked = run(emptyState(), { type: 'recall/setLearned', ids: ['c好'], value: true, at: 1 });
    assert.ok(ticked.learned.has('c好'));

    const written = run(ticked, { type: 'recall/grade', results: [{ id: 'c好', skill: 'write', rating: 'good' }], at: 2 });
    const unticked = run(written, { type: 'recall/setLearned', ids: ['c好'], value: false, at: 3 });
    assert.equal(unticked.learned.has('c好'), false);
    assert.equal(unticked.recall['c好'].recognise, undefined);
    assert.ok(unticked.recall['c好'].write);
  });
});

describe('coalesce', () => {
  it('folds a run of edits to one collection into one action with the same effect', () => {
    const start = run(emptyState(), { type: 'collection/create', collection: collection('c', []) });
    const a: Action = { type: 'collection/update', id: 'c', patch: { name: 'Food' }, at: 2 };
    const b: Action = { type: 'collection/update', id: 'c', patch: { sheet: { perPage: 3 } }, at: 3 };
    const c: Action = { type: 'collection/update', id: 'c', patch: { sheet: { palette: 'pine' } }, at: 4 };

    const ab = coalesce(a, b);
    assert.ok(ab);
    const abc = coalesce(ab, c);
    assert.ok(abc);
    assert.deepEqual(run(start, abc), run(start, a, b, c));
  });

  it('keeps apart what cannot be folded', () => {
    const rename = (id: string): Action => ({ type: 'collection/update', id, patch: { name: 'x' }, at: 1 });
    assert.equal(coalesce(rename('c'), rename('d')), null);
    const grade: Action = { type: 'recall/grade', results: [], at: 1 };
    assert.equal(coalesce(grade, grade), null);
  });
});

describe('mergeStates', () => {
  it('keeps everything from both sides, and the later review of a character both have', () => {
    const account = run(
      emptyState(),
      { type: 'collection/create', collection: collection('pc', ['c好']) },
      { type: 'recall/grade', results: [{ id: 'c好', skill: 'recognise', rating: 'good' }], at: 100 },
    );
    const browser = run(
      emptyState(),
      { type: 'collection/create', collection: collection('old', ['c人']) },
      { type: 'recall/grade', results: [{ id: 'c好', skill: 'recognise', rating: 'again' }], at: 200 },
      { type: 'recall/grade', results: [{ id: 'c人', skill: 'write', rating: 'good' }], at: 50 },
    );

    const merged = mergeStates(account, browser);
    assert.deepEqual(
      merged.collections.map((c) => c.id),
      ['pc', 'old'],
    );
    assert.equal(merged.recall['c好'].recognise?.last, 200);
    assert.equal(merged.recall['c人'].write?.last, 50);
  });
});

describe('radicals', () => {
  it('adds a radical to a set once, however often the change is replayed', () => {
    const set = {
      id: 'r',
      name: 'Hands and water',
      items: [64],
      sheet: DEFAULT_RADICAL_SHEET,
      scope: { ...DEFAULT_RADICAL_SCOPE },
      createdAt: 1,
      updatedAt: 1,
    };
    const add: Action = { type: 'radicals/add', id: 'r', items: [85, 64], at: 2 };
    const twice = run(emptyState(), { type: 'radicals/create', set }, add, add);
    assert.deepEqual(twice.radicals.sets[0].items, [64, 85]);
  });

  it('keeps the moment a radical was first marked known', () => {
    const state = run(
      emptyState(),
      { type: 'radicals/setKnown', items: [85], value: true, at: 5 },
      { type: 'radicals/setKnown', items: [85], value: true, at: 9 },
    );
    assert.equal(state.radicals.known[85], 5);
  });
});

describe('text collections', () => {
  const text = (id: string, setId?: string, createdAt = 1): GeneratedText => ({
    id,
    setId,
    title: id,
    titleZh: id,
    topic: '',
    length: 'short',
    level: 'edge',
    genre: 'story',
    createdAt,
    model: 'test',
    lines: [{ zh: '你好。', py: 'nǐ hǎo', en: 'Hello.' }],
    vocab: [],
    questions: [],
    grammar: [],
    note: '',
    teach: [],
    glosses: {},
    basis: [],
    read: false,
  });
  const start = (): AppState => ({
    ...emptyState(),
    sets: [
      { id: 'a', name: 'A', createdAt: 1 },
      { id: 'b', name: 'B', createdAt: 2 },
    ],
    texts: [text('a1', 'a', 1), text('a2', 'a', 2), text('b1', 'b', 3), text('loose')],
  });

  it('merges whole sets and loose texts into a new one, and drops the sets it empties', () => {
    const state = run(start(), {
      type: 'texts/collect',
      textIds: ['b1', 'loose', 'a1'],
      set: { id: 'n', name: 'Merged', createdAt: 5, order: ['b1', 'loose', 'a1'] },
    });
    assert.deepEqual(
      state.sets.map((s) => s.id),
      ['n', 'a'],
    );
    assert.deepEqual(shelve(state.texts, state.sets).bySet.get('n')?.map((t) => t.id), ['b1', 'loose', 'a1']);
  });

  it('adds to an existing set in the order it is given', () => {
    const state = run(start(), {
      type: 'texts/collect',
      textIds: ['b1'],
      set: { id: 'a', name: 'A', createdAt: 1, order: ['a2', 'a1', 'b1'] },
    });
    assert.deepEqual(state.sets.map((s) => s.id), ['a']);
    assert.deepEqual(shelve(state.texts, state.sets).bySet.get('a')?.map((t) => t.id), ['a2', 'a1', 'b1']);
  });

  it('reads a reordered set in its new order, with newcomers after', () => {
    const state = run(start(), { type: 'set/reorder', id: 'a', order: ['a2'] });
    assert.deepEqual(shelve(state.texts, state.sets).bySet.get('a')?.map((t) => t.id), ['a2', 'a1']);
  });
});
