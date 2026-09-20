import { AuthService, DEFAULT_AUTH_POLICY, type AuthPolicy } from './application/auth-service';
import type {
  Clock,
  PasswordHasher,
  SessionRepository,
  SpeechSynthesizer,
  Tutor,
  UserRepository,
  WorkspaceRepository,
} from './application/ports';
import { WorkspaceService } from './application/workspace-service';
import { systemClock } from './infrastructure/clock';
import { ScryptHasher } from './infrastructure/crypto/scrypt-hasher';
import { cryptoTokens } from './infrastructure/crypto/tokens';

export interface Services {
  auth: AuthService;
  workspaces: WorkspaceService;
  clock: Clock;
  /** a natural voice for reading Mandarin aloud, or null where none is configured */
  speech: SpeechSynthesizer | null;
  /** Claude to talk Mandarin with, where the server can reach it through a subscription */
  tutor: Tutor | null;
  /** voices that can read any sentence — for Claude's answers — where the models are on this machine */
  talkVoices: SpeechSynthesizer | null;
}

/** Where the three kinds of record are kept. */
export interface Stores {
  users: UserRepository;
  sessions: SessionRepository;
  workspaces: WorkspaceRepository;
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
    talkVoices?: SpeechSynthesizer | null;
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
  return {
    auth,
    workspaces,
    clock,
    speech: options.speech ?? null,
    tutor: options.tutor ?? null,
    talkVoices: options.talkVoices ?? null,
  };
}
