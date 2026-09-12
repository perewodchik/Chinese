import type pg from 'pg';
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

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: pg.Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByUsernameKey(usernameKey: string): Promise<User | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM users WHERE username_key = $1', [
      usernameKey,
    ]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async insert(u: User): Promise<boolean> {
    const result = await this.db.query(
      `INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username_key) DO NOTHING`,
      [u.id, u.username, u.usernameKey, u.passwordHash, u.createdAt, u.updatedAt],
    );
    return result.rowCount === 1;
  }

  async updatePassword(id: string, passwordHash: string, at: number): Promise<void> {
    await this.db.query('UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3', [
      passwordHash,
      at,
      id,
    ]);
  }

  async list(): Promise<User[]> {
    const { rows } = await this.db.query<Row>('SELECT * FROM users ORDER BY created_at, id');
    return rows.map(toUser);
  }
}
