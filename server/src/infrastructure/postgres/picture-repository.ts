import type pg from 'pg';
import type { Picture, PictureRepository } from '../../application/ports';

/** The pictures beside the texts' paragraphs, in Postgres. */
export class PostgresPictureRepository implements PictureRepository {
  constructor(private readonly db: pg.Pool) {}

  async find(key: string): Promise<Picture | null> {
    const { rows } = await this.db.query<{ user_id: string; mime: string; bytes: Buffer; created_at: string }>(
      'SELECT user_id, mime, bytes, created_at FROM pictures WHERE key = $1',
      [key],
    );
    const row = rows[0];
    return row ? { key, userId: row.user_id, mime: row.mime, bytes: new Uint8Array(row.bytes), createdAt: Number(row.created_at) } : null;
  }

  async save(p: Picture): Promise<void> {
    await this.db.query(
      `INSERT INTO pictures (key, user_id, mime, bytes, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [p.key, p.userId, p.mime, Buffer.from(p.bytes), p.createdAt],
    );
  }
}
