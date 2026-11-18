import type pg from 'pg';
import type { Invite, InviteRepository } from '../../application/ports';

interface Row {
  digest: string;
  note: string;
  created_at: string;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  max_uses: number;
  uses: number;
}

// BIGINT comes back from pg as a string.
const toInvite = (r: Row, usedByAll: Invite['usedByAll'] = []): Invite => ({
  digest: r.digest,
  note: r.note,
  createdAt: Number(r.created_at),
  expiresAt: r.expires_at === null ? null : Number(r.expires_at),
  usedBy: r.used_by,
  usedAt: r.used_at === null ? null : Number(r.used_at),
  revokedAt: r.revoked_at === null || r.revoked_at === undefined ? null : Number(r.revoked_at),
  createdBy: r.created_by ?? null,
  maxUses: Number(r.max_uses ?? 1),
  uses: Number(r.uses ?? 0),
  usedByAll,
});

/** Invitations to make an account, in Postgres. */
export class PostgresInviteRepository implements InviteRepository {
  constructor(private readonly db: pg.Pool) {}

  async insert(i: Invite): Promise<void> {
    await this.db.query('INSERT INTO invites (digest, note, created_at, expires_at, used_by, used_at, created_by, max_uses) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
      i.digest,
      i.note,
      i.createdAt,
      i.expiresAt,
      i.usedBy,
      i.usedAt,
      i.createdBy ?? null,
      i.maxUses ?? 1,
    ]);
  }

  async claim(digest: string, userId: string, now: number): Promise<boolean> {
    // used_by and used_at stay the first account's, as they were before an invitation could have several.
    const { rowCount } = await this.db.query(
      'UPDATE invites SET uses = uses + 1, used_by = COALESCE(used_by, $1), used_at = COALESCE(used_at, $2) WHERE digest = $3 AND uses < max_uses AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > $2)',
      [userId, now, digest],
    );
    if (rowCount !== 1) return false;
    await this.db.query('INSERT INTO invite_uses (digest, user_id, used_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [digest, userId, now]);
    return true;
  }

  async release(digest: string, userId: string): Promise<void> {
    const gone = await this.db.query('DELETE FROM invite_uses WHERE digest = $1 AND user_id = $2', [digest, userId]);
    if (gone.rowCount !== 1) return;
    await this.db.query(
      'UPDATE invites SET uses = uses - 1, used_at = CASE WHEN used_by = $1 THEN NULL ELSE used_at END, used_by = CASE WHEN used_by = $1 THEN NULL ELSE used_by END WHERE digest = $2',
      [userId, digest],
    );
  }

  async list(): Promise<Invite[]> {
    const [{ rows }, uses] = await Promise.all([
      this.db.query<Row>('SELECT * FROM invites ORDER BY created_at'),
      this.db.query<{ digest: string; user_id: string; used_at: string }>('SELECT digest, user_id, used_at FROM invite_uses ORDER BY used_at'),
    ]);
    const by = new Map<string, Array<{ userId: string; at: number }>>();
    for (const u of uses.rows) by.set(u.digest, [...(by.get(u.digest) ?? []), { userId: u.user_id, at: Number(u.used_at) }]);
    return rows.map((r) => toInvite(r, by.get(r.digest) ?? []));
  }

  async revoke(digest: string, at: number): Promise<boolean> {
    const { rowCount } = await this.db.query('UPDATE invites SET revoked_at = $1 WHERE digest = $2 AND uses < max_uses AND revoked_at IS NULL', [at, digest]);
    return rowCount === 1;
  }
}
