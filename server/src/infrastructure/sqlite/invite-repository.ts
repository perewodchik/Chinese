import type { DatabaseSync } from 'node:sqlite';
import type { Invite, InviteRepository } from '../../application/ports';

interface Row {
  digest: string;
  note: string;
  created_at: number;
  expires_at: number | null;
  used_by: string | null;
  used_at: number | null;
  revoked_at: number | null;
  created_by: string | null;
}

const toInvite = (r: Row): Invite => ({
  digest: r.digest,
  note: r.note,
  createdAt: Number(r.created_at),
  expiresAt: r.expires_at === null ? null : Number(r.expires_at),
  usedBy: r.used_by,
  usedAt: r.used_at === null ? null : Number(r.used_at),
  revokedAt: r.revoked_at === null || r.revoked_at === undefined ? null : Number(r.revoked_at),
  createdBy: r.created_by ?? null,
});

/** Invitations to make an account, in the one SQLite file. */
export class SqliteInviteRepository implements InviteRepository {
  constructor(private readonly db: DatabaseSync) {}

  async insert(i: Invite): Promise<void> {
    this.db
      .prepare('INSERT INTO invites (digest, note, created_at, expires_at, used_by, used_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(i.digest, i.note, i.createdAt, i.expiresAt, i.usedBy, i.usedAt, i.createdBy ?? null);
  }

  async claim(digest: string, userId: string, now: number): Promise<boolean> {
    const done = this.db
      .prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE digest = ? AND used_by IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)')
      .run(userId, now, digest, now);
    return Number(done.changes) === 1;
  }

  async release(digest: string, userId: string): Promise<void> {
    this.db.prepare('UPDATE invites SET used_by = NULL, used_at = NULL WHERE digest = ? AND used_by = ?').run(digest, userId);
  }

  async list(): Promise<Invite[]> {
    return (this.db.prepare('SELECT * FROM invites ORDER BY created_at').all() as unknown as Row[]).map(toInvite);
  }

  async revoke(digest: string, at: number): Promise<boolean> {
    const done = this.db.prepare('UPDATE invites SET revoked_at = ? WHERE digest = ? AND used_by IS NULL AND revoked_at IS NULL').run(at, digest);
    return Number(done.changes) === 1;
  }
}
