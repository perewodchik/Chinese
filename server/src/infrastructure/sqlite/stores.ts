import type { DatabaseSync } from 'node:sqlite';
import type { Stores } from '../../composition';
import { SqliteConversationRepository } from './conversation-repository';
import { SqliteSessionRepository } from './session-repository';
import { SqliteUserRepository } from './user-repository';
import { SqliteWorkspaceRepository } from './workspace-repository';

/** Everything kept in the one SQLite file. */
export const sqliteStores = (db: DatabaseSync): Stores => ({
  users: new SqliteUserRepository(db),
  sessions: new SqliteSessionRepository(db),
  workspaces: new SqliteWorkspaceRepository(db),
  conversations: new SqliteConversationRepository(db),
});
