import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { WorkspaceRepository, WorkspaceWrite } from '../../application/ports';
import type { Workspace } from '../../domain/entities';

interface Row {
  user_id: string;
  revision: number;
  document: string;
  updated_at: number;
}

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  private readonly byUser: StatementSync;
  private readonly revisionByUser: StatementSync;
  private readonly insertFirst: StatementSync;
  private readonly replaceAt: StatementSync;

  constructor(db: DatabaseSync) {
    this.byUser = db.prepare('SELECT * FROM workspaces WHERE user_id = ?');
    this.revisionByUser = db.prepare('SELECT revision FROM workspaces WHERE user_id = ?');
    this.insertFirst = db.prepare(
      `INSERT INTO workspaces (user_id, revision, document, updated_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT (user_id) DO NOTHING`,
    );
    // The revision in the WHERE clause is the whole concurrency story: of two
    // saves built on the same revision, exactly one matches a row.
    this.replaceAt = db.prepare(
      `UPDATE workspaces
       SET document = ?, updated_at = ?, revision = revision + 1
       WHERE user_id = ? AND revision = ?`,
    );
  }

  async find(userId: string): Promise<Workspace | null> {
    const row = this.byUser.get(userId) as Row | undefined;
    if (!row) return null;
    return {
      userId: row.user_id,
      revision: row.revision,
      document: JSON.parse(row.document) as unknown,
      updatedAt: row.updated_at,
    };
  }

  async revisionOf(userId: string): Promise<number> {
    const row = this.revisionByUser.get(userId) as { revision: number } | undefined;
    return row?.revision ?? 0;
  }

  async save(userId: string, baseRevision: number, document: unknown, at: number): Promise<WorkspaceWrite> {
    const json = JSON.stringify(document);
    const result =
      baseRevision === 0
        ? this.insertFirst.run(userId, json, at)
        : this.replaceAt.run(json, at, userId, baseRevision);
    if (Number(result.changes) === 1) {
      return { saved: true, revision: baseRevision + 1, updatedAt: at };
    }
    return { saved: false, current: await this.find(userId) };
  }
}
