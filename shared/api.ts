/**
 * The contract between the app and its server.
 *
 * Every request body and every response the two exchange is typed here and
 * nowhere else, so the browser and the server cannot drift apart without the
 * compiler noticing. Types and constants only: nothing in `shared/` may import
 * from either side.
 */

export interface UserDto {
  id: string;
  username: string;
  createdAt: number;
}

export interface SessionResponse {
  user: UserDto;
}

/** Who is signed in. Nobody is an ordinary answer to that, not an error. */
export interface CurrentSessionResponse {
  user: UserDto | null;
}

export interface AuthOptionsResponse {
  /** whether a new account can be made from the sign-in page */
  registration: 'open' | 'closed';
}

export interface CredentialsRequest {
  username: string;
  password: string;
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
  | 'username_taken'
  | 'registration_closed'
  | 'unauthorized'
  | 'forbidden_origin'
  | 'conflict'
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
} as const;

/** The largest workspace document the server accepts, in bytes of JSON. */
export const WORKSPACE_MAX_BYTES = 16 * 1024 * 1024;

/**
 * A revision as an HTTP entity tag. Asking "has anything changed since
 * revision 41?" then costs a 304 instead of the whole document, which matters
 * on a tablet that checks every time it is picked up.
 */
export const workspaceTag = (revision: number) => `"r${revision}"`;
