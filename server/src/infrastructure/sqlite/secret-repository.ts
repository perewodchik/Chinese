import type { DatabaseSync } from 'node:sqlite';
import type { SecretRepository } from '../../application/ports';

/** A learner's keys for outside services, in the one SQLite file. */
export class SqliteSecretRepository implements SecretRepository {
  constructor(private readonly db: DatabaseSync) {}

  async get(userId: string, name: string): Promise<string | null> {
    const row = this.db.prepare('SELECT value FROM user_secrets WHERE user_id = ? AND name = ?').get(userId, name) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async set(userId: string, name: string, value: string, at: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO user_secrets (user_id, name, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(userId, name, value, at);
  }

  async delete(userId: string, name: string): Promise<void> {
    this.db.prepare('DELETE FROM user_secrets WHERE user_id = ? AND name = ?').run(userId, name);
  }
}
