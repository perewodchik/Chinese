import type { DatabaseSync } from 'node:sqlite';
import type { OwnText, OwnTextRepository } from '../../application/ports';

type Row = { id: string; user_id: string; title: string; lines: string; narrator_id: string; narration_key: string; text_id: string | null; created_at: number };

export const ownTextFromRow = (r: Row): OwnText => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  lines: JSON.parse(r.lines) as string[],
  narratorId: r.narrator_id,
  narrationKey: r.narration_key,
  textId: r.text_id,
  createdAt: Number(r.created_at),
});

/** The learner's own texts read aloud, in the one SQLite file. */
export class SqliteOwnTextRepository implements OwnTextRepository {
  constructor(private readonly db: DatabaseSync) {}

  async list(userId: string) {
    return (this.db.prepare('SELECT * FROM own_texts WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Row[]).map(ownTextFromRow);
  }

  async find(userId: string, id: string) {
    const row = this.db.prepare('SELECT * FROM own_texts WHERE user_id = ? AND id = ?').get(userId, id) as Row | undefined;
    return row ? ownTextFromRow(row) : null;
  }

  async save(t: OwnText) {
    this.db
      .prepare(
        `INSERT INTO own_texts (id, user_id, title, lines, narrator_id, narration_key, text_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET title = excluded.title, lines = excluded.lines, narrator_id = excluded.narrator_id,
           narration_key = excluded.narration_key, text_id = excluded.text_id`,
      )
      .run(t.id, t.userId, t.title, JSON.stringify(t.lines), t.narratorId, t.narrationKey, t.textId, t.createdAt);
  }

  async delete(userId: string, id: string) {
    return Number(this.db.prepare('DELETE FROM own_texts WHERE user_id = ? AND id = ?').run(userId, id).changes) > 0;
  }
}
