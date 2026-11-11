import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { SERVER_COMMAND } from './application/auth-service';
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
 *   npm run admin -- grant-admin <name> | revoke-admin <name>
 *   npm run admin -- block <name> | unblock <name>
 *   npm run admin -- invite [note] [--days 14]
 *   npm run admin -- invites
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
  npm run admin -- grant-admin <name>      let an account run the site (/admin)
  npm run admin -- revoke-admin <name>     make it a learner again; never the last one
  npm run admin -- block <name>            pause an account: signed out everywhere, its tokens stopped
  npm run admin -- unblock <name>          open a paused account again
  npm run admin -- invite [note] [--days N] an invitation for one new account (14 days; --days 0 for no end)
  npm run admin -- invites                 the invitations given out, and who used them
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
        console.log(`  ${u.username.padEnd(34)} since ${new Date(u.createdAt).toLocaleDateString()}${u.role === 'admin' ? '   runs the site' : ''}`);
      }
      break;
    }

    case 'add-user': {
      const name = args[0];
      if (!name) throw new Error(`What should the account be called?\n${USAGE}`);
      const password = temporaryPassword();
      const user = await withServices(({ auth }) => auth.addUser(name, password, SERVER_COMMAND));
      console.log(`\n  Made ${user.username}. The password, to change in Settings:  ${password}\n`);
      break;
    }

    case 'invite': {
      const at = args.indexOf('--days');
      const days = at >= 0 ? Number(args[at + 1]) : 14;
      if (!Number.isInteger(days) || days < 0) throw new Error(`--days is a whole number of days.\n${USAGE}`);
      const note = args.filter((_, i) => at < 0 || (i !== at && i !== at + 1)).join(' ');
      const made = await withServices(({ auth }) => auth.invite(note, days === 0 ? null : days, SERVER_COMMAND));
      const site = process.env.HANZI_SITE_URL?.replace(/\/$/, '') ?? 'https://chinese-inky.vercel.app';
      console.log(`\n  Invitation${note ? ` for ${note}` : ''}:  ${made.code}`);
      console.log(`  The link to send:  ${site}/register?invite=${made.code}`);
      console.log(made.expiresAt ? `  Good for one account until ${new Date(made.expiresAt).toLocaleDateString()}.\n` : '  Good for one account, with no end date.\n');
      break;
    }

    case 'invites': {
      const list = await withServices(({ auth }) => auth.invites());
      if (!list.length) console.log('\n  No invitations given out yet.\n');
      const now = Date.now();
      for (const i of list) {
        const state = i.usedBy ? `used by ${i.usedBy} on ${new Date(i.usedAt!).toLocaleDateString()}` : i.expiresAt && i.expiresAt <= now ? 'ran out unused' : 'not used yet';
        console.log(`  ${new Date(i.createdAt).toLocaleDateString().padEnd(12)} ${(i.note || '—').padEnd(24)} ${state}`);
      }
      break;
    }

    case 'reset-password': {
      const name = args[0];
      if (!name) throw new Error(`Which account?\n${USAGE}`);
      const password = temporaryPassword();
      const user = await withServices(({ auth }) => auth.resetPassword(name, password, SERVER_COMMAND));
      console.log(`\n  New password for ${user.username}:  ${password}`);
      console.log('  Every browser signed in to that account has been signed out.\n');
      break;
    }

    case 'grant-admin':
    case 'revoke-admin': {
      const name = args[0];
      if (!name) throw new Error(`Which account?\n${USAGE}`);
      const user = await withServices(({ auth }) => auth.setRole(name, command === 'grant-admin' ? 'admin' : 'learner', SERVER_COMMAND));
      console.log(`\n  ${user.username} ${user.role === 'admin' ? 'runs the site now' : 'is a learner now'}.\n`);
      break;
    }

    case 'block':
    case 'unblock': {
      const name = args[0];
      if (!name) throw new Error(`Which account?\n${USAGE}`);
      const user = await withServices(({ auth }) => auth.setStatus(name, command === 'block' ? 'blocked' : 'active', SERVER_COMMAND));
      console.log(command === 'block' ? `\n  ${user.username} is paused: signed out everywhere, its tokens stopped.\n` : `\n  ${user.username} can sign in again.\n`);
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
