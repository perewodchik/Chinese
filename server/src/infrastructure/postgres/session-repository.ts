import type pg from 'pg';
import type { SessionRepository } from '../../application/ports';
import type { Session } from '../../domain/entities';

interface Row {
  id: string;
  user_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  user_agent: string | null;
}

const toSession = (r: Row): Session => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  expiresAt: r.expires_at,
  userAgent: r.user_agent,
});

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: pg.Pool) {}

  async insert(s: Session): Promise<void> {
    await this.db.query(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [s.id, s.userId, s.createdAt, s.lastSeenAt, s.expiresAt, s.userAgent],
    );
  }

  async findById(id: string): Promise<Session | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM sessions WHERE id = $1', [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void> {
    await this.db.query('UPDATE sessions SET last_seen_at = $1, expires_at = $2 WHERE id = $3', [
      lastSeenAt,
      expiresAt,
      id,
    ]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  async deleteForUser(userId: string, keepId?: string): Promise<number> {
    const result = keepId
      ? await this.db.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, keepId])
      : await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    return result.rowCount ?? 0;
  }

  async deleteExpired(now: number): Promise<number> {
    const result = await this.db.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
    return result.rowCount ?? 0;
  }
}
