import type pg from 'pg';
import type { WorkspaceRepository, WorkspaceWrite } from '../../application/ports';
import type { Workspace } from '../../domain/entities';

interface Row {
  user_id: string;
  revision: number;
  document: string;
  updated_at: number;
}

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: pg.Pool) {}

  async find(userId: string): Promise<Workspace | null> {
    const { rows } = await this.db.query<Row>('SELECT * FROM workspaces WHERE user_id = $1', [
      userId,
    ]);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      revision: row.revision,
      document: JSON.parse(row.document) as unknown,
      updatedAt: row.updated_at,
    };
  }

  async revisionOf(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ revision: number }>(
      'SELECT revision FROM workspaces WHERE user_id = $1',
      [userId],
    );
    return rows[0]?.revision ?? 0;
  }

  async save(
    userId: string,
    baseRevision: number,
    document: unknown,
    at: number,
  ): Promise<WorkspaceWrite> {
    const json = JSON.stringify(document);
    // The revision in the WHERE clause is the whole concurrency story: of two
    // saves built on the same revision, exactly one matches a row. The version
    // keeps a build that predates the stored document from writing over it.
    const result =
      baseRevision === 0
        ? await this.db.query(
            `INSERT INTO workspaces (user_id, revision, document, updated_at)
             VALUES ($1, 1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, json, at],
          )
        : await this.db.query(
            `UPDATE workspaces
             SET document = $1, updated_at = $2, revision = revision + 1
             WHERE user_id = $3 AND revision = $4
               AND COALESCE((document::jsonb ->> 'version')::int, 0) <= $5`,
            [json, at, userId, baseRevision, (document as { version: number }).version],
          );
    if (result.rowCount === 1) {
      return { saved: true, revision: baseRevision + 1, updatedAt: at };
    }
    return { saved: false, current: await this.find(userId) };
  }
}
