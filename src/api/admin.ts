import { useEffect, useState } from 'react';
import type { AdminOverview } from '../../shared/admin';
import { request } from './http';

/** For whoever runs the site: 403 for anyone else. Asked once a visit. */
let asked: Promise<boolean> | null = null;
export const isAdmin = () => (asked ??= request<{ admin: true }>('GET', '/api/admin').then(() => true, () => false));
export const adminOverview = () => request<AdminOverview>('GET', '/api/admin/overview');
/** An invitation for one account, `days` long (0: no end); its code is shown this once. */
export const makeInvite = (note: string, days: number) => request<{ code: string; expiresAt: number | null }>('POST', '/api/admin/invites', { body: { note, days } });

/** Whether the one signed in runs the site: false until known, so nothing of theirs shows to anyone else. */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    void isAdmin().then((yes) => live && setAdmin(yes));
    return () => {
      live = false;
    };
  }, []);
  return admin;
}
