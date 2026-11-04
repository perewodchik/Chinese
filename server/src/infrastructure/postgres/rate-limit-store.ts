import type pg from 'pg';
import type { RateLimitStore } from '../../application/ports';

/** Attempts per key per window, in Postgres, shared by every instance of the function. */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly db: pg.Pool) {}

  async hit(key: string, windowStart: number): Promise<number> {
    // One statement, so two instances counting the same key at once both count.
    const { rows } = await this.db.query<{ count: string }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStart],
    );
    return Number(rows[0]!.count);
  }

  async reset(key: string): Promise<void> {
    await this.db.query('DELETE FROM rate_limits WHERE key = $1', [key]);
  }

  async sweep(before: number): Promise<void> {
    await this.db.query('DELETE FROM rate_limits WHERE window_start < $1', [before]);
  }
}
