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
  // A whole text read by a narrator in one go, kept so it is never paid for twice.
  `
  CREATE TABLE text_narrations (
    key          TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    narrator_id  TEXT NOT NULL,
    mp3          BLOB NOT NULL,
    timings      TEXT NOT NULL,
    duration_ms  INTEGER NOT NULL,
    created_at   INTEGER NOT NULL
  ) STRICT;
  `,
  // Texts of the learner's own, written in Voices to be read aloud, perhaps saved to Read.
  `
  CREATE TABLE own_texts (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    lines          TEXT NOT NULL,
    narrator_id    TEXT NOT NULL,
    narration_key  TEXT NOT NULL,
    text_id        TEXT,
    created_at     INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX own_texts_user ON own_texts (user_id, created_at);
  `,
  // Things said aloud and scored (Phrases, the tone drills, the sound lessons): the history every device shares.
  `
  CREATE TABLE speech_attempts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    at         INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    source_id  TEXT,
    text       TEXT NOT NULL,
    tally      TEXT,
    good       INTEGER NOT NULL,
    summary    TEXT,
    result     TEXT
  ) STRICT;
  CREATE INDEX speech_attempts_user ON speech_attempts (user_id, at);
  `,
  // What the learner's own keys have been spent on, a row a day a service: counted where the call is made.
  `
  CREATE TABLE api_usage (
    user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day      TEXT NOT NULL,
    service  TEXT NOT NULL,
    calls    INTEGER NOT NULL,
    units    INTEGER NOT NULL,
    PRIMARY KEY (user_id, day, service)
  ) STRICT;
  `,
  // Invitations to make an account, when sign-ups are by invitation. Only the
  // code's digest is kept, so the list cannot be read back into working codes;
  // used_by is not a foreign key, because the code is claimed for an account
  // a moment before that account exists.
  `
  CREATE TABLE invites (
    digest      TEXT PRIMARY KEY,
    note        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER,
    used_by     TEXT,
    used_at     INTEGER
  ) STRICT;
  `,
  // Attempts per key per window — sign-ins, sign-ups, calls that cost money —
  // kept in the database so every instance of the server counts the same.
  `
  CREATE TABLE rate_limits (
    key           TEXT NOT NULL,
    window_start  INTEGER NOT NULL,
    count         INTEGER NOT NULL,
    PRIMARY KEY (key, window_start)
  ) STRICT;
  CREATE INDEX rate_limits_by_window ON rate_limits (window_start);
  `,
  // Answers that are the same for everyone (a YouTube video's captions), kept a while.
  `
  CREATE TABLE lookup_cache (
    key         TEXT PRIMARY KEY,
    body        TEXT NOT NULL,
    fetched_at  INTEGER NOT NULL
  ) STRICT;
  `,
  // Codes to set a new password with when the old one is forgotten: there is
  // no e-mail to send a link to. Only their digests are kept; each works once.
  `
  CREATE TABLE recovery_codes (
    user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    digest      TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    used_at     INTEGER,
    PRIMARY KEY (user_id, digest)
  ) STRICT;
  `,
  // What happened to accounts, kept ninety days for whoever runs the site.
  `
  CREATE TABLE audit_log (
    at          INTEGER NOT NULL,
    kind        TEXT NOT NULL,
    username    TEXT NOT NULL,
    ip          TEXT NOT NULL,
    user_agent  TEXT
  ) STRICT;
  CREATE INDEX audit_log_by_time ON audit_log (at);
  `,
  // Tokens for scripts (the add-text skill) in place of the account's
  // password: only the digest is kept, and each says what it may do.
  `
  CREATE TABLE api_tokens (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    digest        TEXT NOT NULL UNIQUE,
    scopes        TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    last_used_at  INTEGER,
    expires_at    INTEGER NOT NULL,
    revoked_at    INTEGER
  ) STRICT;
  CREATE INDEX api_tokens_by_user ON api_tokens (user_id);
  `,
  // What an account may do and whether it may sign in at all, kept by its
  // id: who runs the site used to be a list of names in HANZI_ADMIN_USERS,
  // and a name is not a person. Flags are JSON: { tutor, unlimited, photoInbox }.
  `
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'learner';
  ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  ALTER TABLE users ADD COLUMN flags TEXT NOT NULL DEFAULT '{}';
  `,
];
