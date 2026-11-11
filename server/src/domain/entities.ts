import type { Role } from '../../../shared/api';

/**
 * What the server keeps, which is deliberately little: an account, the browsers
 * signed in to it, and one workspace document each.
 */

export interface User {
  id: string;
  /** as it was typed when the account was made */
  username: string;
  /** the normalised form names are compared by; unique */
  usernameKey: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  /** what it may do; only the server, or a command on it, changes this */
  role: Role;
  /** a blocked account signs in nowhere and its sessions open nothing */
  status: AccountStatus;
  flags: UserFlags;
}

export type AccountStatus = 'active' | 'blocked';

/** What an account is given beyond the rest, one switch each. */
export interface UserFlags {
  /** may talk with Claude through the server's subscription */
  tutor?: boolean;
  /** no limits on what costs the site money */
  unlimited?: boolean;
  /** may send photos of pages to be turned into texts */
  photoInbox?: boolean;
}

/**
 * One signed-in browser.
 *
 * `id` is a digest of the secret in the cookie rather than the secret itself,
 * so a copy of the database is not a way into anybody's account.
 */
export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  userAgent: string | null;
}

/**
 * A token a script signs in with in place of the password. Only its digest
 * is kept; `scopes` is what it may do (shared/api.ts, TOKEN_SCOPES).
 */
export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  digest: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
  revokedAt: number | null;
}

export interface Workspace {
  userId: string;
  revision: number;
  document: unknown;
  updatedAt: number;
}

/** 走走's game save: one per account, kept as the game gives it. */
export interface WorldSaveRecord {
  userId: string;
  revision: number;
  save: unknown;
  updatedAt: number;
}
