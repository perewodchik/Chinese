import type { DatabaseSync } from 'node:sqlite';
import type { Stores } from '../../composition';
import { SqliteConversationRepository } from './conversation-repository';
import { SqlitePictureRepository } from './picture-repository';
import { SqliteNarratorRepository } from './narrator-repository';
import { SqliteTextNarrationRepository } from './text-narration-repository';
import { SqliteOwnTextRepository } from './own-text-repository';
import { SqliteSecretRepository } from './secret-repository';
import { SqliteRecordingRepository } from './recording-repository';
import { SqliteSessionRepository } from './session-repository';
import { SqliteUserRepository } from './user-repository';
import { SqliteWorkspaceRepository } from './workspace-repository';
import { SqliteWorldSaveRepository } from './world-save-repository';

/** Everything kept in the one SQLite file. */
export const sqliteStores = (db: DatabaseSync): Stores => ({
  users: new SqliteUserRepository(db),
  sessions: new SqliteSessionRepository(db),
  workspaces: new SqliteWorkspaceRepository(db),
  worldSaves: new SqliteWorldSaveRepository(db),
  conversations: new SqliteConversationRepository(db),
  recordings: new SqliteRecordingRepository(db),
  pictures: new SqlitePictureRepository(db),
  secrets: new SqliteSecretRepository(db),
  narrators: new SqliteNarratorRepository(db),
  narrations: new SqliteTextNarrationRepository(db),
  ownTexts: new SqliteOwnTextRepository(db),
});
