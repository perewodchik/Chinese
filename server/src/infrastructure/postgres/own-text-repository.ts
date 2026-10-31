import type pg from 'pg';
import type { OwnText, OwnTextRepository } from '../../application/ports';
import { ownTextFromRow } from '../sqlite/own-text-repository';

/** The learner's own texts read aloud, in Postgres. */
export class PostgresOwnTextRepository implements OwnTextRepository {
  constructor(private readonly db: pg.Pool) {}

  async list(userId: string) {
    const { rows } = await this.db.query('SELECT * FROM own_texts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return rows.map(ownTextFromRow);
  }

  async find(userId: string, id: string) {
    const { rows } = await this.db.query('SELECT * FROM own_texts WHERE user_id = $1 AND id = $2', [userId, id]);
    return rows[0] ? ownTextFromRow(rows[0]) : null;
  }

  async save(t: OwnText) {
    await this.db.query(
      `INSERT INTO own_texts (id, user_id, title, lines, narrator_id, narration_key, text_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, lines = EXCLUDED.lines, narrator_id = EXCLUDED.narrator_id,
         narration_key = EXCLUDED.narration_key, text_id = EXCLUDED.text_id`,
      [t.id, t.userId, t.title, JSON.stringify(t.lines), t.narratorId, t.narrationKey, t.textId, t.createdAt],
    );
  }

  async delete(userId: string, id: string) {
    const { rowCount } = await this.db.query('DELETE FROM own_texts WHERE user_id = $1 AND id = $2', [userId, id]);
    return (rowCount ?? 0) > 0;
  }
}
