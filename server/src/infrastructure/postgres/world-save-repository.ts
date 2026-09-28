import type pg from 'pg';
import type { WorldSaveRepository, WorldSaveWrite } from '../../application/ports';
import type { WorldSaveRecord } from '../../domain/entities';

interface Row {
  user_id: string;
  revision: number;
  save: string;
  updated_at: number;
}

/** 走走's saves in Postgres; the same compare-and-swap as the workspace's. */
export class PostgresWorldSaveRepository implements WorldSaveRepository {
  constructor(private readonly db: pg.Pool) {}

  async find(userId: string): Promise<WorldSaveRecord | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM world_saves WHERE user_id = $1', [userId]);
    const row = rows[0];
    if (!row) return null;
    return { userId: row.user_id, revision: row.revision, save: JSON.parse(row.save) as unknown, updatedAt: row.updated_at };
  }

  async revisionOf(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ revision: number }>('SELECT revision FROM world_saves WHERE user_id = $1', [userId]);
    return rows[0]?.revision ?? 0;
  }

  async save(userId: string, baseRevision: number, save: unknown, at: number): Promise<WorldSaveWrite> {
    const json = JSON.stringify(save);
    const result =
      baseRevision === 0
        ? await this.db.query(
            `INSERT INTO world_saves (user_id, revision, save, updated_at)
             VALUES ($1, 1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, json, at],
          )
        : await this.db.query(
            `UPDATE world_saves
             SET save = $1, updated_at = $2, revision = revision + 1
             WHERE user_id = $3 AND revision = $4
               AND COALESCE((save::jsonb ->> 'version')::int, 0) <= $5`,
            [json, at, userId, baseRevision, (save as { version: number }).version],
          );
    if (result.rowCount === 1) return { saved: true, revision: baseRevision + 1, updatedAt: at };
    return { saved: false, current: await this.find(userId) };
  }
}
