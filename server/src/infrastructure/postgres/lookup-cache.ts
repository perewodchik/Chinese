import type pg from 'pg';
import type { LookupCache } from '../../application/ports';

/** Answers the same for everyone, kept a while, in Postgres. */
export class PostgresLookupCache implements LookupCache {
  constructor(private readonly db: pg.Pool) {}

  async get(key: string, since: number): Promise<string | null> {
    const { rows } = await this.db.query<{ body: string }>('SELECT body FROM lookup_cache WHERE key = $1 AND fetched_at >= $2', [key, since]);
    return rows[0]?.body ?? null;
  }

  async put(key: string, body: string, at: number): Promise<void> {
    await this.db.query(
      'INSERT INTO lookup_cache (key, body, fetched_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, fetched_at = EXCLUDED.fetched_at',
      [key, body, at],
    );
  }
}
