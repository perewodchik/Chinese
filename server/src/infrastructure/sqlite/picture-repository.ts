import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { Picture, PictureRepository } from '../../application/ports';

/** The pictures beside the texts' paragraphs, kept in the one SQLite file. */
export class SqlitePictureRepository implements PictureRepository {
  private readonly byKey: StatementSync;
  private readonly insert: StatementSync;

  constructor(db: DatabaseSync) {
    this.byKey = db.prepare('SELECT user_id, mime, bytes, created_at FROM pictures WHERE key = ?');
    this.insert = db.prepare(
      `INSERT INTO pictures (key, user_id, mime, bytes, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (key) DO NOTHING`,
    );
  }

  async find(key: string): Promise<Picture | null> {
    const row = this.byKey.get(key) as { user_id: string; mime: string; bytes: Uint8Array; created_at: number } | undefined;
    return row ? { key, userId: row.user_id, mime: row.mime, bytes: new Uint8Array(row.bytes), createdAt: row.created_at } : null;
  }

  async save(p: Picture): Promise<void> {
    this.insert.run(p.key, p.userId, p.mime, p.bytes, p.createdAt);
  }
}
