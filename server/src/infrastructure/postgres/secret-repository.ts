import type pg from 'pg';
import type { SecretRepository } from '../../application/ports';

/** A learner's keys for outside services, in Postgres. */
export class PostgresSecretRepository implements SecretRepository {
  constructor(private readonly db: pg.Pool) {}

  async get(userId: string, name: string): Promise<string | null> {
    const { rows } = await this.db.query<{ value: string }>('SELECT value FROM user_secrets WHERE user_id = $1 AND name = $2', [userId, name]);
    return rows[0]?.value ?? null;
  }

  async set(userId: string, name: string, value: string, at: number): Promise<void> {
    await this.db.query(
      `INSERT INTO user_secrets (user_id, name, value, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, name) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [userId, name, value, at],
    );
  }

  async delete(userId: string, name: string): Promise<void> {
    await this.db.query('DELETE FROM user_secrets WHERE user_id = $1 AND name = $2', [userId, name]);
  }
}
