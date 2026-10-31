import type { DatabaseSync } from 'node:sqlite';
import type { NarratorRecord, NarratorRepository } from '../../application/ports';

type Row = { id: string; user_id: string; name: string; kind: string; voice_id: string; prompt: string; preview_text: string; speed: number; pitch: number; emotion: string | null; created_at: number; updated_at: number };

export const narratorFromRow = (r: Row): NarratorRecord => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  kind: r.kind === 'system' ? 'system' : 'designed',
  voiceId: r.voice_id,
  prompt: r.prompt,
  previewText: r.preview_text,
  speed: Number(r.speed),
  pitch: Number(r.pitch),
  emotion: r.emotion,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

/** The narrators a learner made, in the one SQLite file. */
export class SqliteNarratorRepository implements NarratorRepository {
  constructor(private readonly db: DatabaseSync) {}

  async list(userId: string) {
    return (this.db.prepare('SELECT * FROM narrators WHERE user_id = ? ORDER BY created_at').all(userId) as Row[]).map(narratorFromRow);
  }

  async find(userId: string, id: string) {
    const row = this.db.prepare('SELECT * FROM narrators WHERE user_id = ? AND id = ?').get(userId, id) as Row | undefined;
    return row ? narratorFromRow(row) : null;
  }

  async save(n: NarratorRecord) {
    this.db
      .prepare(
        `INSERT INTO narrators (id, user_id, name, kind, voice_id, prompt, preview_text, speed, pitch, emotion, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, voice_id = excluded.voice_id, prompt = excluded.prompt,
           preview_text = excluded.preview_text, speed = excluded.speed, pitch = excluded.pitch, emotion = excluded.emotion, updated_at = excluded.updated_at`,
      )
      .run(n.id, n.userId, n.name, n.kind, n.voiceId, n.prompt, n.previewText, n.speed, n.pitch, n.emotion, n.createdAt, n.updatedAt);
  }

  async delete(userId: string, id: string) {
    return Number(this.db.prepare('DELETE FROM narrators WHERE user_id = ? AND id = ?').run(userId, id).changes) > 0;
  }
}
