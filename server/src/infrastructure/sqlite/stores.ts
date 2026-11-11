import type { DatabaseSync } from 'node:sqlite';
import { SqliteApiTokenRepository } from './api-token-repository';
import type { Stores } from '../../composition';
import { SqliteConversationRepository } from './conversation-repository';
import { SqlitePictureRepository } from './picture-repository';
import { SqliteNarratorRepository } from './narrator-repository';
import { SqliteTextNarrationRepository } from './text-narration-repository';
import { SqliteOwnTextRepository } from './own-text-repository';
import { SqliteSpeechAttemptRepository } from './speech-attempt-repository';
import { SqliteSecretRepository } from './secret-repository';
import { SqliteRecordingRepository } from './recording-repository';
import { SqliteSessionRepository } from './session-repository';
import { SqliteUserRepository } from './user-repository';
import { SqliteUsageRepository } from './usage-repository';
import { SqliteInviteRepository } from './invite-repository';
import { SqliteRateLimitStore } from './rate-limit-store';
import { SqliteLookupCache } from './lookup-cache';
import { SqliteStorageMeter } from './storage-meter';
import { SqliteAuditLog } from './audit-log';
import { SqliteRecoveryCodeRepository } from './recovery-code-repository';
import { SqliteWorkspaceRepository } from './workspace-repository';
import { SqliteWorldSaveRepository } from './world-save-repository';

/** Everything kept in the one SQLite file. */
export const sqliteStores = (db: DatabaseSync): Stores => ({
  users: new SqliteUserRepository(db),
  apiTokens: new SqliteApiTokenRepository(db),
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
  speechAttempts: new SqliteSpeechAttemptRepository(db),
  usage: new SqliteUsageRepository(db),
  invites: new SqliteInviteRepository(db),
  limits: new SqliteRateLimitStore(db),
  lookups: new SqliteLookupCache(db),
  storage: new SqliteStorageMeter(db),
  audit: new SqliteAuditLog(db),
  recoveryCodes: new SqliteRecoveryCodeRepository(db),
});
