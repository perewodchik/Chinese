import type { DatabaseSync } from 'node:sqlite';
import type { ClientErrorRecord, ClientErrorRepository } from '../../application/ports';

interface Row {
  id: string;
  user_id: string;
  at: number | string;
  message: string;
  page: string;
  user_agent: string | null;
}

export const toError = (r: Row): ClientErrorRecord => ({ id: r.id, userId: r.user_id, at: Number(r.at), message: r.message, page: r.page, userAgent: r.user_agent });

/** What broke on learners' screens (R15), in the one SQLite file. */
export class SqliteClientErrorRepository implements ClientErrorRepository {
  constructor(private readonly db: DatabaseSync) {}

  async add(e: ClientErrorRecord): Promise<void> {
    this.db.prepare('INSERT INTO client_errors (id, user_id, at, message, page, user_agent) VALUES (?, ?, ?, ?, ?, ?)').run(e.id, e.userId, e.at, e.message, e.page, e.userAgent);
  }

  async recent(limit: number): Promise<ClientErrorRecord[]> {
    return (this.db.prepare('SELECT * FROM client_errors ORDER BY at DESC LIMIT ?').all(limit) as unknown as Row[]).map(toError);
  }

  async sweep(before: number): Promise<void> {
    this.db.prepare('DELETE FROM client_errors WHERE at < ?').run(before);
  }
}
