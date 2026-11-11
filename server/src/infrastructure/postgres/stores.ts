import type pg from 'pg';
import { PostgresApiTokenRepository } from './api-token-repository';
import { PostgresAdminLog } from './admin-log';
import type { Stores } from '../../composition';
import { PostgresConversationRepository } from './conversation-repository';
import { PostgresPictureRepository } from './picture-repository';
import { PostgresNarratorRepository } from './narrator-repository';
import { PostgresTextNarrationRepository } from './text-narration-repository';
import { PostgresOwnTextRepository } from './own-text-repository';
import { PostgresSpeechAttemptRepository } from './speech-attempt-repository';
import { PostgresSecretRepository } from './secret-repository';
import { PostgresRecordingRepository } from './recording-repository';
import { PostgresSessionRepository } from './session-repository';
import { PostgresUserRepository } from './user-repository';
import { PostgresUsageRepository } from './usage-repository';
import { PostgresInviteRepository } from './invite-repository';
import { PostgresRateLimitStore } from './rate-limit-store';
import { PostgresLookupCache } from './lookup-cache';
import { PostgresStorageMeter } from './storage-meter';
import { PostgresAuditLog } from './audit-log';
import { PostgresRecoveryCodeRepository } from './recovery-code-repository';
import { PostgresWorkspaceRepository } from './workspace-repository';
import { PostgresWorldSaveRepository } from './world-save-repository';

/** The same records, in Postgres. */
export const postgresStores = (db: pg.Pool): Stores => ({
  users: new PostgresUserRepository(db),
  apiTokens: new PostgresApiTokenRepository(db),
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
  speechAttempts: new PostgresSpeechAttemptRepository(db),
  usage: new PostgresUsageRepository(db),
  invites: new PostgresInviteRepository(db),
  limits: new PostgresRateLimitStore(db),
  lookups: new PostgresLookupCache(db),
  storage: new PostgresStorageMeter(db),
  adminLog: new PostgresAdminLog(db),
  audit: new PostgresAuditLog(db),
  recoveryCodes: new PostgresRecoveryCodeRepository(db),
});
