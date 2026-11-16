import type { DatabaseSync } from 'node:sqlite';
import type { FeedbackRecord, FeedbackRepository } from '../../application/ports';

interface Row {
  id: string;
  user_id: string;
  kind: string;
  message: string;
  page: string;
  created_at: number;
  status: string;
  updated_at: number;
}

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

/** Feedback sent from the site (A12), in the one SQLite file. */
export class SqliteFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: DatabaseSync) {}

  async add(f: FeedbackRecord): Promise<void> {
    this.db
      .prepare('INSERT INTO feedback (id, user_id, kind, message, page, created_at, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.id, f.userId, f.kind, f.message, f.page, f.createdAt, f.status, f.updatedAt);
  }

  async list(o: { status?: string; limit: number }): Promise<FeedbackRecord[]> {
    const rows = o.status
      ? this.db.prepare('SELECT * FROM feedback WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(o.status, o.limit)
      : this.db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?').all(o.limit);
    return (rows as unknown as Row[]).map(toRecord);
  }

  async setStatus(id: string, status: string, at: number): Promise<boolean> {
    const done = this.db.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?').run(status, at, id);
    return Number(done.changes) === 1;
  }
}
