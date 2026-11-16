import type { DatabaseSync } from 'node:sqlite';
import type { PasswordResetRepository } from '../../application/ports';

/** One-time password reset links (A6), as digests, in the one SQLite file. */
export class SqlitePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: DatabaseSync) {}

  async create(r: { digest: string; userId: string; createdAt: number; expiresAt: number; createdBy: string }): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(r.userId);
      this.db
        .prepare('INSERT INTO password_resets (digest, user_id, created_at, expires_at, created_by, used_at) VALUES (?, ?, ?, ?, ?, NULL)')
        .run(r.digest, r.userId, r.createdAt, r.expiresAt, r.createdBy);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async find(digest: string, at: number): Promise<string | null> {
    const row = this.db.prepare('SELECT user_id FROM password_resets WHERE digest = ? AND used_at IS NULL AND expires_at > ?').get(digest, at) as { user_id: string } | undefined;
    return row?.user_id ?? null;
  }

  async use(digest: string, at: number): Promise<string | null> {
    const row = this.db
      .prepare('UPDATE password_resets SET used_at = ? WHERE digest = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id')
      .get(at, digest, at) as { user_id: string } | undefined;
    return row?.user_id ?? null;
  }
}
