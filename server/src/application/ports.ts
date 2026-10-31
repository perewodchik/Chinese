import type {
  ClaudeState,
  TalkConversation,
  TalkConversationSummary,
  TalkMode,
  TalkReply,
  TalkRequest,
} from '../../../shared/talk';
import type { Session, User, Workspace, WorldSaveRecord } from '../domain/entities';

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
  list(): Promise<User[]>;
}

export interface SessionRepository {
  insert(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void>;
  delete(id: string): Promise<void>;
  /** Every session of one user except `keepId`; returns how many went. */
  deleteForUser(userId: string, keepId?: string): Promise<number>;
  deleteExpired(now: number): Promise<number>;
}

export type WorkspaceWrite =
  | { saved: true; revision: number; updatedAt: number }
  | { saved: false; current: Workspace | null };

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
  /** a new voice made from a description, and its first words read in it */
  design(key: string, prompt: string, previewText: string): Promise<{ voiceId: string; trial: Uint8Array }>;
}

/** A narrator the learner made: a voice of the service's, a name, how it sounds. */
export interface NarratorRecord extends VoiceTuning {
  id: string;
  userId: string;
  name: string;
  /** made from a description, or one of the service's own voices */
  kind: 'designed' | 'system';
  /** the service's id for the voice */
  voiceId: string;
  /** what it was made from, kept to make it again */
  prompt: string;
  previewText: string;
  createdAt: number;
  updatedAt: number;
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
