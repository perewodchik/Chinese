import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { UserRepository } from '../../application/ports';
import type { AccountStatus, User } from '../../domain/entities';
import { parseFlags, roleOf } from '../user-fields';

interface Row {
  id: string;
  username: string;
  username_key: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
  role: string;
  status: string;
  flags: string;
}

const toUser = (r: Row): User => ({
  id: r.id,
  username: r.username,
  usernameKey: r.username_key,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  role: roleOf(r.role),
  status: r.status === 'blocked' ? 'blocked' : 'active',
  flags: parseFlags(r.flags),
});

export class SqliteUserRepository implements UserRepository {
  private readonly byId: StatementSync;
  private readonly byKey: StatementSync;
  private readonly insertOne: StatementSync;
  private readonly setPassword: StatementSync;
  private readonly all: StatementSync;

  constructor(private readonly db: DatabaseSync) {
    this.byId = db.prepare('SELECT * FROM users WHERE id = ?');
    this.byKey = db.prepare('SELECT * FROM users WHERE username_key = ?');
    this.insertOne = db.prepare(
      `INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at, role, status, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (username_key) DO NOTHING`,
    );
    this.setPassword = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    this.all = db.prepare('SELECT * FROM users ORDER BY created_at, id');
  }

  async findById(id: string): Promise<User | null> {
    const row = this.byId.get(id) as Row | undefined;
    return row ? toUser(row) : null;
  }

  async findByUsernameKey(usernameKey: string): Promise<User | null> {
    const row = this.byKey.get(usernameKey) as Row | undefined;
    return row ? toUser(row) : null;
  }

  async insert(u: User): Promise<boolean> {
    const result = this.insertOne.run(u.id, u.username, u.usernameKey, u.passwordHash, u.createdAt, u.updatedAt, u.role, u.status, JSON.stringify(u.flags));
    return Number(result.changes) === 1;
  }

  async updatePassword(id: string, passwordHash: string, at: number): Promise<void> {
    this.setPassword.run(passwordHash, at, id);
  }

  async list(): Promise<User[]> {
    return (this.all.all() as unknown as Row[]).map(toUser);
  }

  async setRole(id: string, role: User['role'], at: number): Promise<void> {
    this.db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, at, id);
  }

  async setStatus(id: string, status: AccountStatus, at: number): Promise<void> {
    this.db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, at, id);
  }

  async countByRole(role: User['role']): Promise<number> {
    return Number((this.db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get(role) as { n: number }).n);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}
