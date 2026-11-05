import type { DatabaseSync } from 'node:sqlite';
import type { AuditEvent, AuditLog } from '../../application/ports';

/** What happened to accounts, in the one SQLite file. */
export class SqliteAuditLog implements AuditLog {
  constructor(private readonly db: DatabaseSync) {}

  async add(e: AuditEvent): Promise<void> {
    this.db.prepare('INSERT INTO audit_log (at, kind, username, ip, user_agent) VALUES (?, ?, ?, ?, ?)').run(e.at, e.kind, e.username, e.ip, e.userAgent);
  }

  async recent(limit: number): Promise<AuditEvent[]> {
    const rows = this.db.prepare('SELECT at, kind, username, ip, user_agent FROM audit_log ORDER BY at DESC, rowid DESC LIMIT ?').all(limit) as unknown as Array<{ at: number; kind: string; username: string; ip: string; user_agent: string | null }>;
    return rows.map((r) => ({ at: Number(r.at), kind: r.kind, username: r.username, ip: r.ip, userAgent: r.user_agent }));
  }

  async sweep(before: number): Promise<void> {
    this.db.prepare('DELETE FROM audit_log WHERE at < ?').run(before);
  }
}
