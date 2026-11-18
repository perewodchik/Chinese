import type pg from 'pg';
import type { CatalogBookRecord, CatalogReaders, CatalogRepository, CatalogTextRecord } from '../../application/ports';
import { bookColumns, toCatalogBook, toCatalogText, type CatalogBookRow, type CatalogTextRow } from '../catalog-row';

/** The same catalogue, in Postgres. */
export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly db: pg.Pool) {}

  async save(book: CatalogBookRecord, texts: CatalogTextRecord[]): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO catalog_books (id, title, title_zh, level, kind, blurb, source, licence, version, published_at, published_by, hidden_at, texts, chars, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
    const { rows } = await this.db.query<CatalogBookRow>(`SELECT * FROM catalog_books ${includeHidden ? '' : 'WHERE hidden_at IS NULL'} ORDER BY position DESC, id`);
    return rows.map(toCatalogBook);
  }

  async move(id: string, way: 'earlier' | 'later'): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ id: string; position: string }>('SELECT id, position FROM catalog_books ORDER BY position DESC, id FOR UPDATE');
      const at = rows.findIndex((b) => b.id === id);
      const other = rows[way === 'earlier' ? at - 1 : at + 1];
      if (at < 0 || !other) {
        await client.query('ROLLBACK');
        return false;
      }
      const me = rows[at]!;
      // Two books published at the same moment share a position: the one moved goes just past the other.
      const [mine, theirs] = me.position === other.position ? [Number(other.position) + (way === 'earlier' ? 1 : -1), Number(me.position)] : [Number(other.position), Number(me.position)];
      await client.query('UPDATE catalog_books SET position = $1 WHERE id = $2', [mine, me.id]);
      await client.query('UPDATE catalog_books SET position = $1 WHERE id = $2', [theirs, other.id]);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async setLevel(id: string, level: number): Promise<boolean> {
    const done = await this.db.query('UPDATE catalog_books SET level = $1 WHERE id = $2', [level, id]);
    return (done.rowCount ?? 0) === 1;
  }

  async markReader(bookId: string, userId: string, at: number, finished: boolean): Promise<void> {
    await this.db.query(
      'INSERT INTO catalog_readers (book_id, user_id, taken_at, finished_at) VALUES ($1, $2, $3, $4) ON CONFLICT (book_id, user_id) DO UPDATE SET finished_at = COALESCE(catalog_readers.finished_at, excluded.finished_at)',
      [bookId, userId, at, finished ? at : null],
    );
  }

  async readers(): Promise<Map<string, CatalogReaders>> {
    const { rows } = await this.db.query<{ book_id: string; took: string; finished: string }>('SELECT book_id, COUNT(*) AS took, COUNT(finished_at) AS finished FROM catalog_readers GROUP BY book_id');
    return new Map(rows.map((r) => [r.book_id, { took: Number(r.took), finished: Number(r.finished) }]));
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
