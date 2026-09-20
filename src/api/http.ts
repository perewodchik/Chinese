import type { ApiErrorBody, ApiErrorCode } from '../../shared/api';

/**
 * Talking to the app's own server.
 *
 * Every call goes through here so that three things hold everywhere: the
 * session cookie goes with it, a hung request gives up instead of spinning
 * forever on a tablet whose Wi-Fi has dropped, and a signed-out answer from any
 * endpoint reaches the one place that knows what to do about it.
 */

export class ApiError extends Error {
  readonly status: number;
  /** `network` when there was no answer at all */
  readonly code: ApiErrorCode | 'network';
  readonly fields: Record<string, string>;
  readonly body: unknown;

  constructor(
    status: number,
    code: ApiErrorCode | 'network',
    message: string,
    fields: Record<string, string> = {},
    body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.body = body;
  }
}

export const isOffline = (err: unknown) => err instanceof ApiError && err.code === 'network';
export const isSignedOut = (err: unknown) => err instanceof ApiError && err.status === 401;

let signedOut: (() => void) | null = null;

/** Called whenever a request comes back 401: the session ran out, or was ended somewhere else. */
export function onSignedOut(handler: (() => void) | null) {
  signedOut = handler;
}

const TIMEOUT_MS = 30_000;

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** a 401 here is an answer rather than news: checking for a session, or signing in */
  expect401?: boolean;
  /** for the rare request that is slow by nature, such as waiting on Claude to write */
  timeoutMs?: number;
}

export interface Answer<T> {
  status: number;
  data: T;
}

export async function send<T>(method: string, url: string, options: RequestOptions = {}): Promise<Answer<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  const hasBody = options.body !== undefined;
  try {
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...options.headers,
        },
        body: hasBody ? JSON.stringify(options.body) : undefined,
      });
      text = await res.text();
    } catch {
      throw new ApiError(
        0,
        'network',
        controller.signal.aborted ? 'The server took too long to answer.' : 'Could not reach the server.',
      );
    }

    const read = parse(text);
    if (!read.ok) {
      // A JSON API answering with something else is not working, whatever the
      // status says. It is usually the app's own page, served where the API
      // should be by a proxy or a rewrite that matched too much — and read as
      // an empty answer it becomes a screen that waits for ever.
      throw new ApiError(
        res.status,
        'internal',
        'The server answered with something that is not JSON.',
      );
    }
    const data = read.value;
    if (res.ok || res.status === 304) return { status: res.status, data: data as T };

    const error = (data as Partial<ApiErrorBody> | null)?.error;
    if (res.status === 401 && !options.expect401) signedOut?.();
    throw new ApiError(
      res.status,
      error?.code ?? (res.status === 401 ? 'unauthorized' : 'internal'),
      error?.message ?? `The server answered ${res.status}.`,
      error?.fields ?? {},
      data,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function request<T>(method: string, url: string, options?: RequestOptions): Promise<T> {
  return (await send<T>(method, url, options)).data;
}

/** An empty body is an answer; an unreadable one is not, and the two differ. */
function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
