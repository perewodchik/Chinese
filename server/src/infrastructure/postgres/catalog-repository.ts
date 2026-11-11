import type pg from 'pg';
import type { CatalogBookRecord, CatalogRepository, CatalogTextRecord } from '../../application/ports';
import { bookColumns, toCatalogBook, toCatalogText, type CatalogBookRow, type CatalogTextRow } from '../catalog-row';

/** The same catalogue, in Postgres. */
export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly db: pg.Pool) {}

  async save(book: CatalogBookRecord, texts: CatalogTextRecord[]): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO catalog_books (id, title, title_zh, level, kind, blurb, source, licence, version, published_at, published_by, hidden_at, texts, chars)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET title = excluded.title, title_zh = excluded.title_zh, level = excluded.level, kind = excluded.kind,
           blurb = excluded.blurb, source = excluded.source, licence = excluded.licence, version = excluded.version,
           published_at = excluded.published_at, published_by = excluded.published_by, hidden_at = excluded.hidden_at,
           texts = excluded.texts, chars = excluded.chars`,
        [...bookColumns(book)],
      );
      await client.query('DELETE FROM catalog_texts WHERE book_id = $1', [book.id]);
      for (const t of texts) {
        await client.query('INSERT INTO catalog_texts (book_id, position, id, document, chars) VALUES ($1, $2, $3, $4, $5)', [book.id, t.position, t.id, JSON.stringify(t.document), t.chars]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async setHidden(id: string, hiddenAt: number | null): Promise<boolean> {
    const done = await this.db.query('UPDATE catalog_books SET hidden_at = $1 WHERE id = $2', [hiddenAt, id]);
    return (done.rowCount ?? 0) === 1;
  }

  async list(includeHidden: boolean): Promise<CatalogBookRecord[]> {
    const { rows } = await this.db.query<CatalogBookRow>(`SELECT * FROM catalog_books ${includeHidden ? '' : 'WHERE hidden_at IS NULL'} ORDER BY published_at DESC, id`);
    return rows.map(toCatalogBook);
  }

  async find(id: string): Promise<CatalogBookRecord | null> {
    const { rows } = await this.db.query<CatalogBookRow>('SELECT * FROM catalog_books WHERE id = $1', [id]);
    return rows[0] ? toCatalogBook(rows[0]) : null;
  }

  async texts(bookId: string): Promise<CatalogTextRecord[]> {
    const { rows } = await this.db.query<CatalogTextRow>('SELECT id, position, document, chars FROM catalog_texts WHERE book_id = $1 ORDER BY position', [bookId]);
    return rows.map(toCatalogText);
  }

  async savePicture(p: { key: string; mime: string; bytes: Uint8Array; createdAt: number }): Promise<void> {
    await this.db.query('INSERT INTO catalog_pictures (key, mime, bytes, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING', [p.key, p.mime, Buffer.from(p.bytes), p.createdAt]);
  }

  async findPicture(key: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
    const { rows } = await this.db.query<{ mime: string; bytes: Buffer }>('SELECT mime, bytes FROM catalog_pictures WHERE key = $1', [key]);
    return rows[0] ? { mime: rows[0].mime, bytes: new Uint8Array(rows[0].bytes) } : null;
  }
}
