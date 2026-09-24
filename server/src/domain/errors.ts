import type { ApiErrorCode, WorkspaceDto } from '../../../shared/api';

/**
 * Failures the application knows how to name.
 *
 * Each one says what went wrong in the application's own terms, and the HTTP
 * layer is the only place that decides which status code that becomes.
 * Anything thrown that is not one of these is a bug, and is reported as one.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super('validation', message, fields);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('invalid_credentials', 'That name and password do not match an account.');
  }
}

export class UsernameTakenError extends AppError {
  constructor() {
    super('username_taken', 'That name is taken.', { username: 'Taken — pick another.' });
  }
}

export class RegistrationClosedError extends AppError {
  constructor() {
    super('registration_closed', 'New accounts are switched off on this server.');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('unauthorized', 'Sign in to carry on.');
  }
}

export class ForbiddenOriginError extends AppError {
  constructor() {
    super('forbidden_origin', 'That request did not come from this app.');
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'That') {
    super('not_found', `${what} does not exist.`);
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('rate_limited', 'Too many attempts. Wait a few minutes and try again.');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * A save from a build of the app older than the document it would replace.
 *
 * An older build reads a newer document by dropping what it does not know —
 * words it has never heard of, say — and its next save would write that loss
 * back. So it is refused, and a tab left open since before an update keeps
 * its changes queued until it is reloaded into the new build, which replays
 * them on top.
 */
export class OutdatedAppError extends AppError {
  constructor() {
    super(
      'outdated_app',
      'This page is an older version of the app. Reload it to keep saving — nothing done here is lost.',
    );
  }
}

/** A save built on a revision the server has already moved past. */
export class RevisionConflictError extends AppError {
  readonly current: WorkspaceDto;

  constructor(current: WorkspaceDto) {
    super('conflict', 'This workspace was saved from somewhere else in the meantime.');
    this.current = current;
  }
}

/** Claude could not be asked: not installed here, not signed in, or not answering. */
export class TutorUnavailableError extends AppError {
  constructor(message: string) {
    super('unavailable', message);
  }
}
