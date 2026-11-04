import type { DatabaseSync } from 'node:sqlite';
import type { RateLimitStore } from '../../application/ports';

/** Attempts per key per window, in the one SQLite file, so a restart does not forget them. */
export class SqliteRateLimitStore implements RateLimitStore {
  constructor(private readonly db: DatabaseSync) {}

  async hit(key: string, windowStart: number): Promise<number> {
    const row = this.db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .get(key, windowStart) as { count: number };
    return Number(row.count);
  }

  async reset(key: string): Promise<void> {
    this.db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
  }

  async sweep(before: number): Promise<void> {
    this.db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(before);
  }
}
