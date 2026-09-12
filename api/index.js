// Built from server/src/vercel.ts by scripts/build-api.mjs — do not edit.

// server/src/vercel.ts
import { getRequestListener } from "@hono/node-server";

// shared/credentials.ts
var USERNAME_MIN = 3;
var USERNAME_MAX = 32;
var PASSWORD_MIN = 8;
var PASSWORD_MAX = 256;
var NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u;
var normaliseUsername = (raw) => raw.normalize("NFKC").trim();
var usernameKey = (raw) => normaliseUsername(raw).toLowerCase();
function usernameProblem(raw) {
  const name = normaliseUsername(raw);
  const length = [...name].length;
  if (length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (length > USERNAME_MAX) return `No more than ${USERNAME_MAX} characters.`;
  if (!NAME_SHAPE.test(name)) return "Letters and digits, with . _ or - between them.";
  return null;
}
function passwordProblem(password, username = "") {
  const length = [...password].length;
  if (length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters.`;
  if (length > PASSWORD_MAX) return `No more than ${PASSWORD_MAX} characters.`;
  if (username && usernameKey(password) === usernameKey(username)) {
    return "Not the same as the name.";
  }
  return null;
}

// server/src/domain/errors.ts
var AppError = class extends Error {
  code;
  fields;
  constructor(code, message, fields) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fields = fields;
  }
};
var ValidationError = class extends AppError {
  constructor(message, fields) {
    super("validation", message, fields);
  }
};
var InvalidCredentialsError = class extends AppError {
  constructor() {
    super("invalid_credentials", "That name and password do not match an account.");
  }
};
var UsernameTakenError = class extends AppError {
  constructor() {
    super("username_taken", "That name is taken.", { username: "Taken \u2014 pick another." });
  }
};
var RegistrationClosedError = class extends AppError {
  constructor() {
    super("registration_closed", "New accounts are switched off on this server.");
  }
};
var UnauthorizedError = class extends AppError {
  constructor() {
    super("unauthorized", "Sign in to carry on.");
  }
};
var ForbiddenOriginError = class extends AppError {
  constructor() {
    super("forbidden_origin", "That request did not come from this app.");
  }
};
var NotFoundError = class extends AppError {
  constructor(what = "That") {
    super("not_found", `${what} does not exist.`);
  }
};
var RateLimitedError = class extends AppError {
  retryAfterSeconds;
  constructor(retryAfterSeconds) {
    super("rate_limited", "Too many attempts. Wait a few minutes and try again.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
};
var RevisionConflictError = class extends AppError {
  current;
  constructor(current) {
    super("conflict", "This workspace was saved from somewhere else in the meantime.");
    this.current = current;
  }
};

// server/src/application/auth-service.ts
var DAY = 864e5;
var DEFAULT_AUTH_POLICY = {
  registration: "open",
  sessionTtlMs: 30 * DAY,
  sessionRefreshMs: DAY
};
var toUserDto = (u) => ({
  id: u.id,
  username: u.username,
  createdAt: u.createdAt
});
var AuthService = class {
  constructor(deps) {
    this.deps = deps;
  }
  decoy = null;
  get registration() {
    return this.deps.policy.registration;
  }
  async register(input) {
    if (this.deps.policy.registration === "closed") throw new RegistrationClosedError();
    const user = await this.createUser(input.username, input.password);
    return this.issue(user, input.userAgent);
  }
  /** An account made by whoever runs the server, whether or not sign-ups are open. No session comes with it. */
  async addUser(username, password) {
    return toUserDto(await this.createUser(username, password));
  }
  async createUser(rawName, password) {
    const { users, hasher, tokens, clock } = this.deps;
    const username = normaliseUsername(rawName);
    const nameProblem = usernameProblem(username);
    const passProblem = passwordProblem(password, username);
    if (nameProblem || passProblem) {
      throw new ValidationError(nameProblem ?? passProblem ?? "", {
        ...nameProblem && { username: nameProblem },
        ...passProblem && { password: passProblem }
      });
    }
    const now = clock.now();
    const user = {
      id: tokens.id(),
      username,
      usernameKey: usernameKey(username),
      passwordHash: await hasher.hash(password),
      createdAt: now,
      updatedAt: now
    };
    if (!await users.insert(user)) throw new UsernameTakenError();
    return user;
  }
  async login(input) {
    const { users, hasher } = this.deps;
    const plausible = input.password.length <= PASSWORD_MAX * 4;
    const user = plausible ? await users.findByUsernameKey(usernameKey(input.username)) : null;
    const matches = await hasher.verify(input.password, user?.passwordHash ?? await this.decoyHash());
    if (!user || !matches) throw new InvalidCredentialsError();
    return this.issue(user, input.userAgent);
  }
  async logout(token) {
    if (token) await this.deps.sessions.delete(this.deps.tokens.digest(token));
  }
  /** The session a cookie belongs to, if it is still good, with its expiry pushed back when that is due. */
  async authenticate(token) {
    if (!token) return null;
    const { sessions, users, tokens, clock, policy } = this.deps;
    const id = tokens.digest(token);
    const session = await sessions.findById(id);
    if (!session) return null;
    const now = clock.now();
    const user = session.expiresAt > now ? await users.findById(session.userId) : null;
    if (!user) {
      await sessions.delete(id);
      return null;
    }
    if (now - session.lastSeenAt < policy.sessionRefreshMs) {
      return { user: toUserDto(user), sessionId: id, expiresAt: session.expiresAt, renewed: false };
    }
    const expiresAt = now + policy.sessionTtlMs;
    await sessions.touch(id, now, expiresAt);
    return { user: toUserDto(user), sessionId: id, expiresAt, renewed: true };
  }
  /** A new password, and every other browser signed out — which is usually why it is being changed. */
  async changePassword(input) {
    const { users, sessions, hasher, clock } = this.deps;
    const user = await users.findById(input.userId);
    if (!user) throw new UnauthorizedError();
    if (!await hasher.verify(input.currentPassword, user.passwordHash)) {
      throw new ValidationError("That is not the current password.", {
        currentPassword: "Not the current password."
      });
    }
    const problem = passwordProblem(input.newPassword, user.username);
    if (problem) throw new ValidationError(problem, { newPassword: problem });
    await users.updatePassword(user.id, await hasher.hash(input.newPassword), clock.now());
    await sessions.deleteForUser(user.id, input.sessionId);
  }
  /** For whoever runs the server: a new password for an account, and every session of it ended. */
  async resetPassword(username, newPassword) {
    const { users, sessions, hasher, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(username));
    if (!user) throw new NotFoundError(`An account called \u201C${username}\u201D`);
    const problem = passwordProblem(newPassword, user.username);
    if (problem) throw new ValidationError(problem);
    await users.updatePassword(user.id, await hasher.hash(newPassword), clock.now());
    await sessions.deleteForUser(user.id);
    return toUserDto(user);
  }
  async listUsers() {
    return (await this.deps.users.list()).map(toUserDto);
  }
  purgeExpiredSessions() {
    return this.deps.sessions.deleteExpired(this.deps.clock.now());
  }
  async issue(user, userAgent) {
    const { sessions, tokens, clock, policy } = this.deps;
    const token = tokens.secret();
    const now = clock.now();
    const expiresAt = now + policy.sessionTtlMs;
    await sessions.insert({
      id: tokens.digest(token),
      userId: user.id,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      userAgent: userAgent ? userAgent.slice(0, 300) : null
    });
    return { user: toUserDto(user), token, expiresAt };
  }
  decoyHash() {
    this.decoy ??= this.deps.hasher.hash("a password nobody has");
    return this.decoy;
  }
};

// server/src/application/workspace-service.ts
var toDto = (w) => w ? { revision: w.revision, document: w.document, updatedAt: w.updatedAt } : { revision: 0, document: null, updatedAt: null };
var WorkspaceService = class {
  constructor(deps) {
    this.deps = deps;
  }
  async get(userId) {
    return toDto(await this.deps.workspaces.find(userId));
  }
  revision(userId) {
    return this.deps.workspaces.revisionOf(userId);
  }
  async save(userId, baseRevision, document) {
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new ValidationError("The base revision has to be a whole number, 0 or more.", {
        baseRevision: "Not a revision."
      });
    }
    if (!isDocument(document)) {
      throw new ValidationError("A workspace is a JSON object carrying its format version.", {
        document: "Not a workspace."
      });
    }
    const write = await this.deps.workspaces.save(userId, baseRevision, document, this.deps.clock.now());
    if (write.saved) return { revision: write.revision, updatedAt: write.updatedAt };
    throw new RevisionConflictError(toDto(write.current));
  }
};
function isDocument(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const version = v.version;
  return typeof version === "number" && Number.isInteger(version) && version > 0;
}

// server/src/infrastructure/clock.ts
var systemClock = { now: () => Date.now() };

// server/src/infrastructure/crypto/scrypt-hasher.ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
var DEFAULT_COST = { log2N: 15, r: 8, p: 3 };
var SALT_BYTES = 16;
var KEY_BYTES = 32;
var ScryptHasher = class {
  constructor(cost = DEFAULT_COST) {
    this.cost = cost;
  }
  async hash(password) {
    const salt = randomBytes(SALT_BYTES);
    const key = await derive(password, salt, this.cost, KEY_BYTES);
    const { log2N, r, p } = this.cost;
    return ["scrypt", log2N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }
  async verify(password, stored) {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [log2N, r, p] = parts.slice(1, 4).map(Number);
    if (![log2N, r, p].every((n) => Number.isInteger(n) && n > 0) || log2N > 20) return false;
    const expected = Buffer.from(parts[5], "base64");
    if (expected.length === 0) return false;
    const actual = await derive(password, Buffer.from(parts[4], "base64"), { log2N, r, p }, expected.length);
    return timingSafeEqual(actual, expected);
  }
};
function derive(password, salt, cost, length) {
  const N = 2 ** cost.log2N;
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      length,
      { N, r: cost.r, p: cost.p, maxmem: 256 * N * cost.r },
      (err, key) => err ? reject(err) : resolve(key)
    );
  });
}

// server/src/infrastructure/crypto/tokens.ts
import { createHash, randomBytes as randomBytes2, randomUUID } from "node:crypto";
var cryptoTokens = {
  // 256 bits: not something to guess, and base64url so it needs no escaping in a cookie.
  secret: () => randomBytes2(32).toString("base64url"),
  digest: (secret) => createHash("sha256").update(secret).digest("base64url"),
  id: () => randomUUID()
};

// server/src/composition.ts
function createServices(stores, options = {}) {
  const clock = options.clock ?? systemClock;
  const auth = new AuthService({
    users: stores.users,
    sessions: stores.sessions,
    hasher: options.hasher ?? new ScryptHasher(),
    tokens: cryptoTokens,
    clock,
    policy: { ...DEFAULT_AUTH_POLICY, ...options.policy }
  });
  const workspaces = new WorkspaceService({ workspaces: stores.workspaces, clock });
  return { auth, workspaces, clock };
}

// server/src/http/app.ts
import { Hono as Hono4 } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";

// server/src/http/errors.ts
import { HTTPException } from "hono/http-exception";
var STATUS = {
  validation: 400,
  invalid_credentials: 401,
  unauthorized: 401,
  registration_closed: 403,
  forbidden_origin: 403,
  not_found: 404,
  username_taken: 409,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  internal: 500
};
var errorBody = (code, message, fields) => ({
  error: { code, message, ...fields && { fields } }
});
function handleError(log) {
  return (err, c) => {
    if (err instanceof RevisionConflictError) {
      const body = { ...errorBody(err.code, err.message), current: err.current };
      return c.json(body, 409);
    }
    if (err instanceof AppError) {
      if (err instanceof RateLimitedError) c.header("Retry-After", String(err.retryAfterSeconds));
      return c.json(errorBody(err.code, err.message, err.fields), STATUS[err.code]);
    }
    if (err instanceof HTTPException) return err.getResponse();
    log(`${c.req.method} ${c.req.path} failed: ${err.stack ?? err.message}`);
    return c.json(errorBody("internal", "Something went wrong on the server."), 500);
  };
}

// server/src/http/request.ts
import { getConnInfo } from "@hono/node-server/conninfo";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
var SESSION_COOKIE = "hanzi_session";
function isHttps(c, trustProxy) {
  const forwarded = trustProxy ? c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() : void 0;
  return (forwarded ?? new URL(c.req.url).protocol.replace(":", "")) === "https";
}
function clientIp(c, trustProxy) {
  const forwarded = trustProxy ? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() : void 0;
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
var readSessionToken = (c) => getCookie(c, SESSION_COOKIE);
function writeSessionCookie(c, token, maxAgeMs, secure) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    path: "/",
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1e3))
  });
}
function clearSessionCookie(c, secure) {
  deleteCookie(c, SESSION_COOKIE, { httpOnly: true, sameSite: "Lax", secure, path: "/" });
}
async function readJson(c, schema) {
  if (!c.req.header("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ValidationError("Send the request as JSON.");
  }
  let raw;
  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError("The request body is not valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const fields = {};
  for (const issue of parsed.error.issues) {
    fields[issue.path.map(String).join(".") || "body"] ??= issue.message;
  }
  throw new ValidationError("The request is not in the expected shape.", fields);
}

// server/src/http/guards.ts
var SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
function sameOriginOnly() {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const site = c.req.header("sec-fetch-site");
    if (site) {
      if (site === "same-origin" || site === "none") return next();
      throw new ForbiddenOriginError();
    }
    const origin = c.req.header("origin");
    if (!origin) return next();
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
    }
    if (originHost && originHost === c.req.header("host")) return next();
    throw new ForbiddenOriginError();
  };
}
async function currentSession(c, auth, opts) {
  const token = readSessionToken(c);
  if (!token) return null;
  const session = await auth.authenticate(token);
  const secure = isHttps(c, opts.trustProxy);
  if (!session) clearSessionCookie(c, secure);
  else if (session.renewed) writeSessionCookie(c, token, session.expiresAt - opts.clock.now(), secure);
  return session;
}
function requireSession(auth, opts) {
  return async (c, next) => {
    const session = await currentSession(c, auth, opts);
    if (!session) throw new UnauthorizedError();
    c.set("session", session);
    await next();
  };
}
var RateLimiter = class {
  constructor(limit, windowMs, clock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }
  windows = /* @__PURE__ */ new Map();
  /** Counts one attempt against `key`, and throws once the window is used up. */
  consume(key) {
    const now = this.clock.now();
    if (this.windows.size > 1e4) this.sweep(now);
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (window.count >= this.limit) {
      throw new RateLimitedError(Math.ceil((window.resetAt - now) / 1e3));
    }
    window.count++;
  }
  reset(key) {
    this.windows.delete(key);
  }
  sweep(now) {
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
};

// server/src/http/routes/auth.ts
import { Hono } from "hono";
import { z } from "zod";
var MINUTE = 6e4;
var credentials = z.object({
  username: z.string().max(200),
  password: z.string().max(2048)
});
var passwordChange = z.object({
  currentPassword: z.string().max(2048),
  newPassword: z.string().max(2048)
});
function authRoutes({ auth, clock, trustProxy }) {
  const routes = new Hono();
  const sessionOptions = { trustProxy, clock };
  const session = requireSession(auth, sessionOptions);
  const perName = new RateLimiter(10, 15 * MINUTE, clock);
  const perAddress = new RateLimiter(100, 15 * MINUTE, clock);
  const signUps = new RateLimiter(20, 60 * MINUTE, clock);
  routes.get("/options", (c) => {
    const body = { registration: auth.registration };
    return c.json(body);
  });
  routes.get("/session", async (c) => {
    c.header("Cache-Control", "no-store");
    const active = await currentSession(c, auth, sessionOptions);
    const body = { user: active?.user ?? null };
    return c.json(body);
  });
  routes.post("/register", async (c) => {
    signUps.consume(clientIp(c, trustProxy));
    const input = await readJson(c, credentials);
    const issued = await auth.register({ ...input, userAgent: c.req.header("user-agent") ?? null });
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body = { user: issued.user };
    return c.json(body, 201);
  });
  routes.post("/login", async (c) => {
    const input = await readJson(c, credentials);
    const ip = clientIp(c, trustProxy);
    const nameKey = `${ip} ${usernameKey(input.username)}`;
    perAddress.consume(ip);
    perName.consume(nameKey);
    const issued = await auth.login({ ...input, userAgent: c.req.header("user-agent") ?? null });
    perName.reset(nameKey);
    writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
    const body = { user: issued.user };
    return c.json(body);
  });
  routes.post("/logout", async (c) => {
    await auth.logout(readSessionToken(c));
    clearSessionCookie(c, isHttps(c, trustProxy));
    return c.body(null, 204);
  });
  routes.post("/password", session, async (c) => {
    const input = await readJson(c, passwordChange);
    const { user, sessionId } = c.get("session");
    await auth.changePassword({ userId: user.id, sessionId, ...input });
    return c.body(null, 204);
  });
  return routes;
}

// server/src/http/routes/workspace.ts
import { Hono as Hono2 } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z as z2 } from "zod";

// shared/api.ts
var WORKSPACE_MAX_BYTES = 16 * 1024 * 1024;
var workspaceTag = (revision) => `"r${revision}"`;

// server/src/http/routes/workspace.ts
var saveRequest = z2.object({
  baseRevision: z2.number().int().min(0),
  document: z2.record(z2.string(), z2.unknown())
});
function workspaceRoutes({ auth, workspaces, clock, trustProxy }) {
  const routes = new Hono2();
  const session = requireSession(auth, { trustProxy, clock });
  routes.get("/", session, async (c) => {
    const userId = c.get("session").user.id;
    c.header("Cache-Control", "no-store");
    const known = c.req.header("if-none-match");
    if (known) {
      const tag = workspaceTag(await workspaces.revision(userId));
      if (known.replace(/^W\//, "") === tag) {
        c.header("ETag", tag);
        return c.body(null, 304);
      }
    }
    const current = await workspaces.get(userId);
    c.header("ETag", workspaceTag(current.revision));
    return c.json(current);
  });
  routes.put(
    "/",
    session,
    bodyLimit({
      maxSize: WORKSPACE_MAX_BYTES,
      onError: (c) => c.json(errorBody("payload_too_large", "That is more than one account can store."), 413)
    }),
    async (c) => {
      const input = await readJson(c, saveRequest);
      const saved = await workspaces.save(
        c.get("session").user.id,
        input.baseRevision,
        input.document
      );
      return c.json(saved);
    }
  );
  return routes;
}

// server/src/http/static-site.ts
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono as Hono3 } from "hono";
function staticSite(root) {
  const site = new Hono3();
  const index = join(root, "index.html");
  site.use("*", caching());
  site.use("*", serveStatic({ root }));
  site.get("*", async (c) => {
    if (extname(c.req.path)) return c.notFound();
    return c.html(await readFile(index, "utf8"));
  });
  return site;
}
function caching() {
  return async (c, next) => {
    await next();
    if (c.res.status !== 200) return;
    if (c.req.path.startsWith("/assets/")) {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
      return;
    }
    c.header("Cache-Control", "no-cache");
    const since = c.req.header("if-modified-since");
    const modified = c.res.headers.get("last-modified");
    if (since && modified && Date.parse(modified) <= Date.parse(since)) {
      await c.res.body?.cancel();
      c.res = new Response(null, { status: 304, headers: { "Last-Modified": modified } });
    }
  };
}

// server/src/http/app.ts
function createHttpApp(services, options) {
  const onError = handleError(options.log);
  const deps = { ...services, trustProxy: options.trustProxy };
  const api = new Hono4();
  api.onError(onError);
  api.use("*", sameOriginOnly());
  api.get("/health", (c) => c.json({ ok: true }));
  api.route("/auth", authRoutes(deps));
  api.route("/workspace", workspaceRoutes(deps));
  api.all("*", () => {
    throw new NotFoundError("That API route");
  });
  const app = new Hono4();
  app.onError(onError);
  if (options.compress !== false) app.use("*", compress());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        // The worksheet preview is the PDF itself, in a frame, from a blob.
        frameSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      },
      // Sent over plain http it would be ignored anyway, and on a LAN address
      // it would only get in the way of ever trying https out.
      strictTransportSecurity: false
    })
  );
  app.route("/api", api);
  if (options.staticDir) app.route("/", staticSite(options.staticDir));
  return app;
}

// server/src/infrastructure/postgres/database.ts
import pg from "pg";

// server/src/infrastructure/postgres/migrations.ts
var MIGRATIONS = [
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
  `
];

// server/src/infrastructure/postgres/database.ts
var { Pool, types } = pg;
types.setTypeParser(20, (v) => Number(v));
var pool = null;
var ready = null;
function sslFor(url) {
  if (/[?&]sslmode=disable/.test(url)) return false;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
  }
  if (host === "localhost" || host === "127.0.0.1") return false;
  return process.env.PGSSLNOVERIFY === "1" ? { rejectUnauthorized: false } : true;
}
function databaseUrl(env = process.env) {
  return env.POSTGRES_URL || env.DATABASE_URL || null;
}
function openPostgres(url) {
  if (ready) return ready;
  pool ??= new Pool({
    connectionString: url,
    ssl: sslFor(url),
    // Neon's connection string asks for channel binding, and `pg` only reads
    // that from the options, never from the URL. With it on, the password is
    // bound to this TLS connection, so a proxy that talked us into trusting it
    // still cannot replay what it heard.
    enableChannelBinding: true,
    max: 1,
    idleTimeoutMillis: 1e4,
    // Under the time the platform allows a function, so that failing to
    // connect is an error we can report rather than the request being cut off
    // with nothing said.
    connectionTimeoutMillis: 5e3
  });
  pool.on("error", (err) => console.error(`postgres pool: ${err.message}`));
  const opening = migrate(pool).then(() => pool);
  ready = opening;
  opening.catch(() => {
    if (ready === opening) ready = null;
  });
  return opening;
}
async function migrate(p) {
  const c = await p.connect();
  try {
    await applyMigrations(c);
  } finally {
    c.release();
  }
}
async function applyMigrations(c) {
  if (await upToDate(c)) return;
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '4s'");
    await c.query("SELECT pg_advisory_xact_lock($1)", [4917283]);
    await c.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         step       INTEGER PRIMARY KEY,
         applied_at BIGINT NOT NULL
       )`
    );
    const { rows } = await c.query("SELECT COALESCE(MAX(step), 0) AS step FROM schema_migrations");
    const applied = Number(rows[0]?.step ?? 0);
    for (let step = applied; step < MIGRATIONS.length; step++) {
      await c.query(MIGRATIONS[step]);
      await c.query("INSERT INTO schema_migrations (step, applied_at) VALUES ($1, $2)", [
        step + 1,
        Date.now()
      ]);
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => void 0);
    throw err;
  }
}
async function upToDate(c) {
  try {
    const { rows } = await c.query(
      `SELECT COALESCE(MAX(step), 0) AS step FROM schema_migrations`
    );
    return Number(rows[0]?.step ?? 0) >= MIGRATIONS.length;
  } catch {
    return false;
  }
}

// server/src/infrastructure/postgres/session-repository.ts
var toSession = (r) => ({
  id: r.id,
  userId: r.user_id,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  expiresAt: r.expires_at,
  userAgent: r.user_agent
});
var PostgresSessionRepository = class {
  constructor(db) {
    this.db = db;
  }
  async insert(s) {
    await this.db.query(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [s.id, s.userId, s.createdAt, s.lastSeenAt, s.expiresAt, s.userAgent]
    );
  }
  async findById(id) {
    const { rows } = await this.db.query("SELECT * FROM sessions WHERE id = $1", [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }
  async touch(id, lastSeenAt, expiresAt) {
    await this.db.query("UPDATE sessions SET last_seen_at = $1, expires_at = $2 WHERE id = $3", [
      lastSeenAt,
      expiresAt,
      id
    ]);
  }
  async delete(id) {
    await this.db.query("DELETE FROM sessions WHERE id = $1", [id]);
  }
  async deleteForUser(userId, keepId) {
    const result = keepId ? await this.db.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [userId, keepId]) : await this.db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    return result.rowCount ?? 0;
  }
  async deleteExpired(now) {
    const result = await this.db.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
    return result.rowCount ?? 0;
  }
};

// server/src/infrastructure/postgres/user-repository.ts
var toUser = (r) => ({
  id: r.id,
  username: r.username,
  usernameKey: r.username_key,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});
var PostgresUserRepository = class {
  constructor(db) {
    this.db = db;
  }
  async findById(id) {
    const { rows } = await this.db.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }
  async findByUsernameKey(usernameKey2) {
    const { rows } = await this.db.query("SELECT * FROM users WHERE username_key = $1", [
      usernameKey2
    ]);
    return rows[0] ? toUser(rows[0]) : null;
  }
  async insert(u) {
    const result = await this.db.query(
      `INSERT INTO users (id, username, username_key, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username_key) DO NOTHING`,
      [u.id, u.username, u.usernameKey, u.passwordHash, u.createdAt, u.updatedAt]
    );
    return result.rowCount === 1;
  }
  async updatePassword(id, passwordHash, at) {
    await this.db.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [
      passwordHash,
      at,
      id
    ]);
  }
  async list() {
    const { rows } = await this.db.query("SELECT * FROM users ORDER BY created_at, id");
    return rows.map(toUser);
  }
};

// server/src/infrastructure/postgres/workspace-repository.ts
var PostgresWorkspaceRepository = class {
  constructor(db) {
    this.db = db;
  }
  async find(userId) {
    const { rows } = await this.db.query("SELECT * FROM workspaces WHERE user_id = $1", [
      userId
    ]);
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      revision: row.revision,
      document: JSON.parse(row.document),
      updatedAt: row.updated_at
    };
  }
  async revisionOf(userId) {
    const { rows } = await this.db.query(
      "SELECT revision FROM workspaces WHERE user_id = $1",
      [userId]
    );
    return rows[0]?.revision ?? 0;
  }
  async save(userId, baseRevision, document, at) {
    const json = JSON.stringify(document);
    const result = baseRevision === 0 ? await this.db.query(
      `INSERT INTO workspaces (user_id, revision, document, updated_at)
             VALUES ($1, 1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
      [userId, json, at]
    ) : await this.db.query(
      `UPDATE workspaces
             SET document = $1, updated_at = $2, revision = revision + 1
             WHERE user_id = $3 AND revision = $4`,
      [json, at, userId, baseRevision]
    );
    if (result.rowCount === 1) {
      return { saved: true, revision: baseRevision + 1, updatedAt: at };
    }
    return { saved: false, current: await this.find(userId) };
  }
};

// server/src/infrastructure/postgres/stores.ts
var postgresStores = (db) => ({
  users: new PostgresUserRepository(db),
  sessions: new PostgresSessionRepository(db),
  workspaces: new PostgresWorkspaceRepository(db)
});

// server/src/vercel.ts
var REGISTRATION = process.env.HANZI_REGISTRATION === "closed" ? "closed" : "open";
var building = null;
function application() {
  if (building) return building;
  const started = (async () => {
    const url = databaseUrl();
    if (!url) {
      throw new Error(
        "No database: set POSTGRES_URL (or DATABASE_URL) on the Vercel project, then redeploy."
      );
    }
    const pool2 = await openPostgres(url);
    const services = createServices(postgresStores(pool2), {
      policy: { registration: REGISTRATION }
    });
    return createHttpApp(services, {
      trustProxy: true,
      staticDir: null,
      // Vercel compresses what it sends; a second pass here would only cost
      // the function time it is billed for.
      compress: false,
      log: (line) => console.error(line)
    });
  })();
  building = started;
  started.catch(() => {
    if (building === started) building = null;
  });
  return started;
}
async function asSent(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("__path");
  if (path === null) return request;
  url.searchParams.delete("__path");
  url.pathname = `/api/${path}`;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : void 0
  });
}
function failed(what, err, status) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`${what}: ${message}`);
  return Response.json({ error: { code: "internal", message: `${what}. ${message}` } }, { status });
}
var vercel_default = getRequestListener(async (incoming) => {
  let request;
  try {
    request = await asSent(incoming);
  } catch (err) {
    return failed("Could not read the request", err, 500);
  }
  const asked = new URL(request.url);
  if (asked.pathname === "/api/health") {
    if (asked.searchParams.get("db") === "1") {
      const started = Date.now();
      try {
        const dsn = databaseUrl();
        if (!dsn) throw new Error("no POSTGRES_URL or DATABASE_URL");
        const pool2 = await openPostgres(dsn);
        const { rows } = await pool2.query("SELECT 1 AS one");
        return Response.json({ ok: true, ms: Date.now() - started, rows });
      } catch (err) {
        return Response.json(
          {
            ok: false,
            ms: Date.now() - started,
            error: err instanceof Error ? err.message : String(err)
          },
          { status: 503 }
        );
      }
    }
    return Response.json({
      ok: true,
      database: process.env.POSTGRES_URL ? "POSTGRES_URL" : process.env.DATABASE_URL ? "DATABASE_URL" : null,
      node: process.version
    });
  }
  let app;
  try {
    app = await application();
  } catch (err) {
    return failed("The server could not start", err, 503);
  }
  try {
    return await app.fetch(request);
  } catch (err) {
    return failed("The server failed on that request", err, 500);
  }
});
export {
  vercel_default as default
};
