import type pg from 'pg';
import type { AuditEvent, AuditLog } from '../../application/ports';

/** What happened to accounts, in Postgres. */
export class PostgresAuditLog implements AuditLog {
  constructor(private readonly db: pg.Pool) {}

  async add(e: AuditEvent): Promise<void> {
    await this.db.query('INSERT INTO audit_log (at, kind, username, ip, user_agent) VALUES ($1, $2, $3, $4, $5)', [e.at, e.kind, e.username, e.ip, e.userAgent]);
  }

  async recent(limit: number): Promise<AuditEvent[]> {
    const { rows } = await this.db.query<{ at: string; kind: string; username: string; ip: string; user_agent: string | null }>(
      'SELECT at, kind, username, ip, user_agent FROM audit_log ORDER BY at DESC LIMIT $1',
      [limit],
    );
    return rows.map((r) => ({ at: Number(r.at), kind: r.kind, username: r.username, ip: r.ip, userAgent: r.user_agent }));
  }

  async sweep(before: number): Promise<void> {
    await this.db.query('DELETE FROM audit_log WHERE at < $1', [before]);
  }
}
