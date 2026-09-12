/**
 * The schema, as the list of steps that built it.
 *
 * A step is never edited once it has shipped — a database out in the world has
 * already run it — so every change is a new step at the end.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    username_key  TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    user_agent   TEXT
  ) STRICT;

  CREATE INDEX sessions_by_user ON sessions (user_id);
  CREATE INDEX sessions_by_expiry ON sessions (expires_at);

  CREATE TABLE workspaces (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    document   TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  `,
];
