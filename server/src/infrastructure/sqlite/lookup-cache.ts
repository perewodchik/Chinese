import type { DatabaseSync } from 'node:sqlite';
import type { LookupCache } from '../../application/ports';

/** Answers the same for everyone, kept a while, in the one SQLite file. */
export class SqliteLookupCache implements LookupCache {
  constructor(private readonly db: DatabaseSync) {}

  async get(key: string, since: number): Promise<string | null> {
    const row = this.db.prepare('SELECT body FROM lookup_cache WHERE key = ? AND fetched_at >= ?').get(key, since) as { body: string } | undefined;
    return row?.body ?? null;
  }

  async put(key: string, body: string, at: number): Promise<void> {
    this.db
      .prepare('INSERT INTO lookup_cache (key, body, fetched_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at')
      .run(key, body, at);
  }
}
