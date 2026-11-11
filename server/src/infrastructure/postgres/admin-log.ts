import type pg from 'pg';
import type { AdminLogRecord, AdminLogRepository } from '../../application/ports';
import { toAdminLogRecord, type AdminLogRow } from '../admin-log-row';

/** The same log, in Postgres. */
export class PostgresAdminLog implements AdminLogRepository {
  constructor(private readonly db: pg.Pool) {}

  async add(e: AdminLogRecord): Promise<void> {
    await this.db.query(
      'INSERT INTO admin_log (at, actor_id, actor_name, action, target_id, target_name, details, ip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [e.at, e.actorId, e.actorName, e.action, e.targetId, e.targetName, JSON.stringify(e.details), e.ip],
    );
  }

  async list(q: { action?: string; name?: string; before?: number; limit: number }): Promise<AdminLogRecord[]> {
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (q.action) {
      args.push(q.action);
      where.push(`action = $${args.length}`);
    }
    if (q.name) {
      args.push(q.name);
      where.push(`(LOWER(actor_name) = LOWER($${args.length}) OR LOWER(target_name) = LOWER($${args.length}))`);
    }
    if (q.before !== undefined) {
      args.push(q.before);
      where.push(`id < $${args.length}`);
    }
    args.push(q.limit);
    const { rows } = await this.db.query<AdminLogRow>(
      `SELECT * FROM admin_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT $${args.length}`,
      args,
    );
    return rows.map(toAdminLogRecord);
  }

  async sweep(before: number): Promise<void> {
    await this.db.query('DELETE FROM admin_log WHERE at < $1', [before]);
  }
}
