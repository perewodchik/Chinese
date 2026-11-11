import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { AdminLogRecord, AdminLogRepository } from '../../application/ports';
import { toAdminLogRecord, type AdminLogRow } from '../admin-log-row';

/** What the accounts that run the site did, in the one SQLite file. */
export class SqliteAdminLog implements AdminLogRepository {
  constructor(private readonly db: DatabaseSync) {}

  async add(e: AdminLogRecord): Promise<void> {
    this.db
      .prepare('INSERT INTO admin_log (at, actor_id, actor_name, action, target_id, target_name, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(e.at, e.actorId, e.actorName, e.action, e.targetId, e.targetName, JSON.stringify(e.details), e.ip);
  }

  async list(q: { action?: string; name?: string; before?: number; limit: number }): Promise<AdminLogRecord[]> {
    const where: string[] = [];
    const args: SQLInputValue[] = [];
    if (q.action) {
      where.push('action = ?');
      args.push(q.action);
    }
    if (q.name) {
      where.push('(LOWER(actor_name) = LOWER(?) OR LOWER(target_name) = LOWER(?))');
      args.push(q.name, q.name);
    }
    if (q.before !== undefined) {
      where.push('id < ?');
      args.push(q.before);
    }
    const sql = `SELECT * FROM admin_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
    const rows = this.db.prepare(sql).all(...args, q.limit) as unknown as AdminLogRow[];
    return rows.map(toAdminLogRecord);
  }

  async sweep(before: number): Promise<void> {
    this.db.prepare('DELETE FROM admin_log WHERE at < ?').run(before);
  }
}
