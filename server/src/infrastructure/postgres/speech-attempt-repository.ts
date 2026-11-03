import type pg from 'pg';
import type { SpeechAttempt, SpeechAttemptRepository } from '../../application/ports';
import { attemptFromRow } from '../sqlite/speech-attempt-repository';

const COLUMNS = 'id, user_id, at, kind, source_id, text, tally, good, summary';

/** Things said aloud and scored, in Postgres. */
export class PostgresSpeechAttemptRepository implements SpeechAttemptRepository {
  constructor(private readonly db: pg.Pool) {}

  async add(items: SpeechAttempt[]) {
    for (const a of items) {
      await this.db.query(
        `INSERT INTO speech_attempts (${COLUMNS}, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.userId, a.at, a.kind, a.sourceId, a.text, a.tally, a.good, a.summary, a.result],
      );
    }
  }

  async find(userId: string, id: string) {
    const { rows } = await this.db.query(`SELECT ${COLUMNS}, result FROM speech_attempts WHERE user_id = $1 AND id = $2`, [userId, id]);
    return rows[0] ? { ...attemptFromRow(rows[0]), result: rows[0].result as string | null } : null;
  }

  async list(userId: string) {
    const { rows } = await this.db.query(`SELECT ${COLUMNS}, (result IS NOT NULL) AS has_result FROM speech_attempts WHERE user_id = $1 ORDER BY at, id`, [userId]);
    return rows.map(attemptFromRow);
  }
}
