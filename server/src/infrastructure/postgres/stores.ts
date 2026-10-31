import type pg from 'pg';
import type { Stores } from '../../composition';
import { PostgresConversationRepository } from './conversation-repository';
import { PostgresPictureRepository } from './picture-repository';
import { PostgresNarratorRepository } from './narrator-repository';
import { PostgresTextNarrationRepository } from './text-narration-repository';
import { PostgresOwnTextRepository } from './own-text-repository';
import { PostgresSecretRepository } from './secret-repository';
import { PostgresRecordingRepository } from './recording-repository';
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
  recordings: new PostgresRecordingRepository(db),
  pictures: new PostgresPictureRepository(db),
  secrets: new PostgresSecretRepository(db),
  narrators: new PostgresNarratorRepository(db),
  narrations: new PostgresTextNarrationRepository(db),
  ownTexts: new PostgresOwnTextRepository(db),
});
