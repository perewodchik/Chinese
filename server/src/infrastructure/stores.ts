import { describeDatabase, type DatabaseSetting } from '../config';
import type { Stores } from '../composition';

/**
 * The records, from whichever database the settings name.
 *
 * SQLite is a file on this machine and Postgres is the one the deployed site
 * uses; everything above this line is the same either way, which is what makes
 * "run the development server on the real data" a connection string rather
 * than a copy of the data.
 *
 * Each driver is imported only if it is the one being used: a home server
 * never loads `pg`, and a server on Postgres never opens `node:sqlite`.
 */
export interface OpenedStores {
  stores: Stores;
  /** true when nothing else can be holding this database open */
  local: boolean;
  close(): Promise<void>;
}

export async function openStores(database: DatabaseSetting): Promise<OpenedStores> {
  if (database.kind === 'postgres') {
    const [{ closePostgres, openPostgres }, { postgresStores }] = await Promise.all([
      import('./postgres/database'),
      import('./postgres/stores'),
    ]);
    let pool;
    try {
      pool = await openPostgres(database.url);
    } catch (err) {
      // Somebody else's machine, over somebody else's network: unreachable is
      // an ordinary morning rather than a fault in the program, and the way
      // back to working offline is worth saying rather than a stack trace.
      throw new Error(
        `Could not reach ${describeDatabase(database)}: ${err instanceof Error ? err.message : String(err)}\n` +
          '  Check POSTGRES_URL in .env, or work on this machine’s own database with “scripts/dev.sh --local”.',
      );
    }
    return { stores: postgresStores(pool), local: false, close: closePostgres };
  }
  const [{ openDatabase }, { sqliteStores }] = await Promise.all([
    import('./sqlite/database'),
    import('./sqlite/stores'),
  ]);
  const db = openDatabase(database.file);
  return {
    stores: sqliteStores(db),
    local: true,
    close: async () => db.close(),
  };
}
