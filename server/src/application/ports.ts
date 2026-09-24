import type {
  ClaudeState,
  TalkConversation,
  TalkConversationSummary,
  TalkMode,
  TalkReply,
  TalkRequest,
} from '../../../shared/talk';
import type { Session, User, Workspace } from '../domain/entities';

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
