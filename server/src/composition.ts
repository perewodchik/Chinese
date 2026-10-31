import { AuthService, DEFAULT_AUTH_POLICY, type AuthPolicy } from './application/auth-service';
import { ConversationService } from './application/conversation-service';
import { NarrationService } from './application/narration-service';
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
  RecordingRepository,
  SessionRepository,
  SpeechSynthesizer,
  TalkSynthesizer,
  Tutor,
  UserRepository,
  WorkspaceRepository,
  WorldSaveRepository,
} from './application/ports';
import { WorkspaceService } from './application/workspace-service';
import { WorldService } from './application/world-service';
import { systemClock } from './infrastructure/clock';
import { minimaxNarrator } from './infrastructure/minimax';
import { ScryptHasher } from './infrastructure/crypto/scrypt-hasher';
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
}

/** Where each kind of record is kept. */
export interface Stores {
  users: UserRepository;
  sessions: SessionRepository;
  workspaces: WorkspaceRepository;
  worldSaves: WorldSaveRepository;
  conversations: ConversationRepository;
  recordings: RecordingRepository;
  pictures: PictureRepository;
  secrets: SecretRepository;
  narrators: NarratorRepository;
  narrations: TextNarrationRepository;
  ownTexts: OwnTextRepository;
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
  } = {},
): Services {
  const clock = options.clock ?? systemClock;
  const auth = new AuthService({
    users: stores.users,
    sessions: stores.sessions,
    hasher: options.hasher ?? new ScryptHasher(),
    tokens: cryptoTokens,
    clock,
    policy: { ...DEFAULT_AUTH_POLICY, ...options.policy },
  });
  const workspaces = new WorkspaceService({ workspaces: stores.workspaces, clock });
  const world = new WorldService({ saves: stores.worldSaves, clock });
  const recordings = new RecordingService({ recordings: stores.recordings, live: options.talkVoices ?? null, clock });
  const conversations = new ConversationService({ conversations: stores.conversations, clock, tokens: cryptoTokens });
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
    pictures: new PictureService({ pictures: stores.pictures, clock }),
    narration: new NarrationService({ secrets: stores.secrets, narrators: stores.narrators, narrations: stores.narrations, ownTexts: stores.ownTexts, tokens: cryptoTokens, narrator: options.narrator === undefined ? minimaxNarrator() : options.narrator, clock }),
  };
}
