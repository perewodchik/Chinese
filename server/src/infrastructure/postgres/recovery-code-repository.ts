import type pg from 'pg';
import type { RecoveryCodeRepository } from '../../application/ports';

/** An account's recovery codes, as digests, in Postgres. */
export class PostgresRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: pg.Pool) {}

  async replace(userId: string, digests: string[], at: number): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
      for (const d of digests) await client.query('INSERT INTO recovery_codes (user_id, digest, created_at, used_at) VALUES ($1, $2, $3, NULL)', [userId, d, at]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async use(userId: string, digest: string, at: number): Promise<boolean> {
    const { rowCount } = await this.db.query('UPDATE recovery_codes SET used_at = $1 WHERE user_id = $2 AND digest = $3 AND used_at IS NULL', [at, userId, digest]);
    return rowCount === 1;
  }

  async status(userId: string): Promise<{ left: number; createdAt: number } | null> {
    const { rows } = await this.db.query<{ n: string; left: string | null; at: string | null }>(
      'SELECT COUNT(*) AS n, SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS left, MAX(created_at) AS at FROM recovery_codes WHERE user_id = $1',
      [userId],
    );
    const r = rows[0]!;
    return Number(r.n) ? { left: Number(r.left ?? 0), createdAt: Number(r.at) } : null;
  }
}
