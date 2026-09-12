import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MIGRATIONS } from './migrations';

/**
 * Opens the database, creating the file and bringing its schema up to date.
 *
 * SQLite, because the whole server is one process on one machine: one file to
 * back up, nothing to install, and `node:sqlite` ships inside Node, so there is
 * no native module to build on Windows either.
 */
export function openDatabase(file: string): DatabaseSync {
  const inMemory = file === ':memory:';
  if (!inMemory) mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  // WAL lets a read go ahead while a save is being written, and makes
  // synchronous=NORMAL safe against corruption.
  if (!inMemory) db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);
  return db;
}

/** Runs every migration past the one recorded in `user_version`, each in a transaction of its own. */
function migrate(db: DatabaseSync) {
  const { user_version: applied } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (let step = Number(applied); step < MIGRATIONS.length; step++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[step]);
      db.exec(`PRAGMA user_version = ${step + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** A consistent copy of the whole database, safe to take while the server is running. */
export function backupDatabase(db: DatabaseSync, target: string) {
  mkdirSync(dirname(target), { recursive: true });
  db.prepare('VACUUM INTO ?').run(target);
}
