import type { AdminOverview } from '../../shared/admin';
import { request } from './http';

/** For whoever runs the site: 403 for anyone else. */
export const isAdmin = () => request<{ admin: true }>('GET', '/api/admin').then(() => true, () => false);
export const adminOverview = () => request<AdminOverview>('GET', '/api/admin/overview');
/** An invitation for one account, `days` long (0: no end); its code is shown this once. */
export const makeInvite = (note: string, days: number) => request<{ code: string; expiresAt: number | null }>('POST', '/api/admin/invites', { body: { note, days } });
