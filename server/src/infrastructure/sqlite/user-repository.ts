import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { UserRepository } from '../../application/ports';
import type { User } from '../../domain/entities';

interface Row {
  id: string;
  username: string;
  username_key: string;
  password_hash: string;
  created_at: number;
  updated_at: number;
}

const toUser = (r: Row): User => ({
  id: r.id,
  username: r.username,
  usernameKey: r.username_key,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class SqliteUserRepository implements UserRepository {
  private readonly byId: StatementSync;
  private readonly byKey: StatementSync;
  private readonly insertOne: StatementSync;
  private readonly setPassword: StatementSync;
  private readonly all: StatementSync;

  constructor(db: DatabaseSync) {
    this.byId = db.prepare('SELECT * FROM users WHERE id = ?');
    this.byKey = db.prepare('SELECT * FROM users WHERE username_key = ?');
    this.insertOne = db.prepare(
      `INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (username_key) DO NOTHING`,
    );
    this.setPassword = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    this.all = db.prepare('SELECT * FROM users ORDER BY created_at');
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
    const result = this.insertOne.run(u.id, u.username, u.usernameKey, u.passwordHash, u.createdAt, u.updatedAt);
    return Number(result.changes) === 1;
  }

  async updatePassword(id: string, passwordHash: string, at: number): Promise<void> {
    this.setPassword.run(passwordHash, at, id);
  }

  async list(): Promise<User[]> {
    return (this.all.all() as unknown as Row[]).map(toUser);
  }
}
