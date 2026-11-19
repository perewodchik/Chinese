import type pg from 'pg';
import type { AccountDirectory, AccountRow, AccountSort } from '../../application/ports';
import { toRow } from '../sqlite/account-directory';

const ORDER: Record<AccountSort, string> = {
  seen: 's.seen IS NULL, s.seen DESC, u.created_at DESC',
  joined: 'u.created_at DESC',
  room: 'COALESCE(r.bytes, 0) DESC, u.created_at DESC',
  spent: 'COALESCE(m.scored, 0) + COALESCE(m.chars, 0) DESC, u.created_at DESC',
};

/** The accounts for the admin page (A4, SEC14), in one query, in Postgres. */
export class PostgresAccountDirectory implements AccountDirectory {
  constructor(private readonly db: pg.Pool) {}

  async page(o: { q: string; sort: AccountSort; offset: number; limit: number; now: number; monthStart: string }): Promise<{ total: number; rows: AccountRow[] }> {
    const like = `%${o.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const total = await this.db.query<{ n: string }>("SELECT COUNT(*) AS n FROM users WHERE username_key LIKE $1", [like]);
    const { rows } = await this.db.query(
      `WITH s AS (SELECT user_id, COUNT(*) AS n, MAX(last_seen_at) AS seen FROM sessions WHERE expires_at > $1 GROUP BY user_id),
      m AS (SELECT user_id, SUM(CASE WHEN service = 'speechsuper' THEN calls ELSE 0 END) AS scored, SUM(CASE WHEN service = 'minimax' THEN units ELSE 0 END) AS chars FROM api_usage WHERE day >= $2 GROUP BY user_id),
      r AS (SELECT user_id, SUM(b) AS bytes FROM (
      SELECT user_id, octet_length(document) AS b FROM workspaces
        UNION ALL SELECT user_id, octet_length(save) AS b FROM world_saves
        UNION ALL SELECT user_id, octet_length(turns) AS b FROM conversations
        UNION ALL SELECT user_id, octet_length(bytes) AS b FROM pictures
        UNION ALL SELECT user_id, octet_length(mp3) AS b FROM text_narrations
        UNION ALL SELECT user_id, octet_length(timings) AS b FROM text_narrations
        UNION ALL SELECT user_id, octet_length(text) AS b FROM speech_attempts
        UNION ALL SELECT user_id, octet_length(summary) AS b FROM speech_attempts
        UNION ALL SELECT user_id, octet_length(result) AS b FROM speech_attempts
        UNION ALL SELECT user_id, octet_length(lines) AS b FROM own_texts
      ) parts GROUP BY user_id)
      SELECT u.id, u.username, u.role, u.status, u.created_at, s.n, s.seen, r.bytes, m.scored, m.chars
      FROM users u LEFT JOIN s ON s.user_id = u.id LEFT JOIN m ON m.user_id = u.id LEFT JOIN r ON r.user_id = u.id
      WHERE u.username_key LIKE $3
      ORDER BY ${ORDER[o.sort]} LIMIT $4 OFFSET $5`,
      [o.now, o.monthStart, like, o.limit, o.offset],
    );
    return { total: Number(total.rows[0]!.n), rows: rows.map(toRow) };
  }
}
