import type pg from 'pg';
import type { NarratorRecord, NarratorRepository } from '../../application/ports';
import { narratorFromRow } from '../sqlite/narrator-repository';

/** The narrators a learner made, in Postgres. */
export class PostgresNarratorRepository implements NarratorRepository {
  constructor(private readonly db: pg.Pool) {}

  async list(userId: string) {
    const { rows } = await this.db.query('SELECT * FROM narrators WHERE user_id = $1 ORDER BY created_at', [userId]);
    return rows.map(narratorFromRow);
  }

  async find(userId: string, id: string) {
    const { rows } = await this.db.query('SELECT * FROM narrators WHERE user_id = $1 AND id = $2', [userId, id]);
    return rows[0] ? narratorFromRow(rows[0]) : null;
  }

  async save(n: NarratorRecord) {
    await this.db.query(
      `INSERT INTO narrators (id, user_id, name, kind, voice_id, prompt, preview_text, speed, pitch, emotion, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, voice_id = EXCLUDED.voice_id, prompt = EXCLUDED.prompt,
         preview_text = EXCLUDED.preview_text, speed = EXCLUDED.speed, pitch = EXCLUDED.pitch, emotion = EXCLUDED.emotion, updated_at = EXCLUDED.updated_at`,
      [n.id, n.userId, n.name, n.kind, n.voiceId, n.prompt, n.previewText, n.speed, n.pitch, n.emotion, n.createdAt, n.updatedAt],
    );
  }

  async delete(userId: string, id: string) {
    const r = await this.db.query('DELETE FROM narrators WHERE user_id = $1 AND id = $2', [userId, id]);
    return (r.rowCount ?? 0) > 0;
  }
}
