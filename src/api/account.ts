import type { SessionsResponse } from '../../shared/api';
import type { UsageResponse } from '../../shared/usage';
import { request } from './http';

/** What the learner's own keys have been spent on, today, this month and day by day. */
export const accountUsage = () => request<UsageResponse>('GET', '/api/account/usage');

/** How much the account keeps on the server, out of how much it may (null: no ceiling). */
export const accountStorage = () => request<{ usedBytes: number; limitBytes: number | null }>('GET', '/api/account/storage');

/** The account and everything it kept, gone; the password asked again. */
export const deleteAccount = (password: string) => request<void>('DELETE', '/api/account', { body: { password } });

/** The browsers signed in to the account, and signing them out. */
export const accountSessions = () => request<SessionsResponse>('GET', '/api/auth/sessions').then((r) => r.sessions);
export const signOutSession = (id: string) => request<void>('DELETE', `/api/auth/sessions/${encodeURIComponent(id)}`);
export const signOutOthers = () => request<{ signedOut: number }>('POST', '/api/auth/sessions/others');
