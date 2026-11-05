import type pg from 'pg';
import type { StorageMeter } from '../../application/ports';

/** What an account keeps, in bytes, summed over every table that holds its work, in Postgres. */
export class PostgresStorageMeter implements StorageMeter {
  constructor(private readonly db: pg.Pool) {}

  async usedBy(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ used: string }>(
      `SELECT (SELECT COALESCE(SUM(octet_length(document)), 0) FROM workspaces WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(save)), 0) FROM world_saves WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(turns)), 0) FROM conversations WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(bytes)), 0) FROM pictures WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(mp3)), 0) FROM text_narrations WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(timings)), 0) FROM text_narrations WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(text)), 0) FROM speech_attempts WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(summary)), 0) FROM speech_attempts WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(result)), 0) FROM speech_attempts WHERE user_id = $1) + (SELECT COALESCE(SUM(octet_length(lines)), 0) FROM own_texts WHERE user_id = $1) AS used`,
      [userId],
    );
    return Number(rows[0]!.used);
  }
}
