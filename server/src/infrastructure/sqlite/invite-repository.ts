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
  max_uses: number;
  uses: number;
}

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

/** Invitations to make an account, in the one SQLite file. */
export class SqliteInviteRepository implements InviteRepository {
  constructor(private readonly db: DatabaseSync) {}

  async insert(i: Invite): Promise<void> {
    this.db
      .prepare('INSERT INTO invites (digest, note, created_at, expires_at, used_by, used_at, created_by, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(i.digest, i.note, i.createdAt, i.expiresAt, i.usedBy, i.usedAt, i.createdBy ?? null, i.maxUses ?? 1);
  }

  async claim(digest: string, userId: string, now: number): Promise<boolean> {
    // used_by and used_at stay the first account's, as they were before an invitation could have several.
    const done = this.db
      .prepare(
        'UPDATE invites SET uses = uses + 1, used_by = COALESCE(used_by, ?), used_at = COALESCE(used_at, ?) WHERE digest = ? AND uses < max_uses AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)',
      )
      .run(userId, now, digest, now);
    if (Number(done.changes) !== 1) return false;
    this.db.prepare('INSERT OR IGNORE INTO invite_uses (digest, user_id, used_at) VALUES (?, ?, ?)').run(digest, userId, now);
    return true;
  }

  async release(digest: string, userId: string): Promise<void> {
    const gone = this.db.prepare('DELETE FROM invite_uses WHERE digest = ? AND user_id = ?').run(digest, userId);
    if (Number(gone.changes) !== 1) return;
    this.db
      .prepare('UPDATE invites SET uses = uses - 1, used_at = CASE WHEN used_by = ? THEN NULL ELSE used_at END, used_by = CASE WHEN used_by = ? THEN NULL ELSE used_by END WHERE digest = ?')
      .run(userId, userId, digest);
  }

  async list(): Promise<Invite[]> {
    const uses = this.db.prepare('SELECT digest, user_id, used_at FROM invite_uses ORDER BY used_at').all() as unknown as Array<{ digest: string; user_id: string; used_at: number }>;
    const by = new Map<string, Array<{ userId: string; at: number }>>();
    for (const u of uses) by.set(u.digest, [...(by.get(u.digest) ?? []), { userId: u.user_id, at: Number(u.used_at) }]);
    return (this.db.prepare('SELECT * FROM invites ORDER BY created_at').all() as unknown as Row[]).map((r) => toInvite(r, by.get(r.digest) ?? []));
  }

  async revoke(digest: string, at: number): Promise<boolean> {
    const done = this.db.prepare('UPDATE invites SET revoked_at = ? WHERE digest = ? AND uses < max_uses AND revoked_at IS NULL').run(at, digest);
    return Number(done.changes) === 1;
  }
}
