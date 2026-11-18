import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { storageContract } from './storage-contract';

// The same contract against the SQLite file a server on this machine keeps (in memory here).
storageContract('SQLite storage', async () => {
  const db = openDatabase(':memory:');
  return {
    stores: sqliteStores(db),
    close: async () => db.close(),
    sessionsOf: async (userId) => (db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(userId) as { n: number }).n,
  };
});
