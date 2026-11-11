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
  // 走走's game saves; see the SQLite migrations.
  `
  CREATE TABLE world_saves (
    user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    revision   INTEGER NOT NULL,
    save       TEXT NOT NULL,
    updated_at BIGINT NOT NULL
  );
  `,
  // Sentences read aloud at home, for the website to play; see the SQLite migrations.
  `
  CREATE TABLE recordings (
    key        TEXT PRIMARY KEY,
    voice      TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    gender     TEXT NOT NULL,
    text       TEXT NOT NULL,
    mp3        BYTEA NOT NULL,
    created_at BIGINT NOT NULL
  );

  CREATE INDEX recordings_by_voice ON recordings (voice);
  `,
  // The pictures beside a text's paragraphs, drawn away from the app and sent
  // in; filed by the digest of their bytes, and only ever shown to their owner.
  `
  CREATE TABLE pictures (
    key        TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    bytes      BYTEA NOT NULL,
    created_at BIGINT NOT NULL
  );

  CREATE INDEX pictures_by_user ON pictures (user_id);
  `,
  // A learner's keys for services the app calls on their behalf; never sent back to a page.
  `
  CREATE TABLE user_secrets (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, name)
  );
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
    speed        DOUBLE PRECISION NOT NULL,
    pitch        BIGINT NOT NULL,
    emotion      TEXT,
    created_at   BIGINT NOT NULL,
    updated_at   BIGINT NOT NULL
  );

  CREATE INDEX narrators_by_user ON narrators (user_id, created_at);
  `,
  // A whole text read by a narrator in one go, kept so it is never paid for twice.
  `
  CREATE TABLE text_narrations (
    key          TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    narrator_id  TEXT NOT NULL,
    mp3          BYTEA NOT NULL,
    timings      TEXT NOT NULL,
    duration_ms  BIGINT NOT NULL,
    created_at   BIGINT NOT NULL
  );
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
    created_at     BIGINT NOT NULL
  );
  CREATE INDEX own_texts_user ON own_texts (user_id, created_at);
  `,
  // Things said aloud and scored (Phrases, the tone drills, the sound lessons): the history every device shares.
  `
  CREATE TABLE speech_attempts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    at         BIGINT NOT NULL,
    kind       TEXT NOT NULL,
    source_id  TEXT,
    text       TEXT NOT NULL,
    tally      TEXT,
    good       BOOLEAN NOT NULL,
    summary    TEXT,
    result     TEXT
  );
  CREATE INDEX speech_attempts_user ON speech_attempts (user_id, at);
  `,
  // What the learner's own keys have been spent on, a row a day a service: counted where the call is made.
  `
  CREATE TABLE api_usage (
    user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day      TEXT NOT NULL,
    service  TEXT NOT NULL,
    calls    BIGINT NOT NULL,
    units    BIGINT NOT NULL,
    PRIMARY KEY (user_id, day, service)
  );
  `,
  // Invitations to make an account, when sign-ups are by invitation. Only the
  // code's digest is kept, so the list cannot be read back into working codes;
  // used_by is not a foreign key, because the code is claimed for an account
  // a moment before that account exists.
  `
  CREATE TABLE invites (
    digest      TEXT PRIMARY KEY,
    note        TEXT NOT NULL,
    created_at  BIGINT NOT NULL,
    expires_at  BIGINT,
    used_by     TEXT,
    used_at     BIGINT
  );
  `,
  // Attempts per key per window — sign-ins, sign-ups, calls that cost money —
  // kept in the database so every instance of the server counts the same.
  `
  CREATE TABLE rate_limits (
    key           TEXT NOT NULL,
    window_start  BIGINT NOT NULL,
    count         BIGINT NOT NULL,
    PRIMARY KEY (key, window_start)
  );
  CREATE INDEX rate_limits_by_window ON rate_limits (window_start);
  `,
  // Answers that are the same for everyone (a YouTube video's captions), kept a while.
  `
  CREATE TABLE lookup_cache (
    key         TEXT PRIMARY KEY,
    body        TEXT NOT NULL,
    fetched_at  BIGINT NOT NULL
  );
  `,
  // Codes to set a new password with when the old one is forgotten: there is
  // no e-mail to send a link to. Only their digests are kept; each works once.
  `
  CREATE TABLE recovery_codes (
    user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    digest      TEXT NOT NULL,
    created_at  BIGINT NOT NULL,
    used_at     BIGINT,
    PRIMARY KEY (user_id, digest)
  );
  `,
  // What happened to accounts, kept ninety days for whoever runs the site.
  `
  CREATE TABLE audit_log (
    at          BIGINT NOT NULL,
    kind        TEXT NOT NULL,
    username    TEXT NOT NULL,
    ip          TEXT NOT NULL,
    user_agent  TEXT
  );
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
    created_at    BIGINT NOT NULL,
    last_used_at  BIGINT,
    expires_at    BIGINT NOT NULL,
    revoked_at    BIGINT
  );
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
  // What the accounts that run the site did, and to whom, kept a year. The
  // actor and the target are kept by name as well as by id, so the line
  // still reads after either account is deleted; neither is a foreign key.
  `
  CREATE TABLE admin_log (
    id           BIGSERIAL PRIMARY KEY,
    at           BIGINT NOT NULL,
    actor_id     TEXT,
    actor_name   TEXT NOT NULL,
    action       TEXT NOT NULL,
    target_id    TEXT,
    target_name  TEXT,
    details      TEXT NOT NULL,
    ip           TEXT
  );
  CREATE INDEX admin_log_by_time ON admin_log (at);
  `,
  // When the session's password was last typed: an admin's action that
  // changes something asks for it again once this is older than a quarter
  // of an hour. A session from before reads as typed when it was made.
  `
  ALTER TABLE sessions ADD COLUMN verified_at BIGINT NOT NULL DEFAULT 0;
  UPDATE sessions SET verified_at = created_at;
  `,
];
