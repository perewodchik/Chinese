import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { SessionRepository } from '../../application/ports';
import type { Session } from '../../domain/entities';

interface Row {
  id: string;
  user_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  user_agent: string | null;
}

const toSession = (r: Row): Session => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  expiresAt: r.expires_at,
  userAgent: r.user_agent,
});

export class SqliteSessionRepository implements SessionRepository {
  private readonly insertOne: StatementSync;
  private readonly byId: StatementSync;
  private readonly touchOne: StatementSync;
  private readonly deleteOne: StatementSync;
  private readonly deleteUser: StatementSync;
  private readonly deleteUserExcept: StatementSync;
  private readonly deleteOld: StatementSync;

  constructor(db: DatabaseSync) {
    this.insertOne = db.prepare(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    this.byId = db.prepare('SELECT * FROM sessions WHERE id = ?');
    this.touchOne = db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?');
    this.deleteOne = db.prepare('DELETE FROM sessions WHERE id = ?');
    this.deleteUser = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    this.deleteUserExcept = db.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?');
    this.deleteOld = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  }

  async insert(s: Session): Promise<void> {
    this.insertOne.run(s.id, s.userId, s.createdAt, s.lastSeenAt, s.expiresAt, s.userAgent);
  }

  async findById(id: string): Promise<Session | null> {
    const row = this.byId.get(id) as Row | undefined;
    return row ? toSession(row) : null;
  }

  async touch(id: string, lastSeenAt: number, expiresAt: number): Promise<void> {
    this.touchOne.run(lastSeenAt, expiresAt, id);
  }

  async delete(id: string): Promise<void> {
    this.deleteOne.run(id);
  }

  async deleteForUser(userId: string, keepId?: string): Promise<number> {
    const result = keepId ? this.deleteUserExcept.run(userId, keepId) : this.deleteUser.run(userId);
    return Number(result.changes);
  }

  async deleteExpired(now: number): Promise<number> {
    return Number(this.deleteOld.run(now).changes);
  }
}
