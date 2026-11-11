/**
 * The contract between the app and its server.
 *
 * Every request body and every response the two exchange is typed here and
 * nowhere else, so the browser and the server cannot drift apart without the
 * compiler noticing. Types and constants only: nothing in `shared/` may import
 * from either side.
 */

/** What an account may do: a learner, or one that runs the site. Decided by the server, from the database. */
export type Role = 'learner' | 'admin';

export interface UserDto {
  id: string;
  username: string;
  createdAt: number;
  /** for the page to know which links to draw; every decision is the server's */
  role: Role;
}

export interface SessionResponse {
  user: UserDto;
}

/** Who is signed in. Nobody is an ordinary answer to that, not an error. */
export interface CurrentSessionResponse {
  user: UserDto | null;
}

export interface AuthOptionsResponse {
  /** whether a new account can be made from the sign-in page: by anyone, by nobody, or with an invitation */
  registration: 'open' | 'closed' | 'invite';
}

/** A browser signed in to the account, for the account page's list of devices. */
export interface SessionDto {
  /** a handle for signing this one out; not the cookie, and not enough to sign in with */
  id: string;
  createdAt: number;
  lastSeenAt: number;
  /** what the browser said it was, as it said it, cut short; null when it said nothing */
  userAgent: string | null;
  /** the browser asking */
  current: boolean;
}

export interface SessionsResponse {
  sessions: SessionDto[];
}

/**
 * What an access token may do. A token stands in for the password in a
 * script (the add-text skill): it can read and save the workspace and keep
 * pictures, and nothing else: not the password, not the account, not the
 * keys, not the site's own pages, not other tokens.
 *
 *   texts:write    read and save the workspace, keep a text's pictures
 *   catalog:write  publish to the shared catalogue (accounts that run the site only)
 */
export const TOKEN_SCOPES = ['texts:write', 'catalog:write'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Every token begins with this, so one pasted somewhere it should not be is easy to find. */
export const TOKEN_PREFIX = 'hzw_';

/** A token as the account page lists it: never the token itself, which is shown once. */
export interface AccessTokenDto {
  id: string;
  name: string;
  scopes: TokenScope[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number;
}

export interface AccessTokensResponse {
  tokens: AccessTokenDto[];
}

export interface MakeAccessTokenRequest {
  name: string;
  /** how long it works: 1–365 days */
  days: number;
  scopes?: TokenScope[];
}

/** A token just made: `token` is shown this once and kept nowhere. */
export interface MadeAccessTokenResponse {
  token: string;
  made: AccessTokenDto;
}

export interface CredentialsRequest {
  username: string;
  password: string;
  /** the six digits from an authenticator app, or a recovery code, when the account has two-step sign-in */
  code?: string;
  /** the invitation's code, when sign-ups are by invitation */
  invite?: string;
}

/** Two-step sign-in, as the account page shows it. */
export interface TwoStepStatus {
  enabled: boolean;
  /** an account that runs the site has to have it, and cannot turn it off */
  required: boolean;
}

/** A secret to add to an authenticator app, before the first code confirms it. */
export interface TwoStepSetup {
  /** base32, to type in by hand */
  secret: string;
  /** otpauth://, which an iPhone opens in Passwords or an authenticator app */
  link: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Everything one account has saved, as the server holds it.
 *
 * The server keeps the app's document as it is given and looks no further into
 * it than its size and its version number. What a collection or a review record
 * *is* stays the app's business; the server's job is to keep one copy per
 * account and to stop two devices from overwriting each other.
 */
export interface WorkspaceDto {
  /** 0 until the first save, and one more on every save after it */
  revision: number;
  /** null until the first save */
  document: unknown;
  updatedAt: number | null;
}

export interface SaveWorkspaceRequest {
  /** the revision the document was built on; the save is refused if the server has moved past it */
  baseRevision: number;
  document: unknown;
}

export interface SaveWorkspaceResponse {
  revision: number;
  updatedAt: number;
}

export type ApiErrorCode =
  | 'validation'
  | 'invalid_credentials'
  /** the right password, for an account that has been paused */
  | 'account_blocked'
  /** an admin's action that wants the password typed again: ask, then send it to /api/auth/reauth and try again */
  | 'reauth_required'
  /** the right password for an account with two-step sign-in: send it again with the code */
  | 'totp_required'
  /** an admin page, for an admin who has not turned two-step sign-in on yet */
  | 'totp_setup_required'
  | 'username_taken'
  | 'registration_closed'
  | 'unauthorized'
  | 'forbidden_origin'
  /** signed in, but not as someone who may do this */
  | 'forbidden'
  | 'conflict'
  /** a save from a build older than the document it would replace */
  | 'outdated_app'
  | 'rate_limited'
  | 'payload_too_large'
  | 'not_found'
  /** something the server leans on is not set up, or not answering */
  | 'unavailable'
  | 'internal';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** a message per form field, when the problem belongs to one */
    fields?: Record<string, string>;
  };
}

/** A refused save carries what the server has now, so the app can replay its own changes on top. */
export interface WorkspaceConflictBody extends ApiErrorBody {
  current: WorkspaceDto;
}

export const API = {
  authOptions: '/api/auth/options',
  session: '/api/auth/session',
  register: '/api/auth/register',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  password: '/api/auth/password',
  workspace: '/api/workspace',
  /** the account's access tokens for scripts: GET the list, POST a new one, DELETE …/:id */
  tokens: '/api/account/tokens',
  /** a text's picture, by the digest of its bytes: GET to show it, PUT to keep it */
  pictures: '/api/pictures',
} as const;

/** The picture types the server keeps, and the largest it takes. */
export const PICTURE_TYPES = ['image/jpeg', 'image/webp', 'image/png'] as const;
export const PICTURE_MAX_BYTES = 2 * 1024 * 1024;

/** The largest workspace document the server accepts, in bytes of JSON. */
export const WORKSPACE_MAX_BYTES = 16 * 1024 * 1024;

/**
 * A revision as an HTTP entity tag. Asking "has anything changed since
 * revision 41?" then costs a 304 instead of the whole document, which matters
 * on a tablet that checks every time it is picked up.
 */
export const workspaceTag = (revision: number) => `"r${revision}"`;
