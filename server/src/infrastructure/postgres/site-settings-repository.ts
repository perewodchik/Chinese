import type pg from 'pg';
import type { SiteSettingsRepository } from '../../application/ports';

/** The site's own settings (A11), in Postgres. */
export class PostgresSiteSettingsRepository implements SiteSettingsRepository {
  constructor(private readonly db: pg.Pool) {}

  async all(): Promise<Array<{ key: string; value: string; updatedAt: number; updatedBy: string }>> {
    const { rows } = await this.db.query<{ key: string; value: string; updated_at: string; updated_by: string }>('SELECT key, value, updated_at, updated_by FROM site_settings');
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: Number(r.updated_at), updatedBy: r.updated_by }));
  }

  async set(key: string, value: string, at: number, by: string): Promise<void> {
    await this.db.query(
      'INSERT INTO site_settings (key, value, updated_at, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by',
      [key, value, at, by],
    );
  }
}
