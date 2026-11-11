import type { AttemptKind } from '../../../shared/speechEval';
import type {
  ClaudeState,
  TalkConversation,
  TalkConversationSummary,
  TalkMode,
  TalkReply,
  TalkRequest,
} from '../../../shared/talk';
import type { AccountStatus, ApiToken, Session, User, Workspace, WorldSaveRecord } from '../domain/entities';

/**
 * What the use cases need from the outside world, and nothing about how it is
 * provided. SQLite, scrypt and the system clock are one answer to each; the
 * tests give others.
 */

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByUsernameKey(usernameKey: string): Promise<User | null>;
  /**
   * False when the name is already taken. Decided by the store rather than by
   * looking first, so two sign-ups for one name cannot both succeed.
   */
  insert(user: User): Promise<boolean>;
  updatePassword(id: string, passwordHash: string, at: number): Promise<void>;
  setRole(id: string, role: User['role'], at: number): Promise<void>;
  setStatus(id: string, status: AccountStatus, at: number): Promise<void>;
  countByRole(role: User['role']): Promise<number>;
  list(): Promise<User[]>;
  /** The account and, by the schema's cascades, everything it kept: sessions, work, keys, recordings of its texts. */
  delete(id: string): Promise<void>;
}

export interface SessionRepository {
  insert(session: Session): Promise<void>;
  /** The password was typed again in this session, at `at`. */
  verify(id: string, at: number): Promise<void>;
  findById(id: string): Promise<Session | null>;
  touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void>;
  delete(id: string): Promise<void>;
  /** Every session of one user except `keepId`; returns how many went. */
  deleteForUser(userId: string, keepId?: string): Promise<number>;
  deleteExpired(now: number): Promise<number>;
  /** One user's sessions still good at `now`, the one used last first. */
  listForUser(userId: string, now: number): Promise<Session[]>;
}

export type WorkspaceWrite =
  | { saved: true; revision: number; updatedAt: number }
  | { saved: false; current: Workspace | null };

/** The account's access tokens for scripts, kept as digests. */
export interface ApiTokenRepository {
  insert(token: ApiToken): Promise<void>;
  findByDigest(digest: string): Promise<ApiToken | null>;
  /** The account's tokens that are not revoked, expired ones too, newest first. */
  listForUser(userId: string): Promise<ApiToken[]>;
  /** Marks the account's token revoked; false when it has no such live one. */
  revoke(userId: string, id: string, at: number): Promise<boolean>;
  /** Every token of the account revoked, as a new password does; how many went. */
  revokeForUser(userId: string, at: number): Promise<number>;
  touch(id: string, at: number): Promise<void>;
}

export interface WorkspaceRepository {
  find(userId: string): Promise<Workspace | null>;
  /** The stored revision alone, without reading the document: 0 when there is none. */
  revisionOf(userId: string): Promise<number>;
  /**
   * Writes only if the stored revision is still `baseRevision` (0 meaning
   * nothing is stored yet) and the stored document's format `version` is no
   * newer than this one's, as one atomic compare-and-swap.
   */
  save(userId: string, baseRevision: number, document: unknown, at: number): Promise<WorkspaceWrite>;
}

export type WorldSaveWrite =
  | { saved: true; revision: number; updatedAt: number }
  | { saved: false; current: WorldSaveRecord | null };

/** 走走's saves, under the same compare-and-swap rule as the workspace. */
export interface WorldSaveRepository {
  find(userId: string): Promise<WorldSaveRecord | null>;
  revisionOf(userId: string): Promise<number>;
  /**
   * Writes only if the stored revision is still `baseRevision` (0: nothing
   * stored yet) and the stored save's `version` is no newer than this one's.
   */
  save(userId: string, baseRevision: number, save: unknown, at: number): Promise<WorldSaveWrite>;
}

/**
 * Conversations kept for a learner. Every call takes the user id as well as
 * the conversation id: the id is the whole of the address, so the store is
 * never asked for a conversation without being told whose it must be.
 */
export interface ConversationRepository {
  list(userId: string, limit: number): Promise<TalkConversationSummary[]>;
  find(userId: string, id: string): Promise<TalkConversation | null>;
  create(userId: string, conversation: TalkConversation): Promise<TalkConversation>;
  /** False when there is no such conversation of theirs to write over. */
  save(userId: string, conversation: TalkConversation): Promise<boolean>;
  delete(userId: string, id: string): Promise<boolean>;
}

/**
 * A sentence read aloud once, by a model on the home computer, and kept: the
 * website has no model, and plays the passage from these instead. One row a
 * sentence, voice and way of reading, whoever asked for it — a recording of
 * 天空是蓝色的 is the same recording for everybody.
 */
export interface Recording {
  /** the voice, the mode and the text, digested (recordings.ts) */
  key: string;
  voice: VoiceInfo;
  text: string;
  mp3: Uint8Array;
  createdAt: number;
}

export interface RecordingRepository {
  find(key: string): Promise<Uint8Array | null>;
  /** which of these keys are kept */
  have(keys: readonly string[]): Promise<Set<string>>;
  /** keeps it; a recording already kept under the key stays as it is */
  save(recording: Recording): Promise<void>;
  /** keeps it, in place of whatever was kept under the key: a sentence read again */
  replace(recording: Recording): Promise<void>;
  /** every voice anything is kept in */
  voices(): Promise<VoiceInfo[]>;
}

/**
 * A picture drawn for a paragraph of a text, kept under the digest of its
 * bytes. The workspace holds where it goes and what it shows; this holds the
 * picture, for its owner only.
 */
export interface Picture {
  /** SHA-256 of the bytes, in hex */
  key: string;
  userId: string;
  mime: string;
  bytes: Uint8Array;
  createdAt: number;
}

export interface PictureRepository {
  find(key: string): Promise<Picture | null>;
  /** keeps it; a picture already kept under the key stays as it is */
  save(picture: Picture): Promise<void>;
}

/**
 * A learner's own secrets for services the app calls on their behalf (a voice
 * service's API key): kept on the server, never sent back to a page.
 */
export interface SecretRepository {
  get(userId: string, name: string): Promise<string | null>;
  set(userId: string, name: string, value: string, at: number): Promise<void>;
  delete(userId: string, name: string): Promise<void>;
}

/**
 * One thing said aloud and scored: a line in Phrases, a word in the tone
 * drills or a sound lesson. Kept per account, so every device sees the same
 * history. `summary` is the page's own short account of the try (its scores
 * and faults), `result` the service's whole answer, kept for what may be
 * worked out from it later.
 */
export interface SpeechAttempt {
  id: string;
  userId: string;
  at: number;
  kind: AttemptKind;
  /** the text, everyday or own text a line came from */
  sourceId: string | null;
  /** what was said */
  text: string;
  /** a drill's tally: "pair:3-3", "tone:2", "say:q" */
  tally: string | null;
  good: boolean;
  summary: string | null;
  result: string | null;
}

export interface SpeechAttemptRepository {
  /** kept, unless one with the same id already is */
  add(items: SpeechAttempt[]): Promise<void>;
  /** every attempt of the user's, oldest first, without the services' answers */
  list(userId: string): Promise<Array<Omit<SpeechAttempt, 'result'> & { hasResult: boolean }>>;
  /** one attempt, with the service's answer */
  find(userId: string, id: string): Promise<SpeechAttempt | null>;
  /** gone, if it was the user's */
  delete(userId: string, id: string): Promise<boolean>;
}

/** How a narrator sounds, beyond its voice. */
export interface VoiceTuning {
  /** 0.5–2, 1 is the service's normal pace */
  speed: number;
  /** -12–12 semitones */
  pitch: number;
  /** the service's emotion, or null to let it follow the text */
  emotion: string | null;
}

/** A voice service that reads Mandarin aloud with a key the learner gives. */
export interface Narrator {
  /** the service's Mandarin voices; refused if the key is not good */
  voices(key: string): Promise<Array<{ id: string; name: string; description: string }>>;
  /** one sentence as MP3 */
  read(key: string, text: string, voice: string, tuning: VoiceTuning): Promise<Uint8Array>;
  /**
   * A whole text read in one go, and where each of the service's sentences
   * begins and ends in it, in milliseconds, when it says.
   */
  readText(key: string, text: string, voice: string, tuning: VoiceTuning): Promise<{ audio: Uint8Array; segments: Array<{ text: string; start: number; end: number }> | null }>;
  /** a new voice made from a description, and its first words read in it */
  design(key: string, prompt: string, previewText: string): Promise<{ voiceId: string; trial: Uint8Array }>;
  /** the voices made from descriptions that the account still keeps, each taking one of its slots */
  designed?(key: string): Promise<string[]>;
  /** one of those given up, freeing its slot */
  forget?(key: string, voiceId: string): Promise<void>;
}

/** A narrator the learner made: a voice of the service's, a name, how it sounds. */
export interface NarratorRecord extends VoiceTuning {
  id: string;
  userId: string;
  name: string;
  /** made from a description, or one of the service's own voices */
  kind: 'designed' | 'system' | 'cast';
  /** the service's id for the voice */
  voiceId: string;
  /** what it was made from, kept to make it again */
  prompt: string;
  previewText: string;
  createdAt: number;
  updatedAt: number;
}

/** A whole text read by a narrator, kept so it is never paid for twice. */
export interface TextNarration {
  /** the narrator and the sentences, digested */
  key: string;
  userId: string;
  narratorId: string;
  mp3: Uint8Array;
  /** where each sentence starts and ends, in milliseconds, in the text's order */
  timings: Array<[number, number]>;
  durationMs: number;
  createdAt: number;
}

export interface TextNarrationRepository {
  find(key: string): Promise<TextNarration | null>;
  /** what is kept under these keys, without the audio */
  have(keys: readonly string[]): Promise<Array<Omit<TextNarration, 'mp3'>>>;
  save(n: TextNarration): Promise<void>;
}

/** A text of the learner's own, read by a narrator: kept with its reading, and the Read text made from it. */
export interface OwnText {
  id: string;
  userId: string;
  title: string;
  lines: string[];
  narratorId: string;
  /** the reading in text_narrations, as it was when read */
  narrationKey: string;
  /** the text in Read made from it, once saved there */
  textId: string | null;
  createdAt: number;
}

export interface OwnTextRepository {
  list(userId: string): Promise<OwnText[]>;
  find(userId: string, id: string): Promise<OwnText | null>;
  save(text: OwnText): Promise<void>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface NarratorRepository {
  list(userId: string): Promise<NarratorRecord[]>;
  find(userId: string, id: string): Promise<NarratorRecord | null>;
  save(narrator: NarratorRecord): Promise<void>;
  delete(userId: string, id: string): Promise<boolean>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface Tokens {
  /** a new unguessable secret, for a cookie */
  secret(): string;
  /** what is stored in place of a secret */
  digest(secret: string): string;
  id(): string;
}

export interface Clock {
  now(): number;
}

/** A voice the app can ask for by its short name. */
export interface VoiceInfo {
  /** what the app asks for: "xiaoxiao" */
  id: string;
  /** what the learner sees: "Xiaoxiao" */
  name: string;
  gender: 'female' | 'male';
}

/**
 * Mandarin read aloud by a voice that sounds like a person — the reference a
 * learner imitates, which the browser's own system voice is not good enough
 * to be. Optional: without one, the app falls back to the system voice.
 */
export interface SpeechSynthesizer {
  readonly voices: VoiceInfo[];
  /** MP3 bytes. `slow` reads at about three quarters of normal speed. */
  synthesize(text: string, voice: string, slow: boolean): Promise<Uint8Array>;
  /** Gets one voice ready to be asked, when getting ready is slow: a model to load. Optional. */
  warm?(voice?: string): void;
}

/**
 * The voices that read a conversation, which is a different job from reading
 * a word: a mode rather than a slow flag, because slow here is a different
 * reading and not the same one dragged out.
 */
export interface TalkSynthesizer {
  readonly voices: VoiceInfo[];
  /** MP3 bytes, read the way `mode` asks for. */
  synthesize(text: string, voice: string, mode: TalkMode): Promise<Uint8Array>;
  /** Gets one voice ready to be asked, when getting ready is slow: a model to load. Optional. */
  warm?(voice?: string): void;
}

/**
 * Claude, as a partner to talk Mandarin with — reached through the learner's
 * own subscription, never through a key billed per word.
 */
export interface Tutor {
  /** Whether it can answer now; cheap enough to ask on every page load. */
  status(): Promise<ClaudeState>;
  /** Claude's next turn. Throws `TutorUnavailableError` when it cannot be reached at all. */
  reply(request: TalkRequest): Promise<TalkReply>;
  /**
   * One prompt, one answer, in Claude's own words — what a chat would have
   * said to the text the learner would otherwise have pasted into it. Used by
   * the writing session and the word list builder, which have always ended in
   * a clipboard and need not when Claude is on this machine.
   */
  ask(prompt: string, opts?: { timeoutMs?: number }): Promise<string>;
}

/** An invitation to make an account: the code itself is never kept, only its digest. */
export interface Invite {
  digest: string;
  note: string;
  createdAt: number;
  expiresAt: number | null;
  usedBy: string | null;
  usedAt: number | null;
}

export interface InviteRepository {
  insert(invite: Invite): Promise<void>;
  /**
   * Takes the invitation for `userId` if it is unused and not out of date,
   * in one statement, so two sign-ups with one code cannot both have it.
   */
  claim(digest: string, userId: string, now: number): Promise<boolean>;
  /** Gives back a claim whose account could not be made after all. */
  release(digest: string, userId: string): Promise<void>;
  list(): Promise<Invite[]>;
}

/** The codes an account can set a new password with, kept as digests. */
export interface RecoveryCodeRepository {
  /** The account's codes, all of them replaced by these. */
  replace(userId: string, digests: string[], at: number): Promise<void>;
  /** Marks the code used if it is the account's and unused, in one statement; false otherwise. */
  use(userId: string, digest: string, at: number): Promise<boolean>;
  /** How many are left unused, and when they were made; null when there are none at all. */
  status(userId: string): Promise<{ left: number; createdAt: number } | null>;
}

/** A day's use of one outside service by one account: how many calls, and how much in the service's own unit. */
export interface UsageRow {
  /** the day, in UTC: 2026-11-05 */
  day: string;
  service: string;
  calls: number;
  units: number;
}

/**
 * What the learner's own keys have been spent on. Counted by the server where
 * it calls the service, so it is the same on every device; the bill itself is
 * the service's to show.
 */
export interface UsageRepository {
  /** Adds to the day's row for the service, making it if there is none. */
  add(userId: string, day: string, service: string, calls: number, units: number): Promise<void>;
  /** Every row from that day on, for the account. */
  since(userId: string, fromDay: string): Promise<UsageRow[]>;
}

/**
 * Counts of attempts per key per fixed window, kept where every copy of the
 * server sees them: on Vercel each request may meet a different instance,
 * and a count kept in one instance's memory stopped nobody.
 */
export interface RateLimitStore {
  /** Counts one attempt for `key` in the window starting at `windowStart`, and says how many there have been. */
  hit(key: string, windowStart: number): Promise<number>;
  /** Forgets the key's counts, as a good sign-in does for that name. */
  reset(key: string): Promise<void>;
  /** Drops windows that ended before `before`. */
  sweep(before: number): Promise<void>;
}

/**
 * Answers from outside services that are the same for everyone who asks —
 * a YouTube video's title and captions — kept for a while, so the second
 * learner to add a video does not ask YouTube again.
 */
export interface LookupCache {
  /** The answer kept under `key`, if it was fetched at or after `since`. */
  get(key: string, since: number): Promise<string | null>;
  put(key: string, body: string, at: number): Promise<void>;
}

/** How much one account keeps on the server, in bytes, across everything it has made. */
export interface StorageMeter {
  usedBy(userId: string): Promise<number>;
}

/** What happened to accounts, for whoever runs the site: sign-ins, sign-ups, passwords, deletions. */
export interface AuditEvent {
  at: number;
  /** sign-in, sign-in-refused, sign-up, recovery, recovery-refused, password, deleted, invite, token-made, token-revoked */
  kind: string;
  /** the name as it was given, for a refused one too */
  username: string;
  ip: string;
  userAgent: string | null;
}

export interface AuditLog {
  add(event: AuditEvent): Promise<void>;
  /** The latest first. */
  recent(limit: number): Promise<AuditEvent[]>;
  /** Drops what happened before `before`. */
  sweep(before: number): Promise<void>;
}

/** Who did something an admin does: an account, or a command on the server (`id` null). */
export interface Actor {
  id: string | null;
  name: string;
  ip: string | null;
}

/** A line of the admins' log, as kept. */
export interface AdminLogRecord {
  id?: number;
  at: number;
  actorId: string | null;
  actorName: string;
  action: string;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, string | number | boolean | null>;
  ip: string | null;
}

/** What the accounts that run the site did, a year of it; never edited, only swept when old. */
export interface AdminLogRepository {
  add(entry: AdminLogRecord): Promise<void>;
  /** The newest first, `limit` of them, with ids below `before`; `name` matches the actor or the target, any case. */
  list(query: { action?: string; name?: string; before?: number; limit: number }): Promise<AdminLogRecord[]>;
  sweep(before: number): Promise<void>;
}
