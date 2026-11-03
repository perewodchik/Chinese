import type { DatabaseSync } from 'node:sqlite';
import type { SpeechAttempt, SpeechAttemptRepository } from '../../application/ports';

type Row = { id: string; user_id: string; at: number; kind: string; source_id: string | null; text: string; tally: string | null; good: number | boolean; summary: string | null; has_result?: number | boolean };

export const attemptFromRow = (r: Row): Omit<SpeechAttempt, 'result'> & { hasResult: boolean } => ({
  id: r.id,
  userId: r.user_id,
  at: Number(r.at),
  kind: r.kind === 'drill' || r.kind === 'voice' ? r.kind : 'phrase',
  sourceId: r.source_id,
  text: r.text,
  tally: r.tally,
  good: Boolean(r.good),
  summary: r.summary,
  hasResult: Boolean(r.has_result),
});

const COLUMNS = 'id, user_id, at, kind, source_id, text, tally, good, summary';

/** Things said aloud and scored, in the one SQLite file. */
export class SqliteSpeechAttemptRepository implements SpeechAttemptRepository {
  constructor(private readonly db: DatabaseSync) {}

  async add(items: SpeechAttempt[]) {
    const insert = this.db.prepare(
      `INSERT INTO speech_attempts (${COLUMNS}, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    );
    for (const a of items) insert.run(a.id, a.userId, a.at, a.kind, a.sourceId, a.text, a.tally, a.good ? 1 : 0, a.summary, a.result);
  }

  async find(userId: string, id: string) {
    const row = this.db.prepare(`SELECT ${COLUMNS}, result FROM speech_attempts WHERE user_id = ? AND id = ?`).get(userId, id) as (Row & { result: string | null }) | undefined;
    return row ? { ...attemptFromRow(row), result: row.result } : null;
  }

  async list(userId: string) {
    return (this.db.prepare(`SELECT ${COLUMNS}, (result IS NOT NULL) AS has_result FROM speech_attempts WHERE user_id = ? ORDER BY at, id`).all(userId) as Row[]).map(attemptFromRow);
  }
}
