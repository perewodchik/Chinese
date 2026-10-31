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
  // Conversations, kept so one can be come back to a week later. The options
  // are stored beside the turns because they are what makes a resumed
  // conversation continuous with the one that was left: the level Claude was
  // answering at, how long its turns are, what the two of them were talking
  // about. The turns are one JSON document rather than a row each — a
  // conversation is read and written whole, never queried into.
  `
  CREATE TABLE conversations (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    options    TEXT NOT NULL,
    voice      TEXT,
    turns      TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX conversations_by_user ON conversations (user_id, updated_at DESC);
  `,
  // 走走, the walk through Beijing: one game save per account, apart from the
  // workspace — the game saves on every map change and conversation, and
  // must not move the workspace's revision each time.
  `
  CREATE TABLE world_saves (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    save       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;
  `,
  // Sentences read aloud by a model on the home computer, kept for the
  // website, which has none: a text's Listen plays them in that voice. Not
  // anybody's in particular — the same sentence in the same voice is the
  // same recording — so there is no user column, and nothing to delete with
  // an account.
  `
  CREATE TABLE recordings (
    key        TEXT PRIMARY KEY,
    voice      TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    gender     TEXT NOT NULL,
    text       TEXT NOT NULL,
    mp3        BLOB NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX recordings_by_voice ON recordings (voice);
  `,
  // The pictures beside a text's paragraphs, drawn away from the app and sent
  // in; filed by the digest of their bytes, and only ever shown to their owner.
  `
  CREATE TABLE pictures (
    key        TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    bytes      BLOB NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX pictures_by_user ON pictures (user_id);
  `,
  // A learner's keys for services the app calls on their behalf; never sent back to a page.
  `
  CREATE TABLE user_secrets (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, name)
  ) STRICT;
  `,
  // The narrators a learner made for reading texts aloud: a voice, a name, how it sounds.
  `
  CREATE TABLE narrators (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    kind         TEXT NOT NULL,
    voice_id     TEXT NOT NULL,
    prompt       TEXT NOT NULL,
    preview_text TEXT NOT NULL,
    speed        REAL NOT NULL,
    pitch        INTEGER NOT NULL,
    emotion      TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  ) STRICT;

  CREATE INDEX narrators_by_user ON narrators (user_id, created_at);
  `,
];
