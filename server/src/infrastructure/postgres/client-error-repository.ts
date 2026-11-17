import type pg from 'pg';
import type { ClientErrorRecord, ClientErrorRepository } from '../../application/ports';
import { toError } from '../sqlite/client-error-repository';

/** What broke on learners' screens (R15), in Postgres. */
export class PostgresClientErrorRepository implements ClientErrorRepository {
  constructor(private readonly db: pg.Pool) {}

  async add(e: ClientErrorRecord): Promise<void> {
    await this.db.query('INSERT INTO client_errors (id, user_id, at, message, page, user_agent) VALUES ($1, $2, $3, $4, $5, $6)', [e.id, e.userId, e.at, e.message, e.page, e.userAgent]);
  }

  async recent(limit: number): Promise<ClientErrorRecord[]> {
    const { rows } = await this.db.query('SELECT * FROM client_errors ORDER BY at DESC LIMIT $1', [limit]);
    return rows.map(toError);
  }

  async sweep(before: number): Promise<void> {
    await this.db.query('DELETE FROM client_errors WHERE at < $1', [before]);
  }
}
