import type pg from 'pg';
import type { Stores } from '../../composition';
import { PostgresConversationRepository } from './conversation-repository';
import { PostgresSessionRepository } from './session-repository';
import { PostgresUserRepository } from './user-repository';
import { PostgresWorkspaceRepository } from './workspace-repository';
import { PostgresWorldSaveRepository } from './world-save-repository';

/** The same records, in Postgres. */
export const postgresStores = (db: pg.Pool): Stores => ({
  users: new PostgresUserRepository(db),
  sessions: new PostgresSessionRepository(db),
  workspaces: new PostgresWorkspaceRepository(db),
  worldSaves: new PostgresWorldSaveRepository(db),
  conversations: new PostgresConversationRepository(db),
});
