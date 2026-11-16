import type pg from 'pg';
import type { PasswordResetRepository } from '../../application/ports';

/** One-time password reset links (A6), as digests, in Postgres. */
export class PostgresPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: pg.Pool) {}

  async create(r: { digest: string; userId: string; createdAt: number; expiresAt: number; createdBy: string }): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL', [r.userId]);
      await client.query('INSERT INTO password_resets (digest, user_id, created_at, expires_at, created_by, used_at) VALUES ($1, $2, $3, $4, $5, NULL)', [
        r.digest,
        r.userId,
        r.createdAt,
        r.expiresAt,
        r.createdBy,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async find(digest: string, at: number): Promise<string | null> {
    const { rows } = await this.db.query<{ user_id: string }>('SELECT user_id FROM password_resets WHERE digest = $1 AND used_at IS NULL AND expires_at > $2', [digest, at]);
    return rows[0]?.user_id ?? null;
  }

  async use(digest: string, at: number): Promise<string | null> {
    const { rows } = await this.db.query<{ user_id: string }>(
      'UPDATE password_resets SET used_at = $1 WHERE digest = $2 AND used_at IS NULL AND expires_at > $1 RETURNING user_id',
      [at, digest],
    );
    return rows[0]?.user_id ?? null;
  }
}
