import type { DatabaseSync } from 'node:sqlite';
import type { ApiTokenRepository } from '../../application/ports';
import type { ApiToken } from '../../domain/entities';

interface Row {
  id: string;
  user_id: string;
  name: string;
  digest: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number;
  revoked_at: number | null;
}

const toToken = (r: Row): ApiToken => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  digest: r.digest,
  scopes: r.scopes ? r.scopes.split(' ') : [],
  createdAt: Number(r.created_at),
  lastUsedAt: r.last_used_at === null ? null : Number(r.last_used_at),
  expiresAt: Number(r.expires_at),
  revokedAt: r.revoked_at === null ? null : Number(r.revoked_at),
});

/** Access tokens, as digests, in the one SQLite file. */
export class SqliteApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: DatabaseSync) {}

  async insert(t: ApiToken): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO api_tokens (id, user_id, name, digest, scopes, created_at, last_used_at, expires_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(t.id, t.userId, t.name, t.digest, t.scopes.join(' '), t.createdAt, t.lastUsedAt, t.expiresAt, t.revokedAt);
  }

  async findByDigest(digest: string): Promise<ApiToken | null> {
    const row = this.db.prepare('SELECT * FROM api_tokens WHERE digest = ?').get(digest) as Row | undefined;
    return row ? toToken(row) : null;
  }

  async listForUser(userId: string): Promise<ApiToken[]> {
    const rows = this.db.prepare('SELECT * FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC').all(userId) as unknown as Row[];
    return rows.map(toToken);
  }

  async revoke(userId: string, id: string, at: number): Promise<boolean> {
    const done = this.db.prepare('UPDATE api_tokens SET revoked_at = ? WHERE user_id = ? AND id = ? AND revoked_at IS NULL').run(at, userId, id);
    return Number(done.changes) === 1;
  }

  async revokeForUser(userId: string, at: number): Promise<number> {
    return Number(this.db.prepare('UPDATE api_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(at, userId).changes);
  }

  async touch(id: string, at: number): Promise<void> {
    this.db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?').run(at, id);
  }
}
