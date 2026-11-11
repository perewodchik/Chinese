import type { AdminLogRecord } from '../application/ports';

export interface AdminLogRow {
  id: number;
  at: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_id: string | null;
  target_name: string | null;
  details: string;
  ip: string | null;
}

/** A row as either database gives it back: times and ids as numbers, details parsed (or empty when unreadable). */
export function toAdminLogRecord(r: AdminLogRow): AdminLogRecord {
  let details: AdminLogRecord['details'] = {};
  try {
    const parsed: unknown = JSON.parse(r.details);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) details = parsed as AdminLogRecord['details'];
  } catch {
    /* a line whose details cannot be read still says who did what */
  }
  return { id: Number(r.id), at: Number(r.at), actorId: r.actor_id, actorName: r.actor_name, action: r.action, targetId: r.target_id, targetName: r.target_name, details, ip: r.ip };
}
