import { PGlite } from '@electric-sql/pglite';
import type pg from 'pg';
import { applyMigrations } from '../src/infrastructure/postgres/database';

/**
 * A real Postgres to test against, compiled to WebAssembly and run in this
 * process. Not a fake: it is Postgres, so the dialect, the constraints and the
 * advisory lock behave as they will on the server.
 *
 * `pg` and PGlite differ in two ways that this smooths over — the count of
 * changed rows is `rowCount` in one and `affectedRows` in the other, and a
 * statement sent without parameters may hold several statements, which `pg`
 * allows over the simple query protocol and PGlite exposes as `exec`.
 */
export async function makePostgres(): Promise<{ pool: pg.Pool; close: () => Promise<void> }> {
  const db = await PGlite.create();

  const query = async (text: string, values?: unknown[]) => {
    if (values?.length) {
      const r = await db.query(text, values as unknown[]);
      return { rows: r.rows as unknown[], rowCount: r.affectedRows ?? r.rows.length };
    }
    const results = await db.exec(text);
    const last = results[results.length - 1];
    return { rows: (last?.rows ?? []) as unknown[], rowCount: last?.affectedRows ?? 0 };
  };

  await applyMigrations({ query });

  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
    on: () => undefined,
  };
  return { pool: pool as unknown as pg.Pool, close: () => db.close() };
}
