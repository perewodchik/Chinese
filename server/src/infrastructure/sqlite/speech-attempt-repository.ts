import type { DatabaseSync } from 'node:sqlite';
import type { SpeechAttempt, SpeechAttemptRepository } from '../../application/ports';

type Row = { id: string; user_id: string; at: number; kind: string; source_id: string | null; text: string; tally: string | null; good: number | boolean; summary: string | null };

export const attemptFromRow = (r: Row): Omit<SpeechAttempt, 'result'> => ({
  id: r.id,
  userId: r.user_id,
  at: Number(r.at),
  kind: r.kind === 'drill' ? 'drill' : 'phrase',
  sourceId: r.source_id,
  text: r.text,
  tally: r.tally,
  good: Boolean(r.good),
  summary: r.summary,
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

  async list(userId: string) {
    return (this.db.prepare(`SELECT ${COLUMNS} FROM speech_attempts WHERE user_id = ? ORDER BY at, id`).all(userId) as Row[]).map(attemptFromRow);
  }
}
