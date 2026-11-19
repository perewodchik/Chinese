import type { DatabaseSync } from 'node:sqlite';
import type { AccountDirectory, AccountRow, AccountSort } from '../../application/ports';

const ORDER: Record<AccountSort, string> = {
  seen: 's.seen IS NULL, s.seen DESC, u.created_at DESC',
  joined: 'u.created_at DESC',
  room: 'COALESCE(r.bytes, 0) DESC, u.created_at DESC',
  spent: 'COALESCE(m.scored, 0) + COALESCE(m.chars, 0) DESC, u.created_at DESC',
};

/**
 * The accounts for the admin page (A4, SEC14): signed-in browsers, room kept
 * and this month's spending, gathered per table once rather than asked of
 * each account in turn; searched by name, sorted, a page at a time.
 */
export class SqliteAccountDirectory implements AccountDirectory {
  constructor(private readonly db: DatabaseSync) {}

  async page(o: { q: string; sort: AccountSort; offset: number; limit: number; now: number; monthStart: string }): Promise<{ total: number; rows: AccountRow[] }> {
    const like = `%${o.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const total = this.db.prepare("SELECT COUNT(*) AS n FROM users WHERE username_key LIKE ? ESCAPE '\\'").get(like) as { n: number };
    const rows = this.db
      .prepare(
        `WITH s AS (SELECT user_id, COUNT(*) AS n, MAX(last_seen_at) AS seen FROM sessions WHERE expires_at > ? GROUP BY user_id),
        m AS (SELECT user_id, SUM(CASE WHEN service = 'speechsuper' THEN calls ELSE 0 END) AS scored, SUM(CASE WHEN service = 'minimax' THEN units ELSE 0 END) AS chars FROM api_usage WHERE day >= ? GROUP BY user_id),
        r AS (SELECT user_id, SUM(b) AS bytes FROM (
        SELECT user_id, length(CAST(document AS BLOB)) AS b FROM workspaces
        UNION ALL SELECT user_id, length(CAST(save AS BLOB)) AS b FROM world_saves
        UNION ALL SELECT user_id, length(CAST(turns AS BLOB)) AS b FROM conversations
        UNION ALL SELECT user_id, length(CAST(bytes AS BLOB)) AS b FROM pictures
        UNION ALL SELECT user_id, length(CAST(mp3 AS BLOB)) AS b FROM text_narrations
        UNION ALL SELECT user_id, length(CAST(timings AS BLOB)) AS b FROM text_narrations
        UNION ALL SELECT user_id, length(CAST(text AS BLOB)) AS b FROM speech_attempts
        UNION ALL SELECT user_id, length(CAST(summary AS BLOB)) AS b FROM speech_attempts
        UNION ALL SELECT user_id, length(CAST(result AS BLOB)) AS b FROM speech_attempts
        UNION ALL SELECT user_id, length(CAST(lines AS BLOB)) AS b FROM own_texts
        ) GROUP BY user_id)
        SELECT u.id, u.username, u.role, u.status, u.created_at, s.n, s.seen, r.bytes, m.scored, m.chars
        FROM users u LEFT JOIN s ON s.user_id = u.id LEFT JOIN m ON m.user_id = u.id LEFT JOIN r ON r.user_id = u.id
        WHERE u.username_key LIKE ? ESCAPE '\\'
        ORDER BY ${ORDER[o.sort]} LIMIT ? OFFSET ?`,
      )
      .all(o.now, o.monthStart, like, o.limit, o.offset) as unknown as Row[];
    return { total: Number(total.n), rows: rows.map(toRow) };
  }
}

interface Row {
  id: string;
  username: string;
  role: string;
  status: string;
  created_at: number | string;
  n: number | string | null;
  seen: number | string | null;
  bytes: number | string | null;
  scored: number | string | null;
  chars: number | string | null;
}

export const toRow = (r: Row): AccountRow => ({
  id: r.id,
  username: r.username,
  role: r.role === 'admin' ? 'admin' : 'learner',
  status: r.status === 'blocked' ? 'blocked' : 'active',
  createdAt: Number(r.created_at),
  lastSeenAt: r.seen === null ? null : Number(r.seen),
  devices: Number(r.n ?? 0),
  storageBytes: Number(r.bytes ?? 0),
  scoredThisMonth: Number(r.scored ?? 0),
  charactersReadThisMonth: Number(r.chars ?? 0),
});
