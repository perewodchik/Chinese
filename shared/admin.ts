/**
 * What whoever runs the site sees at /admin (HANZI_ADMIN_USERS).
 *
 *   GET  /api/admin            200 for an admin, 403 for anyone else
 *   GET  /api/admin/overview   → AdminOverview
 *   POST /api/admin/invites    { note, days } → { code, expiresAt }
 */

export interface AdminAccount {
  username: string;
  createdAt: number;
  /** the last time any of its browsers was seen; null when none is signed in */
  lastSeenAt: number | null;
  /** browsers signed in now */
  devices: number;
  storageBytes: number;
  /** this month, by the account's own keys */
  scoredThisMonth: number;
  charactersReadThisMonth: number;
}

export interface AdminInvite {
  note: string;
  createdAt: number;
  expiresAt: number | null;
  usedBy: string | null;
  usedAt: number | null;
}

/** Something that happened to an account: who, what, when, on what. Not the address. */
export interface AdminEvent {
  at: number;
  kind: 'sign-in' | 'sign-in-refused' | 'sign-up' | 'recovery' | 'recovery-refused' | 'password' | 'deleted' | 'invite' | 'token-made' | 'token-revoked' | string;
  username: string;
  userAgent: string | null;
}

export interface AdminOverview {
  registration: 'open' | 'closed' | 'invite';
  storageLimitBytes: number | null;
  accounts: AdminAccount[];
  invites: AdminInvite[];
  /** the latest sixty, newest first */
  events: AdminEvent[];
}
