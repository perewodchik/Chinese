import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody, ApiErrorCode, WorkspaceConflictBody } from '../../../shared/api';
import { AppError, RateLimitedError, RevisionConflictError } from '../domain/errors';

const STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  validation: 400,
  invalid_credentials: 401,
  unauthorized: 401,
  registration_closed: 403,
  forbidden_origin: 403,
  not_found: 404,
  username_taken: 409,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
};

export const errorBody = (code: ApiErrorCode, message: string, fields?: Record<string, string>): ApiErrorBody => ({
  error: { code, message, ...(fields && { fields }) },
});

/** Turns whatever a handler threw into the JSON error shape the app reads. */
export function handleError(log: (line: string) => void) {
  return (err: Error, c: Context): Response => {
    if (err instanceof RevisionConflictError) {
      const body: WorkspaceConflictBody = { ...errorBody(err.code, err.message), current: err.current };
      return c.json(body, 409);
    }
    if (err instanceof AppError) {
      if (err instanceof RateLimitedError) c.header('Retry-After', String(err.retryAfterSeconds));
      return c.json(errorBody(err.code, err.message, err.fields), STATUS[err.code]);
    }
    if (err instanceof HTTPException) return err.getResponse();

    log(`${c.req.method} ${c.req.path} failed: ${err.stack ?? err.message}`);
    return c.json(errorBody('internal', 'Something went wrong on the server.'), 500);
  };
}
