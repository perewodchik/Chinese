import type { DatabaseSync } from 'node:sqlite';
import type { RoomKind, StorageMeter } from '../../application/ports';

/** What an account keeps, in bytes, summed over every table that holds its work, in the one SQLite file. */
export class SqliteStorageMeter implements StorageMeter {
  constructor(private readonly db: DatabaseSync) {}

  async usedBy(userId: string): Promise<number> {
    const row = this.db
      .prepare(
        `SELECT (SELECT COALESCE(SUM(length(CAST(document AS BLOB))), 0) FROM workspaces WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(save AS BLOB))), 0) FROM world_saves WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(turns AS BLOB))), 0) FROM conversations WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(bytes AS BLOB))), 0) FROM pictures WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(mp3 AS BLOB))), 0) FROM text_narrations WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(timings AS BLOB))), 0) FROM text_narrations WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(text AS BLOB))), 0) FROM speech_attempts WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(summary AS BLOB))), 0) FROM speech_attempts WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(result AS BLOB))), 0) FROM speech_attempts WHERE user_id = ?) + (SELECT COALESCE(SUM(length(CAST(lines AS BLOB))), 0) FROM own_texts WHERE user_id = ?) AS used`,
      )
      .get(...Array.from({ length: 10 }, () => userId)) as { used: number };
    return Number(row.used);
  }

  async byKind(userId: string): Promise<Record<RoomKind, number>> {
    const rows = this.db.prepare(`SELECT 'work' AS kind, COALESCE(SUM(length(CAST(document AS BLOB))), 0) AS b FROM workspaces WHERE user_id = ? UNION ALL SELECT 'game' AS kind, COALESCE(SUM(length(CAST(save AS BLOB))), 0) AS b FROM world_saves WHERE user_id = ? UNION ALL SELECT 'conversations' AS kind, COALESCE(SUM(length(CAST(turns AS BLOB))), 0) AS b FROM conversations WHERE user_id = ? UNION ALL SELECT 'pictures' AS kind, COALESCE(SUM(length(CAST(bytes AS BLOB))), 0) AS b FROM pictures WHERE user_id = ? UNION ALL SELECT 'readings' AS kind, COALESCE(SUM(length(CAST(mp3 AS BLOB))), 0) AS b FROM text_narrations WHERE user_id = ? UNION ALL SELECT 'readings' AS kind, COALESCE(SUM(length(CAST(timings AS BLOB))), 0) AS b FROM text_narrations WHERE user_id = ? UNION ALL SELECT 'tries' AS kind, COALESCE(SUM(length(CAST(text AS BLOB))), 0) AS b FROM speech_attempts WHERE user_id = ? UNION ALL SELECT 'tries' AS kind, COALESCE(SUM(length(CAST(summary AS BLOB))), 0) AS b FROM speech_attempts WHERE user_id = ? UNION ALL SELECT 'tries' AS kind, COALESCE(SUM(length(CAST(result AS BLOB))), 0) AS b FROM speech_attempts WHERE user_id = ? UNION ALL SELECT 'readings' AS kind, COALESCE(SUM(length(CAST(lines AS BLOB))), 0) AS b FROM own_texts WHERE user_id = ?`).all(...Array.from({ length: 10 }, () => userId)) as unknown as Array<{ kind: RoomKind; b: number }>;
    return sumKinds(rows);
  }
}

export function sumKinds(rows: Array<{ kind: RoomKind; b: number | string }>): Record<RoomKind, number> {
  const out: Record<RoomKind, number> = { work: 0, pictures: 0, readings: 0, tries: 0, conversations: 0, game: 0 };
  for (const r of rows) out[r.kind] += Number(r.b);
  return out;
}

