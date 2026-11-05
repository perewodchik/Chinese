import type { DatabaseSync } from 'node:sqlite';
import type { RecoveryCodeRepository } from '../../application/ports';

/** An account's recovery codes, as digests, in the one SQLite file. */
export class SqliteRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly db: DatabaseSync) {}

  async replace(userId: string, digests: string[], at: number): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(userId);
      const add = this.db.prepare('INSERT INTO recovery_codes (user_id, digest, created_at, used_at) VALUES (?, ?, ?, NULL)');
      for (const d of digests) add.run(userId, d, at);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async use(userId: string, digest: string, at: number): Promise<boolean> {
    const done = this.db.prepare('UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND digest = ? AND used_at IS NULL').run(at, userId, digest);
    return Number(done.changes) === 1;
  }

  async status(userId: string): Promise<{ left: number; createdAt: number } | null> {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n, SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS left, MAX(created_at) AS at FROM recovery_codes WHERE user_id = ?')
      .get(userId) as { n: number; left: number | null; at: number | null };
    return Number(row.n) ? { left: Number(row.left ?? 0), createdAt: Number(row.at) } : null;
  }
}
