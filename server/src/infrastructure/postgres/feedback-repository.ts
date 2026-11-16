import type pg from 'pg';
import type { FeedbackRecord, FeedbackRepository } from '../../application/ports';

interface Row {
  id: string;
  user_id: string;
  kind: string;
  message: string;
  page: string;
  created_at: string;
  status: string;
  updated_at: string;
}

// BIGINT comes back from pg as a string.
const toRecord = (r: Row): FeedbackRecord => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  message: r.message,
  page: r.page,
  createdAt: Number(r.created_at),
  status: r.status,
  updatedAt: Number(r.updated_at),
});

/** Feedback sent from the site (A12), in Postgres. */
export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: pg.Pool) {}

  async add(f: FeedbackRecord): Promise<void> {
    await this.db.query('INSERT INTO feedback (id, user_id, kind, message, page, created_at, status, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
      f.id,
      f.userId,
      f.kind,
      f.message,
      f.page,
      f.createdAt,
      f.status,
      f.updatedAt,
    ]);
  }

  async list(o: { status?: string; limit: number }): Promise<FeedbackRecord[]> {
    const { rows } = o.status
      ? await this.db.query<Row>('SELECT * FROM feedback WHERE status = $1 ORDER BY created_at DESC LIMIT $2', [o.status, o.limit])
      : await this.db.query<Row>('SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1', [o.limit]);
    return rows.map(toRecord);
  }

  async setStatus(id: string, status: string, at: number): Promise<boolean> {
    const { rowCount } = await this.db.query('UPDATE feedback SET status = $1, updated_at = $2 WHERE id = $3', [status, at, id]);
    return rowCount === 1;
  }
}
