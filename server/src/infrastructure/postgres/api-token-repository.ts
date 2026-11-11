import type pg from 'pg';
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

/** The same tokens, in Postgres. */
export class PostgresApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: pg.Pool) {}

  async insert(t: ApiToken): Promise<void> {
    await this.db.query(
      `INSERT INTO api_tokens (id, user_id, name, digest, scopes, created_at, last_used_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [t.id, t.userId, t.name, t.digest, t.scopes.join(' '), t.createdAt, t.lastUsedAt, t.expiresAt, t.revokedAt],
    );
  }

  async findByDigest(digest: string): Promise<ApiToken | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM api_tokens WHERE digest = $1', [digest]);
    return rows[0] ? toToken(rows[0]) : null;
  }

  async listForUser(userId: string): Promise<ApiToken[]> {
    const { rows } = await this.db.query<Row>('SELECT * FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC', [userId]);
    return rows.map(toToken);
  }

  async revoke(userId: string, id: string, at: number): Promise<boolean> {
    const done = await this.db.query('UPDATE api_tokens SET revoked_at = $1 WHERE user_id = $2 AND id = $3 AND revoked_at IS NULL', [at, userId, id]);
    return (done.rowCount ?? 0) === 1;
  }

  async revokeForUser(userId: string, at: number): Promise<number> {
    const done = await this.db.query('UPDATE api_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [at, userId]);
    return done.rowCount ?? 0;
  }

  async touch(id: string, at: number): Promise<void> {
    await this.db.query('UPDATE api_tokens SET last_used_at = $1 WHERE id = $2', [at, id]);
  }
}
