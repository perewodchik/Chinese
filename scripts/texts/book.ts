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
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createServices } from '../../server/src/composition';
import { describeDatabase, loadConfig, loadEnvFile } from '../../server/src/config';
import { RevisionConflictError } from '../../server/src/domain/errors';
import { SESSION_COOKIE } from '../../server/src/http/request';
import { openStores } from '../../server/src/infrastructure/stores';
import { API, type ApiErrorBody, type SaveWorkspaceRequest, type WorkspaceDto } from '../../shared/api';
import { usernameKey } from '../../shared/credentials';
import { idValue, isCharId, isWordId } from '../../src/domain/ids';
import { parseResponse, toText, type DraftText } from '../../src/domain/parse';
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
  };
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
}

/** What `model` says on a passage retold from a book: Claude's writing, not the book's. */
export const adaptedModel = (source: string) => `Claude · adapted from ${source || 'a book'}`;

export interface Measured {
  text: Omit<GeneratedText, 'id' | 'createdAt' | 'read'>;
  cover: Coverage;
  /** the share of the running text already known */
  running: number;
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
  const model = o.adapted ? adaptedModel(o.source) : bookModel(o.source);
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
  };
}

/** The passages measured against what the account can read, and saved nowhere. */
export function checkBookTexts(doc: Doc, reply: string, o: PassageOptions): Measured[] {
  const inv = inventoryOf(doc);
  return draftsOf(reply).map((d) => measure(d, inv, o));
}

/* ----------------------------------------------------------- adding some */

export interface BookOptions extends PassageOptions {
  /** an existing session, by id or by name */
  set?: string;
  /** a session by this name, made when there is none */
  newSet?: string;
  now: number;
  id: () => string;
}

export interface BookResult {
  document: Doc;
  set: TextSet;
  madeSet: boolean;
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
  for (const draft of drafts) {
    const m = measure(draft, inv, o);
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
  return {
    document: {
      ...doc,
      sets: made ? [target.set, ...sets] : sets,
      texts: [...fresh].reverse().concat(texts),
    },
    set: target.set,
    madeSet: made,
    added,
    skipped,
  };
}

/* ------------------------------------------------------------ an account */

interface Account {
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
  const { workspaces } = createServices(stores);
  return {
    where: `${found.username} on ${describeDatabase(config.database)}`,
    read: () => workspaces.get(found.id),
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
    // One sign-in per run, signed out again so the account's sessions do not pile up.
    async close() {
      await fetch(`${site}${API.logout}`, { method: 'POST', headers }).catch(() => undefined);
    },
  };
}

/* ------------------------------------------------------------ the command */

const USAGE = `
  npm run texts -- sets
  npm run texts -- check <reply.json> [--adapted]
  npm run texts -- add <reply.json> --set <id or name> [--source <book>] [--genre <genre>] [--adapted] [--dry-run]
  npm run texts -- add <reply.json> --new-set <name> [--source <book>] [--genre <genre>] [--adapted] [--dry-run]
`;

const percent = (r: number) => `${Math.round(r * 100)}%`;

function describe({ text, cover, running }: Measured, path = '') {
  console.log(`\n  ${text.titleZh} — ${text.title}${path ? `   ${path}` : ''}`);
  console.log(
    `    ${text.lines.length} sentences · ${textCharCount(text)} characters, ${percent(running)} of them known · ${cover.total} distinct, ${cover.fresh.length} new · ${text.level}`,
  );
  console.log(`    new: ${text.teach.join('') || 'none'}`);
  console.log(`    ${text.vocab.length} words · ${text.grammar.length} grammar · ${text.questions.length} questions`);
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
      'dry-run': { type: 'boolean', default: false },
    },
  });

  if (command !== 'sets' && command !== 'check' && command !== 'add') {
    console.log(USAGE);
    if (command) process.exitCode = 1;
    return;
  }
  const genre = GENRES.find((g) => g.id === values.genre)?.id;
  if (!genre) throw new Error(`--genre is one of ${GENRES.map((g) => g.id).join(', ')}.`);
  const file = positionals[0];
  if (command !== 'sets' && !file) throw new Error(`Which file?\n${USAGE}`);
  const passage = { source: values.source.trim(), genre, adapted: values.adapted };
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
        ...passage,
        now: Date.now(),
        id: newId,
      });
      if (!result.added.length || values['dry-run']) {
        report(result, account.where, true);
        return;
      }
      if (await account.write(revision, result.document)) {
        report(result, account.where, false);
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
