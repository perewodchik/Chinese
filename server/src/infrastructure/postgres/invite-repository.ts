import type pg from 'pg';
import type { Invite, InviteRepository } from '../../application/ports';

interface Row {
  digest: string;
  note: string;
  created_at: string;
  expires_at: string | null;
  used_by: string | null;
  used_at: string | null;
}

// BIGINT comes back from pg as a string.
const toInvite = (r: Row): Invite => ({
  digest: r.digest,
  note: r.note,
  createdAt: Number(r.created_at),
  expiresAt: r.expires_at === null ? null : Number(r.expires_at),
  usedBy: r.used_by,
  usedAt: r.used_at === null ? null : Number(r.used_at),
});

/** Invitations to make an account, in Postgres. */
export class PostgresInviteRepository implements InviteRepository {
  constructor(private readonly db: pg.Pool) {}

  async insert(i: Invite): Promise<void> {
    await this.db.query('INSERT INTO invites (digest, note, created_at, expires_at, used_by, used_at) VALUES ($1, $2, $3, $4, $5, $6)', [
      i.digest,
      i.note,
      i.createdAt,
      i.expiresAt,
      i.usedBy,
      i.usedAt,
    ]);
  }

  async claim(digest: string, userId: string, now: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      'UPDATE invites SET used_by = $1, used_at = $2 WHERE digest = $3 AND used_by IS NULL AND (expires_at IS NULL OR expires_at > $2)',
      [userId, now, digest],
    );
    return rowCount === 1;
  }

  async release(digest: string, userId: string): Promise<void> {
    await this.db.query('UPDATE invites SET used_by = NULL, used_at = NULL WHERE digest = $1 AND used_by = $2', [digest, userId]);
  }

  async list(): Promise<Invite[]> {
    const { rows } = await this.db.query<Row>('SELECT * FROM invites ORDER BY created_at');
    return rows.map(toInvite);
  }
}
