import { AuthService, DEFAULT_AUTH_POLICY, type AuthPolicy } from './application/auth-service';
import { ConversationService } from './application/conversation-service';
import { NarrationService } from './application/narration-service';
import { SpeechEvalService, type Evaluator } from './application/speech-eval-service';
import { evaluate as iflytekEvaluate } from './infrastructure/iflytek';
import { evaluate as speechSuperEvaluate } from './infrastructure/speechsuper';
import { PictureService } from './application/picture-service';
import { RecordingService } from './application/recording-service';
import type {
  Clock,
  ConversationRepository,
  Narrator,
  NarratorRepository,
  PasswordHasher,
  PictureRepository,
  SecretRepository,
  TextNarrationRepository,
  OwnTextRepository,
  SpeechAttemptRepository,
  RecordingRepository,
  SessionRepository,
  ApiTokenRepository,
  SpeechSynthesizer,
  TalkSynthesizer,
  Tutor,
  UserRepository,
  UsageRepository,
  InviteRepository,
  RateLimitStore,
  LookupCache,
  RecoveryCodeRepository,
  StorageMeter,
  AuditLog,
  AdminLogRepository,
  WorkspaceRepository,
  WorldSaveRepository,
} from './application/ports';
import { StorageQuota } from './application/storage-quota';
import { UsageMeter } from './application/usage-service';
import { WorkspaceService } from './application/workspace-service';
import { WorldService } from './application/world-service';
import { systemClock } from './infrastructure/clock';
import { minimaxNarrator } from './infrastructure/minimax';
import { ScryptHasher } from './infrastructure/crypto/scrypt-hasher';
import { secretsFor } from './infrastructure/crypto/sealed-secrets';
import { cryptoTokens } from './infrastructure/crypto/tokens';

export interface Services {
  auth: AuthService;
  workspaces: WorkspaceService;
  /** 走走's game saves */
  world: WorldService;
  conversations: ConversationService;
  clock: Clock;
  /** a natural voice for reading Mandarin aloud, or null where none is configured */
  speech: SpeechSynthesizer | null;
  /** Claude to talk Mandarin with, where the server can reach it through a subscription */
  tutor: Tutor | null;
  /** voices that can read any sentence — for Claude's answers — where the models are on this machine */
  talkVoices: TalkSynthesizer | null;
  /** those voices again, as recordings the website can play where the models are not */
  recordings: RecordingService;
  /** the pictures beside texts' paragraphs */
  pictures: PictureService;
  /** texts read aloud by MiniMax with the learner's own key */
  narration: NarrationService;
  /** phrases said aloud and scored by iFlytek with the learner's own keys */
  speechEval: SpeechEvalService;
  /** what the learner's own keys have been spent on */
  usage: UsageMeter;
  /** the counts the rate limits keep, shared by every instance of the server */
  limits: RateLimitStore;
  /** answers the same for everyone, kept a while */
  lookups: LookupCache;
  /** how much each account keeps, against its ceiling */
  storage: StorageQuota;
  /** what happened to accounts, ninety days of it */
  audit: AuditLog;
}

/** Where each kind of record is kept. */
export interface Stores {
  users: UserRepository;
  sessions: SessionRepository;
  apiTokens: ApiTokenRepository;
  workspaces: WorkspaceRepository;
  worldSaves: WorldSaveRepository;
  conversations: ConversationRepository;
  recordings: RecordingRepository;
  pictures: PictureRepository;
  secrets: SecretRepository;
  narrators: NarratorRepository;
  narrations: TextNarrationRepository;
  ownTexts: OwnTextRepository;
  speechAttempts: SpeechAttemptRepository;
  usage: UsageRepository;
  invites: InviteRepository;
  limits: RateLimitStore;
  lookups: LookupCache;
  recoveryCodes: RecoveryCodeRepository;
  storage: StorageMeter;
  audit: AuditLog;
  adminLog: AdminLogRepository;
}

/**
 * The one place that decides which implementation stands behind each port.
 * The production server, the development server, the admin commands and the
 * tests all build the application here, differing only in what they pass in.
 *
 * The stores arrive already made — `sqliteStores` at home, `postgresStores` on
 * Vercel — so that neither driver is loaded by a server that does not use it.
 */
export function createServices(
  stores: Stores,
  options: {
    policy?: Partial<AuthPolicy>;
    hasher?: PasswordHasher;
    clock?: Clock;
    speech?: SpeechSynthesizer | null;
    tutor?: Tutor | null;
    talkVoices?: TalkSynthesizer | null;
    /** MiniMax by default; a stand-in in the tests */
    narrator?: Narrator | null;
    /** iFlytek by default; a stand-in in the tests */
    evaluator?: Evaluator | null;
    /**
     * HANZI_SECRETS_KEY: the learners' keys for outside services are sealed
     * with it before they are stored. Left out (the tests, the admin commands),
     * they are stored as they are.
     */
    secretsKey?: string;
    /** HANZI_STORAGE_MB: the most one account may keep; left out or 0, no ceiling */
    storageLimitMb?: number | null;
  } = {},
): Services {
  const clock = options.clock ?? systemClock;
  const secrets = options.secretsKey === undefined ? stores.secrets : secretsFor(stores.secrets, options.secretsKey, (line) => console.error(line));
  const auth = new AuthService({
    users: stores.users,
    sessions: stores.sessions,
    apiTokens: stores.apiTokens,
    invites: stores.invites,
    recoveryCodes: stores.recoveryCodes,
    adminLog: stores.adminLog,
    secrets,
    hasher: options.hasher ?? new ScryptHasher(),
    tokens: cryptoTokens,
    clock,
    policy: { ...DEFAULT_AUTH_POLICY, ...options.policy },
  });
  const workspaces = new WorkspaceService({ workspaces: stores.workspaces, clock });
  const world = new WorldService({ saves: stores.worldSaves, clock });
  const recordings = new RecordingService({ recordings: stores.recordings, live: options.talkVoices ?? null, clock });
  const conversations = new ConversationService({ conversations: stores.conversations, clock, tokens: cryptoTokens });
  const quota = new StorageQuota({ meter: stores.storage, limitMb: options.storageLimitMb || null });
  const usage = new UsageMeter({ usage: stores.usage, clock, log: (line) => console.error(line) });
  return {
    auth,
    workspaces,
    world,
    conversations,
    clock,
    speech: options.speech ?? null,
    tutor: options.tutor ?? null,
    talkVoices: options.talkVoices ?? null,
    recordings,
    pictures: new PictureService({ pictures: stores.pictures, clock, quota }),
    narration: new NarrationService({ secrets, narrators: stores.narrators, narrations: stores.narrations, ownTexts: stores.ownTexts, tokens: cryptoTokens, narrator: options.narrator === undefined ? minimaxNarrator() : options.narrator, clock, meter: usage, quota }),
    speechEval: new SpeechEvalService({ secrets, attempts: stores.speechAttempts, evaluator: options.evaluator === undefined ? { evaluate: (k, o) => (k.provider === 'speechsuper' ? speechSuperEvaluate(k, o) : iflytekEvaluate(k, o)) } : options.evaluator, clock, meter: usage, quota }),
    usage,
    limits: stores.limits,
    lookups: stores.lookups,
    storage: quota,
    audit: stores.audit,
  };
}
