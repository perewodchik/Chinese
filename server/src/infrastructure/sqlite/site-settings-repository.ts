import type { DatabaseSync } from 'node:sqlite';
import type { SiteSettingsRepository } from '../../application/ports';

/** The site's own settings (A11), in the one SQLite file. */
export class SqliteSiteSettingsRepository implements SiteSettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  async all(): Promise<Array<{ key: string; value: string; updatedAt: number; updatedBy: string }>> {
    const rows = this.db.prepare('SELECT key, value, updated_at, updated_by FROM site_settings').all() as unknown as Array<{ key: string; value: string; updated_at: number; updated_by: string }>;
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: Number(r.updated_at), updatedBy: r.updated_by }));
  }

  async set(key: string, value: string, at: number, by: string): Promise<void> {
    this.db
      .prepare('INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by')
      .run(key, value, at, by);
  }
}
