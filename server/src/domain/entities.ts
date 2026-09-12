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

export interface Workspace {
  userId: string;
  revision: number;
  document: unknown;
  updatedAt: number;
}
