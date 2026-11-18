import type { DatabaseSync } from 'node:sqlite';
import type { CatalogBookRecord, CatalogReaders, CatalogRepository, CatalogTextRecord } from '../../application/ports';
import { bookColumns, toCatalogBook, toCatalogText, type CatalogBookRow, type CatalogTextRow } from '../catalog-row';

/** The shared catalogue, in the one SQLite file. */
export class SqliteCatalogRepository implements CatalogRepository {
  constructor(private readonly db: DatabaseSync) {}

  async save(book: CatalogBookRecord, texts: CatalogTextRecord[]): Promise<void> {
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO catalog_books (id, title, title_zh, level, kind, blurb, source, licence, version, published_at, published_by, hidden_at, texts, chars, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET title = excluded.title, title_zh = excluded.title_zh, level = excluded.level, kind = excluded.kind,
             blurb = excluded.blurb, source = excluded.source, licence = excluded.licence, version = excluded.version,
             published_at = excluded.published_at, published_by = excluded.published_by, hidden_at = excluded.hidden_at,
             texts = excluded.texts, chars = excluded.chars`,
        )
        .run(...bookColumns(book));
      this.db.prepare('DELETE FROM catalog_texts WHERE book_id = ?').run(book.id);
      const add = this.db.prepare('INSERT INTO catalog_texts (book_id, position, id, document, chars) VALUES (?, ?, ?, ?, ?)');
      for (const t of texts) add.run(book.id, t.position, t.id, JSON.stringify(t.document), t.chars);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async setHidden(id: string, hiddenAt: number | null): Promise<boolean> {
    return Number(this.db.prepare('UPDATE catalog_books SET hidden_at = ? WHERE id = ?').run(hiddenAt, id).changes) === 1;
  }

  async list(includeHidden: boolean): Promise<CatalogBookRecord[]> {
    const rows = this.db.prepare(`SELECT * FROM catalog_books ${includeHidden ? '' : 'WHERE hidden_at IS NULL'} ORDER BY position DESC, id`).all() as unknown as CatalogBookRow[];
    return rows.map(toCatalogBook);
  }

  async move(id: string, way: 'earlier' | 'later'): Promise<boolean> {
    const all = this.db.prepare('SELECT id, position FROM catalog_books ORDER BY position DESC, id').all() as unknown as Array<{ id: string; position: number }>;
    const at = all.findIndex((b) => b.id === id);
    const other = all[way === 'earlier' ? at - 1 : at + 1];
    if (at < 0 || !other) return false;
    const me = all[at]!;
    // Two books published at the same moment share a position: the one moved goes just past the other.
    const [mine, theirs] = me.position === other.position ? [Number(other.position) + (way === 'earlier' ? 1 : -1), Number(me.position)] : [Number(other.position), Number(me.position)];
    this.db.exec('BEGIN');
    try {
      const set = this.db.prepare('UPDATE catalog_books SET position = ? WHERE id = ?');
      set.run(mine, me.id);
      set.run(theirs, other.id);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return true;
  }

  async setLevel(id: string, level: number): Promise<boolean> {
    return Number(this.db.prepare('UPDATE catalog_books SET level = ? WHERE id = ?').run(level, id).changes) === 1;
  }

  async markReader(bookId: string, userId: string, at: number, finished: boolean): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO catalog_readers (book_id, user_id, taken_at, finished_at) VALUES (?, ?, ?, ?) ON CONFLICT (book_id, user_id) DO UPDATE SET finished_at = COALESCE(catalog_readers.finished_at, excluded.finished_at)',
      )
      .run(bookId, userId, at, finished ? at : null);
  }

  async readers(): Promise<Map<string, CatalogReaders>> {
    const rows = this.db.prepare('SELECT book_id, COUNT(*) AS took, COUNT(finished_at) AS finished FROM catalog_readers GROUP BY book_id').all() as unknown as Array<{ book_id: string; took: number; finished: number }>;
    return new Map(rows.map((r) => [r.book_id, { took: Number(r.took), finished: Number(r.finished) }]));
  }

  async find(id: string): Promise<CatalogBookRecord | null> {
    const row = this.db.prepare('SELECT * FROM catalog_books WHERE id = ?').get(id) as CatalogBookRow | undefined;
    return row ? toCatalogBook(row) : null;
  }

  async texts(bookId: string): Promise<CatalogTextRecord[]> {
    const rows = this.db.prepare('SELECT id, position, document, chars FROM catalog_texts WHERE book_id = ? ORDER BY position').all(bookId) as unknown as CatalogTextRow[];
    return rows.map(toCatalogText);
  }

  async savePicture(p: { key: string; mime: string; bytes: Uint8Array; createdAt: number }): Promise<void> {
    this.db.prepare('INSERT INTO catalog_pictures (key, mime, bytes, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO NOTHING').run(p.key, p.mime, p.bytes, p.createdAt);
  }

  async findPicture(key: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
    const row = this.db.prepare('SELECT mime, bytes FROM catalog_pictures WHERE key = ?').get(key) as { mime: string; bytes: Uint8Array } | undefined;
    return row ? { mime: row.mime, bytes: new Uint8Array(row.bytes) } : null;
  }
}
