import { postgresStores } from '../src/infrastructure/postgres/stores';
import { makePostgres } from './pglite';
import { storageContract } from './storage-contract';

// The storage's contract against a real Postgres, compiled to WebAssembly: the code that runs on Vercel and nowhere else.
storageContract('Postgres storage', async () => {
  const { pool, close } = await makePostgres();
  return {
    stores: postgresStores(pool),
    close,
    sessionsOf: async (userId) => {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1', [userId]);
      return (rows[0] as { n: number }).n;
    },
  };
});
