/**
 * What the accounts that run the site (role `admin`) see at /admin.
 *
 *   GET  /api/admin            200 for an admin, 403 for anyone else
 *   GET  /api/admin/overview   → AdminOverview
 *   POST /api/admin/invites    { note, days, uses? } → { code, expiresAt, uses }
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
export const ADMIN_ACTIONS = ['invite-made', 'invite-revoked', 'setting-changed', 'account-made', 'password-reset', 'reset-link', 'role-granted', 'role-revoked', 'blocked', 'unblocked', 'signed-out', 'catalog-published', 'catalog-updated', 'catalog-hidden', 'catalog-shown', 'catalog-moved', 'catalog-level'] as const;
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

/** A5: GET /api/admin/accounts/:id — one account, more than its row says. */
export interface AdminAccountCard {
  account: AdminAccount;
  /** the invitation it came by, if any: its note and who made it */
  invite: { note: string; createdBy: string | null } | null;
  /** the last thirty days, in numbers (A7) */
  month: { days: number; minutes: number; textsRead: number; answers: number; spoken: number };
  /** what its room goes on, in bytes */
  room: Record<'work' | 'pictures' | 'readings' | 'tries' | 'conversations' | 'game', number>;
}

/** A4: GET /api/admin/accounts?q=&sort=seen|joined|room|spent&page= */
export interface AdminAccountPage {
  accounts: AdminAccount[];
  total: number;
  /** from 0 */
  page: number;
  pages: number;
}

/** The most accounts one invitation may make (A8): a class, not the world. */
export const INVITE_MAX_USES = 100;

export interface AdminInvite {
  /** its code's digest: opens nothing, names it to take it back (A8) */
  id: string;
  note: string;
  createdAt: number;
  expiresAt: number | null;
  usedBy: string | null;
  usedAt: number | null;
  /** A8: taken back while it still had uses left */
  revokedAt: number | null;
  /** A8: who made it, by name; null for one made before that was kept */
  createdBy: string | null;
  /** A8: how many accounts it may make (1, or a group's N), how many it has made, and who came by it, oldest first */
  maxUses: number;
  uses: number;
  people: Array<{ username: string; at: number }>;
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
  /** SEC15: what is worth a look today */
  watch: AdminWatch;
}

/** SEC15: refused sign-ins in the last day, and admins signed in from a browser not seen for them in ninety days. */
export interface AdminWatch {
  refusedToday: number;
  limitedToday: number;
  newAdminDevices: Array<{ username: string; userAgent: string | null; at: number }>;
}
