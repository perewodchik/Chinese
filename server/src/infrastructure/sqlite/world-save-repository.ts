import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { WorldSaveRepository, WorldSaveWrite } from '../../application/ports';
import type { WorldSaveRecord } from '../../domain/entities';

interface Row {
  user_id: string;
  revision: number;
  save: string;
  updated_at: number;
}

/** 走走's saves; the same compare-and-swap as the workspace's (workspace-repository.ts). */
export class SqliteWorldSaveRepository implements WorldSaveRepository {
  private readonly byUser: StatementSync;
  private readonly revisionByUser: StatementSync;
  private readonly insertFirst: StatementSync;
  private readonly replaceAt: StatementSync;

  constructor(db: DatabaseSync) {
    this.byUser = db.prepare('SELECT * FROM world_saves WHERE user_id = ?');
    this.revisionByUser = db.prepare('SELECT revision FROM world_saves WHERE user_id = ?');
    this.insertFirst = db.prepare(
      `INSERT INTO world_saves (user_id, revision, save, updated_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT (user_id) DO NOTHING`,
    );
    this.replaceAt = db.prepare(
      `UPDATE world_saves
       SET save = ?, updated_at = ?, revision = revision + 1
       WHERE user_id = ? AND revision = ?
         AND COALESCE(json_extract(save, '$.version'), 0) <= ?`,
    );
  }

  async find(userId: string): Promise<WorldSaveRecord | null> {
    const row = this.byUser.get(userId) as Row | undefined;
    if (!row) return null;
    return { userId: row.user_id, revision: row.revision, save: JSON.parse(row.save) as unknown, updatedAt: row.updated_at };
  }

  async revisionOf(userId: string): Promise<number> {
    const row = this.revisionByUser.get(userId) as { revision: number } | undefined;
    return row?.revision ?? 0;
  }

  async save(userId: string, baseRevision: number, save: unknown, at: number): Promise<WorldSaveWrite> {
    const json = JSON.stringify(save);
    const result =
      baseRevision === 0
        ? this.insertFirst.run(userId, json, at)
        : this.replaceAt.run(json, at, userId, baseRevision, (save as { version: number }).version);
    if (Number(result.changes) === 1) return { saved: true, revision: baseRevision + 1, updatedAt: at };
    return { saved: false, current: await this.find(userId) };
  }
}
