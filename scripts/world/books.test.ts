import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { libraryLeveler } from '../../src/world/core/budget';
import { bookSchema, checkBook, finished, glossesByPage, openAt, owedBooks, pageCount, shelfRows, todayText, type Book } from '../../src/world/core/books';
import { diaryLines } from '../../src/world/core/diary';
import { merge } from '../../src/world/core/merge';
import { readSave } from '../../src/world/core/migrate';
import { applyAll, newSave, WORLD_SAVE_VERSION } from '../../src/world/core/save';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const leveler = libraryLeveler(lib);
const ctx = { now: 1 };
const denglong = bookSchema.parse(JSON.parse(readFileSync('content/world/books/denglong.json', 'utf8')));
const other: Book = { ...denglong, id: 'other', zh: '别的', en: 'Another', where: 'somewhere later' };

describe('books (§13 B1)', () => {
  it('《灯笼》 passes the check: its level, its facts, its place', () => {
    const r = checkContent('content/world', lib);
    assert.deepEqual(r.errors.filter((e) => e.startsWith('book')), []);
    assert.ok(r.books.some((b) => b.id === 'denglong'));
  });

  it('the check catches a word above the level, a long page, a fact not in the register', () => {
    const bad: Book = { ...denglong, words: [], facts: ['no-such-fact'], pages: [{ zh: '走马灯'.repeat(21), en: 'x' }, ...denglong.pages.slice(1)] };
    const errs = checkBook(bad, { leveler, names: new Set(), facts: new Set(['zoumadeng']), maps: new Set(['siheyuan-yard']) });
    assert.ok(errs.some((e) => /page 1 has 63 characters/.test(e)), errs.join('\n'));
    assert.ok(errs.some((e) => /above the book's level/.test(e)), errs.join('\n'));
    assert.ok(errs.some((e) => /no-such-fact/.test(e)));
  });

  it('王阿姨 gives it in chapter 1: the action puts it on the shelf, once', () => {
    const scenes = checkContent('content/world', lib).districts.flatMap((d) => d.scenes);
    const gives = scenes.flatMap((s) => s.nodes.flatMap((n) => (n.onEnter ?? []).filter((a) => a.do === 'book').map(() => s.id)));
    assert.deepEqual(gives, ['lantern-rabbit']);
    let s = applyAll(newSave('d', 0), [{ do: 'book', id: 'denglong' }], ctx);
    const got = s.books.denglong!.got;
    s = applyAll({ ...s, clock: s.clock + 50 }, [{ do: 'book', id: 'denglong' }], ctx);
    assert.equal(s.books.denglong!.got, got);
  });

  it('reading: pages kept in order, opens at the first unread, the diary says so at the last', () => {
    const n = pageCount(denglong);
    let s = applyAll(newSave('d', 0), [{ do: 'book', id: 'denglong' }], ctx);
    assert.equal(openAt(s, denglong), 0);
    s = applyAll(s, [2, 0, 1, 1].map((page) => ({ do: 'read' as const, id: 'denglong', page, of: n, zh: '灯笼' })), ctx);
    assert.deepEqual(s.books.denglong!.read, [0, 1, 2]);
    assert.equal(openAt(s, denglong), 3);
    const codes = () => Object.values(s.diary).flat().filter((c) => c.startsWith('l:'));
    assert.deepEqual(codes(), []);
    s = applyAll(s, Array.from({ length: n }, (_, page) => ({ do: 'read' as const, id: 'denglong', page, of: n, zh: '灯笼' })), ctx);
    assert.ok(finished(s, denglong));
    assert.equal(openAt(s, denglong), 0);
    assert.deepEqual(codes(), ['l:《灯笼》']);
    assert.equal(diaryLines(codes(), { npc: {}, item: {}, place: {} } as never)[0]!.zh, '我读了《灯笼》。');
  });

  it('a save past the scene that gives a book gets it on load (owedBooks), once', () => {
    const scenes = checkContent('content/world', lib).districts.flatMap((d) => d.scenes);
    const s = { ...newSave('d', 0), scenes: ['lantern', 'lantern-rabbit'] };
    assert.deepEqual(owedBooks(newSave('d', 0), scenes, [denglong]), []);
    assert.deepEqual(owedBooks(s, scenes, [denglong]), ['denglong']);
    assert.deepEqual(owedBooks(s, scenes, []), []);
    assert.deepEqual(owedBooks(applyAll(s, [{ do: 'book', id: 'denglong' }], ctx), scenes, [denglong]), []);
  });

  it('the shelf: yours first, the rest as spines; the menu shows the same', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'book', id: 'other' }], ctx);
    const rows = shelfRows(s, [denglong, other]);
    assert.deepEqual(rows.map((r) => [r.book.id, r.have]), [['other', true], ['denglong', false]]);
  });

  it('glosses show where a word first appears, a word inside a longer one not twice', () => {
    const g = glossesByPage(denglong).map((p) => p.map((w) => w.w));
    assert.deepEqual(g[0], ['灯笼']);
    assert.ok(g[1]!.includes('灯'));
    assert.equal(g.flat().length, new Set(g.flat()).size);
    assert.equal(todayText(denglong.today.zh).startsWith('今天的北京'), false);
  });

  it('the save (v15 on): an old save gets no books; merge keeps both devices\' pages and the earlier minute', () => {
    assert.ok(WORLD_SAVE_VERSION >= 15);
    const old = { ...JSON.parse(JSON.stringify(newSave('d', 0))), version: 14 };
    delete old.books;
    const r = readSave(old);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.save.books, {});
    const a = { ...newSave('a', 0), books: { denglong: { got: 30, read: [0, 2] } } };
    const b = { ...newSave('b', 0), books: { denglong: { got: 20, read: [1, 2] } } };
    assert.deepEqual(merge(a, b).books.denglong, { got: 20, read: [0, 1, 2] });
  });
});
