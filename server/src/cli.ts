import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createServices, type Services } from './composition';
import { describeDatabase, loadConfig, loadEnvFile } from './config';
import { openStores } from './infrastructure/stores';
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
 *
 * These run against whichever database the settings name, so with
 * `POSTGRES_URL` in `.env` they are the deployed site's accounts rather than
 * this machine's — which is the only way to give the account on the site a
 * new password. `backup` is the exception: a Postgres is not a file to copy,
 * and its host takes backups of its own.
 */

const USAGE = `
  npm run admin -- users                   list the accounts
  npm run admin -- add-user <name>         make an account, even with sign-ups switched off
  npm run admin -- reset-password <name>   give an account a new password and sign it out everywhere
  npm run admin -- backup [file]           copy the database, safely, even while the server runs
  npm run admin -- address [port]          print the address a tablet should open
`;

const [command, ...args] = process.argv.slice(2);
loadEnvFile();
const config = loadConfig(process.env, { port: 4173, serveStatic: false });

async function withServices<T>(run: (services: Services) => Promise<T>): Promise<T> {
  const { stores, close } = await openStores(config.database);
  try {
    return await run(createServices(stores));
  } finally {
    await close();
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
      if (config.database.kind !== 'sqlite') {
        throw new Error(
          `There is no file to copy: this is ${describeDatabase(config.database)}, whose host takes its own backups.`,
        );
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const target = resolve(args[0] ?? `.data/backups/hanzi-workshop-${stamp}.db`);
      const { openDatabase, backupDatabase } = await import('./infrastructure/sqlite/database');
      const file = config.database.file;
      const db = openDatabase(file);
      try {
        backupDatabase(db, target);
      } finally {
        db.close();
      }
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
