import type { AdminLogPage, AdminOverview } from '../../shared/admin';
import { request } from './http';

export const adminOverview = () => request<AdminOverview>('GET', '/api/admin/overview');
/** An invitation for one account, `days` long (0: no end); its code is shown this once. */
export const makeInvite = (note: string, days: number) => request<{ code: string; expiresAt: number | null }>('POST', '/api/admin/invites', { body: { note, days } });
/** A page of what the admins did, newest first; `before` is the `next` of the page before. */
export const adminLog = (q: { action?: string; name?: string; before?: number }) => {
  const params = new URLSearchParams();
  if (q.action) params.set('action', q.action);
  if (q.name) params.set('name', q.name);
  if (q.before !== undefined) params.set('before', String(q.before));
  const search = params.toString();
  return request<AdminLogPage>('GET', `/api/admin/log${search ? `?${search}` : ''}`);
};
