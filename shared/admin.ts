/**
 * What the accounts that run the site (role `admin`) see at /admin.
 *
 *   GET  /api/admin            200 for an admin, 403 for anyone else
 *   GET  /api/admin/overview   → AdminOverview
 *   POST /api/admin/invites    { note, days } → { code, expiresAt }
 *   GET  /api/admin/log        ?action=&name=&before= → AdminLogPage
 *   POST /api/admin/accounts/:id/block     { reason } → 204: paused, signed out everywhere, its tokens stopped
 *   POST /api/admin/accounts/:id/unblock   → 204
 *   POST /api/admin/accounts/:id/sign-out  → { sessions, tokens }: how many browsers and tokens went
 */

/**
 * What an account that runs the site (or a command on the server) did. The
 * list grows with the admin pages; a kind the page does not know is shown
 * as it is.
 */
export const ADMIN_ACTIONS = ['invite-made', 'invite-revoked', 'account-made', 'password-reset', 'reset-link', 'role-granted', 'role-revoked', 'blocked', 'unblocked', 'signed-out', 'catalog-published', 'catalog-updated', 'catalog-hidden', 'catalog-shown'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/** One line of the admins' log. Not the address it came from. */
export interface AdminLogEntry {
  id: number;
  at: number;
  /** the account's name, or "server command" / "HANZI_ADMIN_USERS" for what no account did */
  actor: string;
  action: AdminAction | string;
  /** the account it was done to, when it was done to one */
  target: string | null;
  /** what else is worth knowing: an invitation's note and length, the reason for a block */
  details: Record<string, string | number | boolean | null>;
}

export interface AdminLogPage {
  entries: AdminLogEntry[];
  /** the id to ask `before` for the next page; null at the end */
  next: number | null;
}

export interface AdminAccount {
  id: string;
  username: string;
  role: 'learner' | 'admin';
  /** a paused account signs in nowhere until it is opened again */
  status: 'active' | 'blocked';
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

/** A4: GET /api/admin/accounts?q=&sort=seen|joined|room|spent&page= */
export interface AdminAccountPage {
  accounts: AdminAccount[];
  total: number;
  /** from 0 */
  page: number;
  pages: number;
}

export interface AdminInvite {
  /** its code's digest: opens nothing, names it to take it back (A8) */
  id: string;
  note: string;
  createdAt: number;
  expiresAt: number | null;
  usedBy: string | null;
  usedAt: number | null;
  /** A8: taken back before it was used */
  revokedAt: number | null;
  /** A8: who made it, by name; null for one made before that was kept */
  createdBy: string | null;
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
  /** the first page of them, seen last first (A4) */
  accounts: AdminAccount[];
  /** how many there are in all */
  accountsTotal: number;
  invites: AdminInvite[];
  /** the latest sixty, newest first */
  events: AdminEvent[];
}
