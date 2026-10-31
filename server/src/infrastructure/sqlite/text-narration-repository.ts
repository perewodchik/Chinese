import type { DatabaseSync } from 'node:sqlite';
import type { TextNarration, TextNarrationRepository } from '../../application/ports';

type Row = { key: string; user_id: string; narrator_id: string; mp3?: Uint8Array; timings: string; duration_ms: number; created_at: number };

export const narrationFromRow = (r: Row) => ({
  key: r.key,
  userId: r.user_id,
  narratorId: r.narrator_id,
  timings: JSON.parse(r.timings) as Array<[number, number]>,
  durationMs: Number(r.duration_ms),
  createdAt: Number(r.created_at),
});

/** Whole texts read by narrators, in the one SQLite file. */
export class SqliteTextNarrationRepository implements TextNarrationRepository {
  constructor(private readonly db: DatabaseSync) {}

  async find(key: string): Promise<TextNarration | null> {
    const r = this.db.prepare('SELECT * FROM text_narrations WHERE key = ?').get(key) as Row | undefined;
    return r ? { ...narrationFromRow(r), mp3: new Uint8Array(r.mp3!) } : null;
  }

  async have(keys: readonly string[]) {
    if (!keys.length) return [];
    const rows = this.db
      .prepare(`SELECT key, user_id, narrator_id, timings, duration_ms, created_at FROM text_narrations WHERE key IN (${keys.map(() => '?').join(', ')})`)
      .all(...keys) as Row[];
    return rows.map(narrationFromRow);
  }

  async save(n: TextNarration) {
    this.db
      .prepare(
        `INSERT INTO text_narrations (key, user_id, narrator_id, mp3, timings, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET mp3 = excluded.mp3, timings = excluded.timings, duration_ms = excluded.duration_ms, created_at = excluded.created_at`,
      )
      .run(n.key, n.userId, n.narratorId, n.mp3, JSON.stringify(n.timings), n.durationMs, n.createdAt);
  }
}
