/**
 * Passages from a real book, onto one account's shelf — what the /add-text
 * skill runs.
 *
 * The book is the writer here. The learner types in a passage from it; Claude
 * adds what a generated passage comes with — pinyin, English, the words, the
 * grammar, a note, questions — as the same JSON the generation prompt asks
 * for; and this puts it in a reading session exactly as "Paste back" would:
 * read by the same parser, its new characters counted against what is learned
 * by the same `toText`, the session made or reused the way `text/add` does.
 *
 *   npm run texts -- sets
 *       the reading sessions, and what the account can already read (JSON)
 *   npm run texts -- check <reply.json> [--adapted]
 *       how much of each passage the account can read already; nothing saved
 *   npm run texts -- add <reply.json> --set <id or name> [--source 十万个为什么] [--genre description] [--dry-run]
 *   npm run texts -- add <reply.json> --new-set <name> …
 *       a session by that name is reused when there is one, so nothing is made twice
 *   --adapted: the passages are Claude's simpler retelling of the book's, not the book's own
 *   --story: a story Claude wrote for the learner (/story), its chapters in order, each
 *       counting what the one before taught as met; --preface: the first passage is its
 *       preface of names and key words; --learn: the chapters' new words onto the shelf's list
 *   npm run texts -- illustrate [--set <id or name>] [--text <id>] [--redo] [--style "…"] [--dry-run]
 *       draws, with Gemini, the pictures the texts describe for their paragraphs
 *       (`pictures: [{ para, prompt }]`) and puts them in; `add` does it by itself for
 *       what it adds when GEMINI_API_KEY is set (illustrate.ts)
 *   npm run texts -- describe <pictures.json>
 *       what to draw for texts already on the shelf: { "pictures": { "<text id>": [{ para, prompt }] } };
 *       then illustrate draws them
 *   npm run texts -- boxes <text id> <boxes.json>
 *       a comic's lines put where they are on their pages again: { "<line number from 0>": [left, top, width, height] },
 *       for a box read wrong off the photo
 *   npm run texts -- put <text id> <picture for ¶1> <picture for ¶2> …
 *       pictures drawn by hand (art/BRIEF.md) into a text, a paragraph each
 *   npm run texts -- record [--voice wang] [--set <id or name>]
 *       reads every text's sentences aloud in one of the app's voices and keeps the
 *       recordings, so the website plays the text in that voice (on the Mac only:
 *       the voices are models on it, set up once by `npm run voices`)
 *
 * Which account, and where it lives: with HANZI_SITE (plus HANZI_PASSWORD) it
 * signs in to the deployed site over HTTPS — the way from a cloud session,
 * which cannot reach Postgres itself. Otherwise the database `.env` names, as
 * `npm run admin` does. HANZI_USER is the account either way, admin by default.
 *
 * Saved as a device saves: on the revision it read, read again and redone if
 * a device saved in between. A device that was open meanwhile has its own
 * save refused once, and replays its changes on top of these.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createServices } from '../../server/src/composition';
import { describeDatabase, loadConfig, loadEnvFile } from '../../server/src/config';
import { RevisionConflictError } from '../../server/src/domain/errors';
import { SESSION_COOKIE } from '../../server/src/http/request';
import { localVoicesFromEnv } from '../../server/src/infrastructure/local-voices';
import { openStores } from '../../server/src/infrastructure/stores';
import { API, type ApiErrorBody, type SaveWorkspaceRequest, type WorkspaceDto } from '../../shared/api';
import { usernameKey } from '../../shared/credentials';
import type { Collection } from '../../src/domain/collection';
import { charId, idValue, isCharId, isItemId, isWordId, wordId, type ItemId } from '../../src/domain/ids';
import { isDue, type RecallBook } from '../../src/domain/memory';
import type { CharacterEntry, Library, SyllabusWord } from '../../src/data/types';
import { asLine, parseResponse, toText, type DraftText } from '../../src/domain/parse';
import { segment, writerHints } from '../../src/domain/segment';
import { taughtAlready } from '../../src/domain/teach';
import {
  bookModel,
  coverageOf,
  fromBook,
  GENRES,
  isHanzi,
  LENGTHS,
  textCharCount,
  type Coverage,
  type GeneratedText,
  type Genre,
  type Level,
  type TextLength,
  type TextLine,
  type TextSet,
} from '../../src/domain/text';
import { newId } from '../../src/platform/ids';
import { geminiFromEnv, illustrate, putDrawn, withDescribed, type PictureAccount } from './illustrate';
import type { PersistedState } from '../../src/store/state';

/** The workspace version this checkout writes. A newer document is left alone. */
const VERSION: PersistedState['version'] = 11;

type Doc = Record<string, unknown>;

const isDoc = (v: unknown): v is Doc => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function shelfOf(doc: Doc): { texts: GeneratedText[]; sets: TextSet[] } {
  return {
    texts: Array.isArray(doc.texts) ? (doc.texts as GeneratedText[]) : [],
    sets: Array.isArray(doc.sets) ? (doc.sets as TextSet[]) : [],
  };
}

const learnedOf = (doc: Doc): string[] =>
  Array.isArray(doc.learned) ? doc.learned.filter((x): x is string => typeof x === 'string') : [];

/** The characters marked learned — the inventory a generated passage is written from. */
const knownChars = (doc: Doc) => learnedOf(doc).filter(isCharId).map(idValue);

/* ------------------------------------------------------------- the shelf */

export interface ShelfSession {
  id: string;
  name: string;
  texts: number;
  unread: number;
  /** how many of them came from a book */
  fromBook: number;
  /** the books they came from */
  books: string[];
  /** when something last went in, or when it was made */
  lastAt: number;
  /** the Chinese title of the newest */
  latest: string;
}

export interface ShelfSummary {
  /** most recently added to first */
  sessions: ShelfSession[];
  /** the session a book passage last went into, if one has */
  suggested: string | null;
  /** texts in no session */
  loose: number;
  knownChars: string;
  knownWords: string[];
  /** characters earlier passages taught: not new again */
  met: string;
  /** characters and words Review says are due: worth meeting again in a sentence */
  due: string[];
  /** what the collections hold that is not learned yet, words and characters */
  learning: string[];
}

export function describeShelf(doc: Doc): ShelfSummary {
  const { texts, sets } = shelfOf(doc);
  const known = new Set(knownChars(doc));
  const ids = new Set(sets.map((s) => s.id));
  const newestFirst = [...texts].sort((a, b) => b.createdAt - a.createdAt);
  const sessions = sets.map((s): ShelfSession => {
    const mine = texts.filter((t) => t.setId === s.id);
    const newest = newestFirst.find((t) => t.setId === s.id);
    return {
      id: s.id,
      name: s.name,
      texts: mine.length,
      unread: mine.filter((t) => !t.read).length,
      fromBook: mine.filter(fromBook).length,
      books: [...new Set(mine.filter(fromBook).map((t) => t.topic).filter(Boolean))],
      lastAt: Math.max(s.createdAt, newest?.createdAt ?? 0),
      latest: newest?.titleZh ?? '',
    };
  });
  return {
    sessions: sessions.sort((a, b) => b.lastAt - a.lastAt),
    suggested: newestFirst.find((t) => fromBook(t) && t.setId && ids.has(t.setId))?.setId ?? null,
    loose: texts.filter((t) => !t.setId || !ids.has(t.setId)).length,
    knownChars: [...known].join(''),
    knownWords: learnedOf(doc).filter(isWordId).map(idValue),
    met: [...taughtAlready(texts)].filter((c) => !known.has(c)).join(''),
    due: dueOf(doc, Date.now()),
    learning: learningOf(doc).slice(0, 300),
  };
}

/** Characters and words with any skill due, as Review counts it. */
function dueOf(doc: Doc, now: number): string[] {
  const recall = isDoc(doc.recall) ? (doc.recall as RecallBook) : {};
  return Object.entries(recall)
    .filter(([id, book]) => isItemId(id) && Object.values(book ?? {}).some((r) => r && isDue(r, now)))
    .map(([id]) => idValue(id));
}

/** What the collections hold that is not learned yet. */
function learningOf(doc: Doc): string[] {
  const learned = new Set(learnedOf(doc));
  const collections = Array.isArray(doc.collections) ? (doc.collections as Collection[]) : [];
  const ids = collections.flatMap((c) => c.items ?? []).filter((id) => isItemId(id) && !learned.has(id));
  return [...new Set(ids)].map(idValue);
}

/* ---------------------------------------------------------- reading them */

/** How a passage goes on the shelf: as the book printed it, or retold more simply. */
export interface PassageOptions {
  /** the book, shown as the passage's topic */
  source: string;
  genre: Genre;
  /**
   * Retold at the learner's level rather than as printed. Written the way a
   * generated passage is — a few new characters, each set up to be guessed —
   * so it teaches like one, and what it taught counts as met.
   */
  adapted?: boolean;
  /** a story Claude wrote for the learner: it teaches the way a generated passage does */
  story?: boolean;
  /**
   * The first passage is a story's preface — its names and key words, which
   * the learner marks as known before reading. Its new characters count as
   * known for the chapters, and stay off the shelf's list.
   */
  preface?: boolean;
  /** the syllabus, to find the words a passage leaves unexplained; none, and nothing is looked for */
  lib?: Library;
}

/** What `model` says on a story Claude wrote for the learner. */
export const STORY_MODEL = 'Claude · story';

/** What `model` says on a passage retold from a book: Claude's writing, not the book's. */
export const adaptedModel = (source: string) => `Claude · adapted from ${source || 'a book'}`;

export interface Measured {
  text: Omit<GeneratedText, 'id' | 'createdAt' | 'read'>;
  cover: Coverage;
  /** the share of the running text already known */
  running: number;
  /** the story's preface */
  preface?: boolean;
  /**
   * Words the reader will cut out of it — off the HSK lists — that its
   * `vocab` gives no meaning for. Tapped, they would open a drawer with no
   * translation, or the dictionary's first sense, so they are found before
   * saving. Empty when no library was given to cut by.
   */
  unglossed: string[];
}

/** Sentences per length, as the plan's lengths count them. */
const lengthFor = (lines: number): TextLength =>
  LENGTHS.find((l) => lines <= l.range[1])?.id ?? 'long';

/**
 * How far past the learner a book passage goes. A generated passage is asked
 * for at a level; a book's is whatever the book is, so it is read off how much
 * of it could be read already.
 */
const levelFor = (known: number): Level =>
  known >= 0.95 ? 'comfort' : known >= 0.85 ? 'edge' : known >= 0.7 ? 'stretch' : 'beyond';

/**
 * How much of a passage can be read already, counted the way it is read: a
 * character that comes up nine times is nine of its characters. The distinct
 * count says how much there is to learn; this says how the reading will go.
 */
export function runningCoverage(lines: Array<Pick<TextLine, 'zh'>>, known: ReadonlySet<string>): number {
  let all = 0;
  let mine = 0;
  for (const l of lines) {
    for (const c of l.zh) {
      if (!isHanzi(c)) continue;
      all++;
      if (known.has(c)) mine++;
    }
  }
  return all ? mine / all : 1;
}

/** The passages in Claude's JSON, read as strictly as a person's paste is read loosely. */
function draftsOf(reply: string): DraftText[] {
  const parsed = parseResponse(reply);
  if (parsed.route !== 'clean') {
    throw new Error(
      parsed.problems.join(' ') ||
        'The JSON only read after repairs (a trailing comma, a raw newline, a curly quote): write it again as valid JSON.',
    );
  }
  return parsed.drafts;
}

interface Inventory {
  /** the characters marked learned */
  basis: string[];
  /** what generated passages taught besides */
  met: string[];
  known: Set<string>;
}

function inventoryOf(doc: Doc): Inventory {
  const basis = knownChars(doc);
  const inBasis = new Set(basis);
  const met = [...taughtAlready(shelfOf(doc).texts)].filter((c) => !inBasis.has(c));
  return { basis, met, known: new Set([...basis, ...met]) };
}

function measure(draft: DraftText, inv: Inventory, o: PassageOptions): Measured {
  const model = o.story ? STORY_MODEL : o.adapted ? adaptedModel(o.source) : bookModel(o.source);
  const base = toText({ draft, spec: null }, { basis: inv.basis, met: inv.met, supplement: '' }, model);
  const cover = coverageOf(base, inv.known);
  return {
    text: {
      ...base,
      topic: o.source || base.topic,
      genre: o.genre,
      length: lengthFor(base.lines.length),
      level: levelFor(cover.ratio),
    },
    cover,
    running: runningCoverage(base.lines, inv.known),
    unglossed: o.lib ? unglossedWords(base, o.lib) : [],
  };
}

/**
 * The words the text page will cut out of a passage, the way it cuts them —
 * its own vocabulary and the writer's grouping in the pinyin included — that
 * are on no HSK list and that the passage gives no meaning for.
 */
export function unglossedWords(text: Pick<GeneratedText, 'lines' | 'vocab'>, lib: Library): string[] {
  const glossed = new Set(text.vocab.filter((v) => v.d.trim()).map((v) => v.w));
  const own = new Set(text.vocab.map((v) => v.w));
  const out = new Set<string>();
  for (const l of text.lines) {
    for (const t of segment(l.zh, lib, new Set([...own, ...writerHints(l.zh, l.py, lib)]))) {
      if (t.word && [...t.text].length > 1 && !lib.byWord.has(t.text) && !glossed.has(t.text)) out.add(t.text);
    }
  }
  return [...out];
}

/** The syllabus as the app ships it, read once, for the commands that cut words. */
let shipped: Library | null | undefined;
export function libraryOnDisk(root = '.'): Library | null {
  if (shipped !== undefined) return shipped;
  try {
    const read = <T>(f: string): T => JSON.parse(readFileSync(join(root, 'public/data', f), 'utf8')) as T;
    const characters = read<{ items: CharacterEntry[] }>('characters.json').items;
    const words = read<{ items: SyllabusWord[] }>('words.json').items;
    shipped = {
      characters,
      themes: [],
      components: {},
      strokes: {},
      byChar: new Map(characters.map((c) => [c.c, c])),
      words,
      byWord: new Map(words.map((w) => [w.w, w])),
    };
  } catch {
    shipped = null;
  }
  return shipped;
}

/**
 * Each passage measured in turn. What Claude wrote teaches, so what one
 * passage brought in is known by the next: chapter two counts chapter one's
 * new words as met, as it will when it is read. A book's passages do not.
 */
function measureAll(drafts: DraftText[], inv: Inventory, o: PassageOptions): Measured[] {
  const teaches = o.story || o.adapted;
  return drafts.map((d, i) => {
    const m = measure(d, inv, o);
    if (teaches) {
      for (const c of m.text.teach) {
        if (inv.known.has(c)) continue;
        inv.met.push(c);
        inv.known.add(c);
      }
    }
    return o.preface && i === 0 ? { ...m, preface: true } : m;
  });
}

/** The passages measured against what the account can read, and saved nowhere. */
export function checkBookTexts(doc: Doc, reply: string, o: PassageOptions): Measured[] {
  return measureAll(draftsOf(reply), inventoryOf(doc), o);
}

/* ----------------------------------------------------------- adding some */

export interface BookOptions extends PassageOptions {
  /** an existing session, by id or by name */
  set?: string;
  /** a session by this name, made when there is none */
  newSet?: string;
  /** the chapters' new words onto the shelf's own list, which Cards ask from */
  learn?: boolean;
  now: number;
  id: () => string;
}

export interface BookResult {
  document: Doc;
  set: TextSet;
  madeSet: boolean;
  /** how many new things went onto the shelf's list */
  onList?: { added: number };
  added: Array<Measured & { text: GeneratedText }>;
  /** already on the shelf, by Chinese title */
  skipped: string[];
}

/** A passage is on the shelf already when its title and first line are. */
const shelfKey = (t: Pick<GeneratedText, 'titleZh' | 'lines'>) => `${t.titleZh}|${t.lines[0]?.zh ?? ''}`;

function pickSet(sets: TextSet[], o: BookOptions): { set: TextSet; made: boolean } {
  const named = (name: string) =>
    sets.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (o.set?.trim()) {
    const found = sets.find((s) => s.id === o.set) ?? named(o.set);
    if (found) return { set: found, made: false };
    throw new Error(
      `No reading session “${o.set}”. There are: ${sets.map((s) => `“${s.name}”`).join(', ') || 'none yet'}.`,
    );
  }
  if (o.newSet?.trim()) {
    const found = named(o.newSet);
    if (found) return { set: found, made: false };
    return { set: { id: o.id(), name: o.newSet.trim(), createdAt: o.now }, made: true };
  }
  throw new Error('Which reading session? --set <id or name>, or --new-set <name>.');
}

/**
 * The workspace with these passages in it.
 *
 * Only `texts` and `sets` change, the way `text/add` changes them: a new
 * session goes first, the passages go in newest first so the session reads
 * them in the order given. Everything else in the document is passed through
 * as it was read, including whatever a newer build put there.
 */
export function addBookTexts(doc: Doc, reply: string, o: BookOptions): BookResult {
  if (typeof doc.version !== 'number' || doc.version > VERSION) {
    throw new Error(`The workspace is version ${String(doc.version)} and this checkout writes ${VERSION}: pull main first.`);
  }
  const drafts = draftsOf(reply);
  const { texts, sets } = shelfOf(doc);
  const target = pickSet(sets, o);
  const inv = inventoryOf(doc);
  const shelved = new Set(texts.map(shelfKey));

  const added: BookResult['added'] = [];
  const skipped: string[] = [];
  for (const m of measureAll(drafts, inv, o)) {
    if (shelved.has(shelfKey(m.text))) {
      skipped.push(m.text.titleZh);
      continue;
    }
    shelved.add(shelfKey(m.text));
    added.push({
      ...m,
      text: {
        ...m.text,
        setId: target.set.id,
        id: o.id(),
        // A millisecond apart, as a pasted batch is.
        createdAt: o.now + added.length,
        read: false,
      },
    });
  }

  const fresh = added.map((a) => a.text);
  const made = target.made && fresh.length > 0;
  const document: Doc = {
    ...doc,
    sets: made ? [target.set, ...sets] : sets,
    texts: [...fresh].reverse().concat(texts),
  };
  const learn = o.learn ? toLearn(added.filter((a) => !a.preface).map((a) => a.text)) : [];
  const onList = learn.length ? onShelfList(document, target.set.id, learn) : undefined;
  return { document, set: target.set, madeSet: made, onList, added, skipped };
}

/**
 * What a story's chapters bring that is worth learning, as the shelf's list
 * holds it: the new words, as words — 东西 is learned as 东西, not as 东 and
 * 西 — and any new character no new word covers, as itself.
 */
function toLearn(texts: GeneratedText[]): ItemId[] {
  const out: ItemId[] = [];
  for (const t of texts) {
    const words = t.vocab.filter((v) => v.isNew).map((v) => v.w);
    out.push(...words.map(wordId));
    out.push(...t.teach.filter((c) => !words.some((w) => w.includes(c))).map(charId));
  }
  return [...new Set(out)];
}

/**
 * Onto the shelf's own list, after what is there, each once: the list the
 * text page's "Learn this word" adds to, which Cards ask from. A shelf is its
 * own word list now, so nothing is gathered into a collection.
 */
function onShelfList(doc: Doc, setId: string, items: ItemId[]) {
  const sets = Array.isArray(doc.sets) ? (doc.sets as TextSet[]) : [];
  const set = sets.find((x) => x.id === setId);
  if (!set) return undefined;
  const fresh = items.filter((id) => !(set.study ?? []).includes(id));
  doc.sets = sets.map((x) => (x === set ? { ...x, study: [...(x.study ?? []), ...fresh] } : x));
  return { added: fresh.length };
}

/* ------------------------------------------------------------ the voice */

/**
 * Every text on the shelf, read aloud once in one of the app's own voices and
 * kept in the database the site uses — newest first, so the text being read
 * this week is ready first. Safari will not let a web page use the natural
 * voices downloaded in Settings, so this is how a text sounds like a person
 * on the iPhone. Sentences already recorded are skipped, so running it again
 * after adding a text records only that text.
 */
async function record(o: { voice?: string; set?: string }) {
  loadEnvFile();
  const env = process.env;
  const live = localVoicesFromEnv(env, process.cwd());
  if (!live) throw new Error('The voices are not on this computer. This runs on the Mac that ran `npm run voices`.');
  const voice = live.voices.find((v) => v.id === (o.voice ?? 'wang')) ?? (o.voice ? null : live.voices[0]);
  if (!voice) throw new Error(`There is no voice “${o.voice}”. These are: ${live.voices.map((v) => v.id).join(', ')}.`);
  if (![env.HANZI_DB, env.POSTGRES_URL, env.DATABASE_URL].some((v) => v?.trim())) throw new Error(SETUP);
  const config = loadConfig(env, { port: 4173, serveStatic: false });
  const { stores, close } = await openStores(config.database);
  try {
    const user = env.HANZI_USER?.trim() || 'admin';
    const found = await stores.users.findByUsernameKey(usernameKey(user));
    if (!found) throw new Error(`No account “${user}” in ${describeDatabase(config.database)}.`);
    const services = createServices(stores, { talkVoices: live });
    const { document } = await services.workspaces.get(found.id);
    if (!isDoc(document)) throw new Error(`${found.username} has never saved anything.`);
    const { texts, sets } = shelfOf(document);
    const set = o.set ? sets.find((s) => s.id === o.set || s.name === o.set) : null;
    if (o.set && !set) throw new Error(`No reading session “${o.set}”.`);
    const passages = texts
      .filter((t) => !set || t.setId === set.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({ title: t.titleZh || t.title, lines: t.lines.map((l) => l.zh) }));
    console.log(`\n  ${passages.length} texts of ${found.username}'s, in ${voice.name}, into ${describeDatabase(config.database)}.\n`);
    const { recorded, already } = await services.recordings.recordAll(passages, voice.id, (line) => console.log(`  ${line}`));
    console.log(`\n  ${recorded} sentences recorded; ${already} were already.\n`);
  } finally {
    live.close();
    await close();
  }
}

/* ------------------------------------------------------------ an account */

interface Account extends PictureAccount {
  /** who and where, for the report */
  where: string;
  read(): Promise<{ revision: number; document: unknown }>;
  /** false when the workspace moved past `baseRevision` */
  write(baseRevision: number, document: Doc): Promise<boolean>;
  close(): Promise<void>;
}

const SETUP = `No account to write to. Either
  · HANZI_SITE (the deployed site's address), HANZI_USER and HANZI_PASSWORD — from a cloud session; or
  · POSTGRES_URL in .env (or HANZI_DB) — on the Mac, as npm run admin uses.`;

async function openAccount(): Promise<Account> {
  loadEnvFile();
  const env = process.env;
  const user = env.HANZI_USER?.trim() || 'admin';
  const site = env.HANZI_SITE?.trim();
  if (site) return siteAccount(site.replace(/\/+$/, ''), user, env.HANZI_PASSWORD ?? '');
  // Never the default SQLite file by accident: a run that names no database
  // would otherwise make an empty one and report that the account is missing.
  if (![env.HANZI_DB, env.POSTGRES_URL, env.DATABASE_URL].some((v) => v?.trim())) throw new Error(SETUP);
  return databaseAccount(user);
}

async function databaseAccount(user: string): Promise<Account> {
  const config = loadConfig(process.env, { port: 4173, serveStatic: false });
  const { stores, close } = await openStores(config.database);
  const found = await stores.users.findByUsernameKey(usernameKey(user));
  if (!found) {
    await close();
    throw new Error(`No account “${user}” in ${describeDatabase(config.database)}.`);
  }
  const { workspaces, pictures } = createServices(stores);
  return {
    where: `${found.username} on ${describeDatabase(config.database)}`,
    read: () => workspaces.get(found.id),
    getPicture: (key) => pictures.get(found.id, key).catch(() => null),
    putPicture: (key, mime, bytes) => pictures.put(found.id, key, mime, bytes),
    async write(baseRevision, document) {
      try {
        await workspaces.save(found.id, baseRevision, document);
        return true;
      } catch (err) {
        if (err instanceof RevisionConflictError) return false;
        throw err;
      }
    },
    close,
  };
}

async function failure(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return body?.error?.message ?? `${res.status} ${res.statusText}`;
}

async function siteAccount(site: string, user: string, password: string): Promise<Account> {
  if (!password) throw new Error(`HANZI_SITE is set and HANZI_PASSWORD is not.\n${SETUP}`);
  const json = { 'content-type': 'application/json' };
  const login = await fetch(`${site}${API.login}`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ username: user, password }),
  });
  if (!login.ok) throw new Error(`Signing in to ${site} as ${user}: ${await failure(login)}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0] ?? '')
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error(`${site} signed ${user} in but sent no session cookie.`);
  const headers = { ...json, cookie };
  return {
    where: `${user} on ${new URL(site).host}`,
    async read() {
      const res = await fetch(`${site}${API.workspace}`, { headers });
      if (!res.ok) throw new Error(`Reading the workspace: ${await failure(res)}`);
      return (await res.json()) as WorkspaceDto;
    },
    async write(baseRevision, document) {
      const body: SaveWorkspaceRequest = { baseRevision, document };
      const res = await fetch(`${site}${API.workspace}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (res.ok) return true;
      const refusal = (await res.json().catch(() => null)) as ApiErrorBody | null;
      if (res.status === 409 && refusal?.error?.code === 'conflict') return false;
      throw new Error(`Saving the workspace: ${refusal?.error?.message ?? `${res.status} ${res.statusText}`}`);
    },
    async getPicture(key) {
      const res = await fetch(`${site}${API.pictures}/${key}`, { headers: { cookie } });
      if (!res.ok) return null;
      return { mime: res.headers.get('content-type') ?? 'image/jpeg', bytes: new Uint8Array(await res.arrayBuffer()) };
    },
    async putPicture(key, mime, bytes) {
      const res = await fetch(`${site}${API.pictures}/${key}`, {
        method: 'PUT',
        headers: { cookie, 'content-type': mime },
        body: bytes as Uint8Array<ArrayBuffer>,
      });
      if (!res.ok) throw new Error(`Keeping the picture: ${await failure(res)}`);
    },
    // One sign-in per run, signed out again so the account's sessions do not pile up.
    async close() {
      await fetch(`${site}${API.logout}`, { method: 'POST', headers }).catch(() => undefined);
    },
  };
}

/**
 * The pictures the texts just added describe, drawn straight away when there
 * is a key to draw them with; otherwise said, so they can be drawn later.
 */
async function drawAdded(account: Account, result: BookResult, style?: string) {
  const described = result.added.filter((a) => a.text.pictures?.length);
  if (!described.length) return;
  const count = described.reduce((n, a) => n + (a.text.pictures?.length ?? 0), 0);
  const painter = geminiFromEnv(process.env);
  if (!painter) {
    console.log(`  ${count} picture${count === 1 ? '' : 's'} described. GEMINI_API_KEY is not set, so they are not drawn yet:`);
    console.log(`  npm run texts -- illustrate --set "${result.set.name}" once it is.\n`);
    return;
  }
  const { failed } = await illustrate(account, painter, {
    textIds: described.map((a) => a.text.id),
    style,
    say: (line) => console.log(`  ${line}`),
  });
  console.log(failed ? `\n  ${failed} not drawn: npm run texts -- illustrate --set "${result.set.name}" tries them again.\n` : '');
}

/* ------------------------------------------------------------ the command */

const USAGE = `
  npm run texts -- sets
  npm run texts -- check <reply.json> [--adapted | --story [--preface]]
  npm run texts -- add <reply.json> --set <id or name> [--source <book>] [--genre <genre>] [--adapted] [--dry-run]
  npm run texts -- add <reply.json> --new-set <name> [--source <book>] [--genre <genre>] [--adapted] [--dry-run]
  npm run texts -- add <story.json> --new-set <title> --story [--preface] [--learn] [--genre story]
  npm run texts -- illustrate [--set <id or name>] [--text <id>] [--redo] [--style "…"] [--dry-run]
  npm run texts -- describe <pictures.json>    { "pictures": { "<text id>": [{ "para": 0, "prompt": "…" }] } }
  npm run texts -- boxes <text id> <boxes.json>
  npm run texts -- put <text id> <picture for ¶1> <picture for ¶2> …
  npm run texts -- record [--voice wang] [--set <id or name>]    on the Mac: the texts, read aloud for the site
`;

const percent = (r: number) => `${Math.round(r * 100)}%`;

function describe({ text, cover, running, preface, unglossed }: Measured, path = '') {
  console.log(`\n  ${preface ? '(preface) ' : ''}${text.titleZh} — ${text.title}${path ? `   ${path}` : ''}`);
  console.log(
    `    ${text.lines.length} sentences · ${textCharCount(text)} characters, ${percent(running)} of them known · ${cover.total} distinct, ${cover.fresh.length} new · ${text.level}`,
  );
  console.log(`    new: ${text.teach.join('') || 'none'}`);
  console.log(`    ${text.vocab.length} words · ${text.grammar.length} grammar · ${text.questions.length} questions`);
  if (unglossed.length) console.log(`    off the HSK lists, with no meaning in vocab: ${unglossed.join('、')}`);
}

function report(result: BookResult, where: string, dryRun: boolean) {
  const n = result.added.length;
  console.log(
    n
      ? `\n  ${dryRun ? 'Would add' : 'Added'} ${n} text${n === 1 ? '' : 's'} to ${result.madeSet ? 'the new' : 'the'} session “${result.set.name}” · ${where}`
      : `\n  Nothing new for “${result.set.name}” · ${where}`,
  );
  for (const a of result.added) describe(a, `/texts/${a.text.id}`);
  for (const title of result.skipped) console.log(`\n  ${title} — already on the shelf, left as it was`);
  if (result.onList) console.log(`\n  ${result.onList.added} new words and characters ${dryRun ? 'would go' : 'went'} onto the shelf’s list`);
  console.log('');
}

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      set: { type: 'string' },
      'new-set': { type: 'string' },
      source: { type: 'string', default: '' },
      genre: { type: 'string', default: 'description' },
      adapted: { type: 'boolean', default: false },
      story: { type: 'boolean', default: false },
      preface: { type: 'boolean', default: false },
      learn: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      voice: { type: 'string' },
      text: { type: 'string', multiple: true },
      redo: { type: 'boolean', default: false },
      style: { type: 'string' },
    },
  });

  if (command === 'record') {
    await record({ voice: values.voice, set: values.set });
    return;
  }
  if (command === 'put') {
    const [textId, ...files] = positionals;
    if (!textId || !files.length) throw new Error(`Which text, and which pictures?\n${USAGE}`);
    const account = await openAccount();
    try {
      await putDrawn(account, textId, files, (line) => console.log(`  ${line}`));
    } finally {
      await account.close();
    }
    return;
  }
  if (command === 'boxes') {
    const [textId, file] = positionals;
    if (!textId || !file) throw new Error(`Which text, and which boxes?\n${USAGE}`);
    const wanted = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const account = await openAccount();
    try {
      for (let attempt = 1; ; attempt++) {
        const { revision, document } = await account.read();
        if (!isDoc(document)) throw new Error(`${account.where} has never saved anything.`);
        const { texts } = shelfOf(document);
        const text = texts.find((t) => t.id === textId);
        if (!text) throw new Error(`No text ${textId} on ${account.where}.`);
        const lines = text.lines.map((l, i) => {
          if (!(String(i) in wanted)) return l;
          // Read through the same parser as a pasted line, so a box off the photo is refused here too.
          const box = asLine({ zh: l.zh, box: wanted[String(i)] })?.box;
          if (!box) throw new Error(`Line ${i}: ${JSON.stringify(wanted[String(i)])} is not a place on the page.`);
          return { ...l, box };
        });
        const next = { ...document, texts: texts.map((t) => (t.id === textId ? { ...t, lines } : t)) };
        if (values['dry-run'] || (await account.write(revision, next))) {
          console.log(`  ${text.titleZh || text.title}: ${Object.keys(wanted).length} boxes put${values['dry-run'] ? ' (dry run)' : ''}`);
          return;
        }
        if (attempt === 3) throw new Error('The workspace kept changing under this save. Try again in a minute.');
      }
    } finally {
      await account.close();
    }
  }
  if (command === 'describe') {
    const file = positionals[0];
    if (!file) throw new Error(`Which file?\n${USAGE}`);
    const wanted = (JSON.parse(readFileSync(file, 'utf8')) as { pictures?: Record<string, Array<{ para: number; prompt: string }>> }).pictures ?? {};
    const account = await openAccount();
    try {
      for (let attempt = 1; ; attempt++) {
        const { revision, document } = await account.read();
        if (!isDoc(document)) throw new Error(`${account.where} has never saved anything.`);
        const { texts } = shelfOf(document);
        const missing = Object.keys(wanted).filter((id) => !texts.some((t) => t.id === id));
        if (missing.length) throw new Error(`No text ${missing.join(', ')} on ${account.where}.`);
        const next = { ...document, texts: texts.map((t) => (wanted[t.id] ? withDescribed(t, wanted[t.id]!) : t)) };
        if (values['dry-run'] || (await account.write(revision, next))) {
          for (const t of texts.filter((x) => wanted[x.id])) {
            console.log(`  ${t.titleZh || t.title}: ${wanted[t.id]!.length} pictures described${values['dry-run'] ? ' (dry run)' : ''}`);
          }
          return;
        }
        if (attempt === 3) throw new Error('The workspace kept changing under this save. Try again in a minute.');
      }
    } finally {
      await account.close();
    }
  }
  if (command === 'illustrate') {
    const account = await openAccount();
    try {
      const { failed } = await illustrate(account, geminiFromEnv(process.env), {
        set: values.set,
        textIds: values.text,
        redo: values.redo,
        style: values.style,
        dryRun: values['dry-run'],
        say: (line) => console.log(`  ${line}`),
      });
      if (failed) process.exitCode = 1;
    } finally {
      await account.close();
    }
    return;
  }
  if (command !== 'sets' && command !== 'check' && command !== 'add') {
    console.log(USAGE);
    if (command) process.exitCode = 1;
    return;
  }
  const genre = GENRES.find((g) => g.id === values.genre)?.id;
  if (!genre) throw new Error(`--genre is one of ${GENRES.map((g) => g.id).join(', ')}.`);
  const file = positionals[0];
  if (command !== 'sets' && !file) throw new Error(`Which file?\n${USAGE}`);
  const passage = {
    source: values.source.trim(),
    genre,
    adapted: values.adapted,
    story: values.story,
    preface: values.preface,
    lib: libraryOnDisk() ?? undefined,
  };
  const reply = file ? readFileSync(file, 'utf8') : '';

  const account = await openAccount();
  try {
    if (command === 'sets') {
      const { document } = await account.read();
      if (!isDoc(document)) throw new Error(`${account.where} has never saved anything: open the app on it once first.`);
      console.log(JSON.stringify({ account: account.where, ...describeShelf(document) }, null, 2));
      return;
    }
    if (command === 'check') {
      const { document } = await account.read();
      if (!isDoc(document)) throw new Error(`${account.where} has never saved anything: open the app on it once first.`);
      console.log(`\n  Measured against what ${account.where} can read; nothing saved.`);
      for (const m of checkBookTexts(document, reply, passage)) describe(m);
      console.log('');
      return;
    }
    for (let attempt = 1; ; attempt++) {
      const { revision, document } = await account.read();
      if (!isDoc(document)) throw new Error(`${account.where} has never saved anything: open the app on it once first.`);
      const result = addBookTexts(document, reply, {
        set: values.set,
        newSet: values['new-set'],
        learn: values.learn,
        ...passage,
        now: Date.now(),
        id: newId,
      });
      if (!result.added.length || values['dry-run']) {
        report(result, account.where, true);
        return;
      }
      // Every word the page will offer to explain has to have an explanation.
      const bare = result.added.filter((a) => a.unglossed.length);
      if (bare.length) {
        throw new Error(
          `Off the HSK lists and not in vocab, so a tap would find no meaning — add them to the passage's vocab with py and d:\n${bare
            .map((a) => `    ${a.text.titleZh}: ${a.unglossed.join('、')}`)
            .join('\n')}`,
        );
      }
      if (await account.write(revision, result.document)) {
        report(result, account.where, false);
        await drawAdded(account, result, values.style);
        return;
      }
      if (attempt === 3) throw new Error('The workspace kept changing under this save. Try again in a minute.');
    }
  } finally {
    await account.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main(process.argv.slice(2));
  } catch (err) {
    console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
