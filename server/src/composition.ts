import type { DatabaseSync } from 'node:sqlite';
import { AuthService, DEFAULT_AUTH_POLICY, type AuthPolicy } from './application/auth-service';
import type { Clock, PasswordHasher } from './application/ports';
import { WorkspaceService } from './application/workspace-service';
import { systemClock } from './infrastructure/clock';
import { ScryptHasher } from './infrastructure/crypto/scrypt-hasher';
import { cryptoTokens } from './infrastructure/crypto/tokens';
import { SqliteSessionRepository } from './infrastructure/sqlite/session-repository';
import { SqliteUserRepository } from './infrastructure/sqlite/user-repository';
import { SqliteWorkspaceRepository } from './infrastructure/sqlite/workspace-repository';

export interface Services {
  auth: AuthService;
  workspaces: WorkspaceService;
  clock: Clock;
}

/**
 * The one place that decides which implementation stands behind each port.
 * The production server, the development server, the admin commands and the
 * tests all build the application here, differing only in what they pass in.
 */
export function createServices(
  db: DatabaseSync,
  options: { policy?: Partial<AuthPolicy>; hasher?: PasswordHasher; clock?: Clock } = {},
): Services {
  const clock = options.clock ?? systemClock;
  const auth = new AuthService({
    users: new SqliteUserRepository(db),
    sessions: new SqliteSessionRepository(db),
    hasher: options.hasher ?? new ScryptHasher(),
    tokens: cryptoTokens,
    clock,
    policy: { ...DEFAULT_AUTH_POLICY, ...options.policy },
  });
  const workspaces = new WorkspaceService({ workspaces: new SqliteWorkspaceRepository(db), clock });
  return { auth, workspaces, clock };
}
