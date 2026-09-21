/**
 * The same schema as the SQLite one, in Postgres.
 *
 * A step is never edited once it has shipped, exactly as on the SQLite side.
 * The two are kept deliberately in step: same tables, same columns, same
 * names, so a document written by one server reads on the other.
 *
 * Three differences are forced by the dialect. `STRICT` is SQLite's own word
 * and has no Postgres equivalent — the column types are already exact here.
 * Every time is milliseconds since the epoch, which passed int4 in 1970 and
 * so must be `BIGINT`. And `document` is `TEXT` holding JSON rather than
 * `JSONB`, because the server never looks inside it and re-encoding a
 * workspace on every read would cost more than it is worth.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    username_key  TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    BIGINT NOT NULL,
    updated_at    BIGINT NOT NULL
  );

  CREATE TABLE sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   BIGINT NOT NULL,
    last_seen_at BIGINT NOT NULL,
    expires_at   BIGINT NOT NULL,
    user_agent   TEXT
  );

  CREATE INDEX sessions_by_user ON sessions (user_id);
  CREATE INDEX sessions_by_expiry ON sessions (expires_at);

  CREATE TABLE workspaces (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    document   TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  `,
  // Conversations kept to come back to; see the SQLite migrations for why the
  // options live beside the turns.
  `
  CREATE TABLE conversations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    options    TEXT NOT NULL,
    voice      TEXT,
    turns      TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  );

  CREATE INDEX conversations_by_user ON conversations (user_id, updated_at DESC);
  `,
];
