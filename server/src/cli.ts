import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createServices, type Services } from './composition';
import { loadConfig } from './config';
import { backupDatabase, openDatabase } from './infrastructure/sqlite/database';
import { sqliteStores } from './infrastructure/sqlite/stores';
import { banner } from './lan';

/**
 * Looking after the server from the machine it runs on.
 *
 *   npm run admin -- users
 *   npm run admin -- add-user <name>
 *   npm run admin -- reset-password <name>
 *   npm run admin -- backup [file]
 *   npm run admin -- address [port]
 *
 * There is no "forgot my password" email: the server has no way to send one,
 * and whoever can run this can already read the database file.
 */

const USAGE = `
  npm run admin -- users                   list the accounts
  npm run admin -- add-user <name>         make an account, even with sign-ups switched off
  npm run admin -- reset-password <name>   give an account a new password and sign it out everywhere
  npm run admin -- backup [file]           copy the database, safely, even while the server runs
  npm run admin -- address [port]          print the address a tablet should open
`;

const [command, ...args] = process.argv.slice(2);
const config = loadConfig(process.env, { port: 4173, serveStatic: false });

async function withServices<T>(run: (services: Services, db: DatabaseSync) => Promise<T>): Promise<T> {
  const db = openDatabase(config.databaseFile);
  try {
    return await run(createServices(sqliteStores(db)), db);
  } finally {
    db.close();
  }
}

/** Sixteen characters for someone to type once, and then change in Settings. */
const temporaryPassword = () => randomBytes(12).toString('base64url');

try {
  switch (command) {
    case 'users': {
      const users = await withServices(({ auth }) => auth.listUsers());
      if (!users.length) console.log('\n  No accounts yet.\n');
      for (const u of users) {
        console.log(`  ${u.username.padEnd(34)} since ${new Date(u.createdAt).toLocaleDateString()}`);
      }
      break;
    }

    case 'add-user': {
      const name = args[0];
      if (!name) throw new Error(`What should the account be called?\n${USAGE}`);
      const password = temporaryPassword();
      const user = await withServices(({ auth }) => auth.addUser(name, password));
      console.log(`\n  Made ${user.username}. The password, to change in Settings:  ${password}\n`);
      break;
    }

    case 'reset-password': {
      const name = args[0];
      if (!name) throw new Error(`Which account?\n${USAGE}`);
      const password = temporaryPassword();
      const user = await withServices(({ auth }) => auth.resetPassword(name, password));
      console.log(`\n  New password for ${user.username}:  ${password}`);
      console.log('  Every browser signed in to that account has been signed out.\n');
      break;
    }

    case 'backup': {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const target = resolve(args[0] ?? `.data/backups/hanzi-workshop-${stamp}.db`);
      await withServices(async (_services, db) => backupDatabase(db, target));
      console.log(`\n  Backed up to ${target}\n`);
      break;
    }

    case 'address':
      console.log(banner(Number(args[0] ?? config.port), '0.0.0.0'));
      break;

    default:
      console.log(USAGE);
      if (command) process.exitCode = 1;
  }
} catch (err) {
  console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
