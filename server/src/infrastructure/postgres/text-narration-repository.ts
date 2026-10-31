import type pg from 'pg';
import type { TextNarration, TextNarrationRepository } from '../../application/ports';
import { narrationFromRow } from '../sqlite/text-narration-repository';

/** Whole texts read by narrators, in Postgres. */
export class PostgresTextNarrationRepository implements TextNarrationRepository {
  constructor(private readonly db: pg.Pool) {}

  async find(key: string): Promise<TextNarration | null> {
    const { rows } = await this.db.query('SELECT * FROM text_narrations WHERE key = $1', [key]);
    const r = rows[0];
    return r ? { ...narrationFromRow(r), mp3: new Uint8Array(r.mp3) } : null;
  }

  async have(keys: readonly string[]) {
    if (!keys.length) return [];
    const { rows } = await this.db.query(
      'SELECT key, user_id, narrator_id, timings, duration_ms, created_at FROM text_narrations WHERE key = ANY($1::text[])',
      [[...keys]],
    );
    return rows.map(narrationFromRow);
  }

  async save(n: TextNarration) {
    await this.db.query(
      `INSERT INTO text_narrations (key, user_id, narrator_id, mp3, timings, duration_ms, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET mp3 = EXCLUDED.mp3, timings = EXCLUDED.timings, duration_ms = EXCLUDED.duration_ms, created_at = EXCLUDED.created_at`,
      [n.key, n.userId, n.narratorId, Buffer.from(n.mp3), JSON.stringify(n.timings), n.durationMs, n.createdAt],
    );
  }
}
