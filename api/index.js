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
var TutorUnavailableError = class extends AppError {
  constructor(message) {
    super("unavailable", message);
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
  /**
   * A session for the named account with no password asked.
   *
   * Only the development server calls this, and only when HANZI_DEV_USER is
   * set, so the app can be opened and checked on this machine without signing
   * in. Nothing that serves the app to anyone else ever reaches it.
   *
   * `create` says whether a name nobody has is worth an account — true of the
   * SQLite file on this machine, where making one costs nothing and is how the
   * first one appears, and false of the deployed site's database, where a name
   * that is not already there is a typo rather than a learner. Without it,
   * there is no session and the app asks to sign in as it would anywhere else.
   */
  async devSignIn(username, userAgent, create = true) {
    const key = usernameKey(username);
    let user = await this.deps.users.findByUsernameKey(key);
    if (!user) {
      if (!create) return null;
      try {
        user = await this.createUser(username, this.deps.tokens.secret());
      } catch (err) {
        if (!(err instanceof UsernameTakenError)) throw err;
        user = await this.deps.users.findByUsernameKey(key);
        if (!user) throw err;
      }
    }
    return this.issue(user, userAgent);
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

// shared/talk.ts
var TALK_LEVELS = ["hsk1", "hsk2", "hsk3"];
var TALK_LENGTHS = ["short", "normal", "long"];
var TALK_MODES = ["breakdown", "teaching", "conversation", "skim"];
var TALK_TOPIC_MAX_CHARS = 60;
var TALK_MAX_LINES = 40;
var TALK_LINE_MAX_CHARS = 300;
var TALK_TITLE_MAX_CHARS = 80;
var TALK_SAVED_TURNS_MAX = 400;
function conversationTitle(options, turns) {
  const opening = turns.find((t) => t.who === "tutor");
  const raw = options.topic.trim() || opening?.hanzi.trim() || "";
  if (!raw) return "New conversation";
  const cut = [...raw].slice(0, TALK_TITLE_MAX_CHARS);
  return cut.length < [...raw].length ? `${cut.join("")}\u2026` : cut.join("");
}

// server/src/application/conversation-service.ts
var LIST_LIMIT = 60;
var ConversationService = class {
  conversations;
  clock;
  tokens;
  constructor(deps) {
    this.conversations = deps.conversations;
    this.clock = deps.clock;
    this.tokens = deps.tokens;
  }
  list(userId) {
    return this.conversations.list(userId, LIST_LIMIT);
  }
  async open(userId, id) {
    const found = await this.conversations.find(userId, id);
    if (!found) throw new NotFoundError("That conversation");
    return found;
  }
  async start(userId, options, voice) {
    const now = this.clock.now();
    return this.conversations.create(userId, {
      id: this.tokens.id(),
      title: conversationTitle(options, []),
      options,
      voice,
      turns: [],
      createdAt: now,
      updatedAt: now
    });
  }
  /**
   * The conversation as the page now has it. The page is the only writer — one
   * learner, one thread, in one tab at a time — so the last save wins rather
   * than being compared against a revision, as the workspace is.
   */
  async save(userId, id, patch) {
    const existing = await this.open(userId, id);
    const turns = patch.turns.slice(-TALK_SAVED_TURNS_MAX);
    const next = {
      ...existing,
      options: patch.options,
      voice: patch.voice,
      turns,
      title: conversationTitle(patch.options, turns),
      updatedAt: this.clock.now()
    };
    if (!await this.conversations.save(userId, next)) throw new NotFoundError("That conversation");
    return next;
  }
  async remove(userId, id) {
    if (!await this.conversations.delete(userId, id)) throw new NotFoundError("That conversation");
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
  const conversations = new ConversationService({ conversations: stores.conversations, clock, tokens: cryptoTokens });
  return {
    auth,
    workspaces,
    conversations,
    clock,
    speech: options.speech ?? null,
    tutor: options.tutor ?? null,
    talkVoices: options.talkVoices ?? null
  };
}

// server/src/http/app.ts
import { Hono as Hono7 } from "hono";
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
  internal: 500,
  unavailable: 503
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

// server/src/http/routes/ask.ts
import { Hono } from "hono";
import { z } from "zod";

// shared/ask.ts
var ASK_KINDS = ["passages", "wordlist"];
var ASK_MAX_CHARS = 8e4;
var ASK_TIMEOUT_MS = {
  passages: 15 * 6e4,
  wordlist: 10 * 6e4
};

// server/src/http/routes/ask.ts
var askRequest = z.object({
  prompt: z.string().trim().min(1).max(ASK_MAX_CHARS),
  kind: z.enum(ASK_KINDS)
});
function askRoutes({ auth, clock, trustProxy, tutor }) {
  const routes = new Hono();
  const session = requireSession(auth, { trustProxy, clock });
  const asks = new RateLimiter(20, 60 * 6e4, clock);
  routes.get("/", session, async (c) => {
    c.header("Cache-Control", "no-store");
    const body = { claude: { state: tutor ? await tutor.status() : "missing" } };
    return c.json(body);
  });
  routes.post("/", session, async (c) => {
    if (!tutor) throw new TutorUnavailableError("Claude Code is not installed on this server.");
    const input = await readJson(c, askRequest);
    asks.consume(c.get("session").user.id);
    const text = await tutor.ask(input.prompt, { timeoutMs: ASK_TIMEOUT_MS[input.kind] });
    const body = { text };
    c.header("Cache-Control", "no-store");
    return c.json(body);
  });
  return routes;
}

// server/src/http/routes/auth.ts
import { Hono as Hono2 } from "hono";
import { z as z2 } from "zod";
var MINUTE = 6e4;
var credentials = z2.object({
  username: z2.string().max(200),
  password: z2.string().max(2048)
});
var passwordChange = z2.object({
  currentPassword: z2.string().max(2048),
  newPassword: z2.string().max(2048)
});
function isLocalNetwork(ip) {
  const plain = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
  const octets = plain.split(".");
  if (octets.length === 4) {
    if (!octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255)) return false;
    const [a, b] = octets.map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return a === 169 && b === 254;
  }
  const v6 = (plain.split("%")[0] ?? "").toLowerCase();
  if (v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true;
  return /^fe[89ab]/.test(v6);
}
function authRoutes({ auth, clock, trustProxy, devUser, devUserCreate, log }) {
  const routes = new Hono2();
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
    if (!active && devUser && isLocalNetwork(clientIp(c, trustProxy))) {
      const issued = await auth.devSignIn(devUser, c.req.header("user-agent") ?? null, devUserCreate);
      if (!issued) log(`No account called \u201C${devUser}\u201D in this database (HANZI_DEV_USER).`);
      else {
        writeSessionCookie(c, issued.token, issued.expiresAt - clock.now(), isHttps(c, trustProxy));
        const body2 = { user: issued.user };
        return c.json(body2);
      }
    }
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

// server/src/http/routes/speech.ts
import { Hono as Hono3 } from "hono";
var SPEECH_MAX_CHARS = 240;
function speechRoutes({ auth, clock, trustProxy, speech }) {
  const routes = new Hono3();
  const session = requireSession(auth, { trustProxy, clock });
  const limiter = new RateLimiter(300, 10 * 6e4, clock);
  routes.get("/", session, (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ voices: speech?.voices ?? [] });
  });
  routes.get("/audio", session, async (c) => {
    if (!speech) {
      throw new AppError("not_found", "No natural voice is set up here: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set.");
    }
    const text = (c.req.query("text") ?? "").trim();
    const voice = c.req.query("voice") ?? speech.voices[0].id;
    const slow = c.req.query("slow") === "1";
    if (!text) throw new ValidationError("Nothing to say.");
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);
    if (!speech.voices.some((v) => v.id === voice)) throw new ValidationError(`There is no voice called ${voice}.`);
    limiter.consume(c.get("session").user.id);
    let audio;
    try {
      audio = await speech.synthesize(text, voice, slow);
    } catch {
      throw new AppError("internal", "The voice service did not answer. The system voice will have to do for now.");
    }
    c.header("Content-Type", "audio/mpeg");
    c.header("Cache-Control", "private, max-age=31536000, immutable");
    return c.body(audio);
  });
  return routes;
}

// server/src/http/routes/talk.ts
import { Hono as Hono4 } from "hono";
import { z as z3 } from "zod";
var talkOptions = z3.object({
  level: z3.enum(TALK_LEVELS),
  length: z3.enum(TALK_LENGTHS),
  explain: z3.boolean(),
  words: z3.boolean(),
  hints: z3.boolean(),
  // The learner's own words, and they go into a prompt: a topic the length
  // of an essay is a way of talking past everything above it.
  topic: z3.string().trim().max(TALK_TOPIC_MAX_CHARS)
});
var savedWord = z3.object({
  hanzi: z3.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z3.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z3.string().max(TALK_LINE_MAX_CHARS)
});
var savedTurn = z3.object({
  who: z3.enum(["tutor", "learner"]),
  hanzi: z3.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z3.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z3.string().max(TALK_LINE_MAX_CHARS * 2),
  words: z3.array(savedWord).max(10).optional(),
  hints: z3.array(savedWord).max(10).optional(),
  note: z3.string().max(TALK_LINE_MAX_CHARS * 2).optional()
});
var startRequest = z3.object({
  options: talkOptions,
  voice: z3.string().max(64).nullable()
});
var saveRequest = z3.object({
  options: talkOptions,
  voice: z3.string().max(64).nullable(),
  turns: z3.array(savedTurn).max(TALK_SAVED_TURNS_MAX)
});
var replyRequest = z3.object({
  lines: z3.array(z3.object({ who: z3.enum(["tutor", "learner"]), text: z3.string().trim().min(1).max(TALK_LINE_MAX_CHARS) })).max(TALK_MAX_LINES * 5),
  options: talkOptions
});
function talkRoutes({ auth, clock, trustProxy, tutor, talkVoices, conversations }) {
  const routes = new Hono4();
  const session = requireSession(auth, { trustProxy, clock });
  const turns = new RateLimiter(120, 10 * 6e4, clock);
  const clips = new RateLimiter(600, 10 * 6e4, clock);
  const saves = new RateLimiter(400, 10 * 6e4, clock);
  routes.get("/", session, async (c) => {
    c.header("Cache-Control", "no-store");
    talkVoices?.warm?.(c.req.query("voice"));
    const body = {
      claude: { state: tutor ? await tutor.status() : "missing" },
      voices: talkVoices?.voices ?? []
    };
    return c.json(body);
  });
  routes.post("/reply", session, async (c) => {
    if (!tutor) throw new TutorUnavailableError("Claude Code is not installed on this server.");
    const input = await readJson(c, replyRequest);
    turns.consume(c.get("session").user.id);
    const reply = await tutor.reply({ lines: input.lines, options: input.options });
    c.header("Cache-Control", "no-store");
    return c.json(reply);
  });
  routes.get("/audio", session, async (c) => {
    if (!talkVoices) throw new AppError("not_found", "No local voice is set up on this server.");
    const text = (c.req.query("text") ?? "").trim();
    const voice = c.req.query("voice") ?? talkVoices.voices[0].id;
    const asked = c.req.query("mode");
    const mode = TALK_MODES.includes(asked ?? "") ? asked : "conversation";
    if (!text) throw new ValidationError("Nothing to say.");
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);
    if (!talkVoices.voices.some((v) => v.id === voice)) throw new ValidationError(`There is no voice called ${voice}.`);
    clips.consume(c.get("session").user.id);
    let audio;
    try {
      audio = await talkVoices.synthesize(text, voice, mode);
    } catch {
      throw new AppError("unavailable", "The voice did not answer. The system voice will have to do for now.");
    }
    c.header("Content-Type", "audio/mpeg");
    c.header("Cache-Control", "private, max-age=31536000, immutable");
    return c.body(audio);
  });
  routes.get("/conversations", session, async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ conversations: await conversations.list(c.get("session").user.id) });
  });
  routes.post("/conversations", session, async (c) => {
    const input = await readJson(c, startRequest);
    saves.consume(c.get("session").user.id);
    const made = await conversations.start(c.get("session").user.id, input.options, input.voice);
    c.header("Cache-Control", "no-store");
    return c.json(made, 201);
  });
  routes.get("/conversations/:id", session, async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await conversations.open(c.get("session").user.id, c.req.param("id")));
  });
  routes.put("/conversations/:id", session, async (c) => {
    const input = await readJson(c, saveRequest);
    saves.consume(c.get("session").user.id);
    const saved = await conversations.save(c.get("session").user.id, c.req.param("id"), {
      options: input.options,
      voice: input.voice,
      turns: input.turns
    });
    c.header("Cache-Control", "no-store");
    return c.json(saved);
  });
  routes.delete("/conversations/:id", session, async (c) => {
    await conversations.remove(c.get("session").user.id, c.req.param("id"));
    return c.body(null, 204);
  });
  return routes;
}

// server/src/http/routes/workspace.ts
import { Hono as Hono5 } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z as z4 } from "zod";

// shared/api.ts
var WORKSPACE_MAX_BYTES = 16 * 1024 * 1024;
var workspaceTag = (revision) => `"r${revision}"`;

// server/src/http/routes/workspace.ts
var saveRequest2 = z4.object({
  baseRevision: z4.number().int().min(0),
  document: z4.record(z4.string(), z4.unknown())
});
function workspaceRoutes({ auth, workspaces, clock, trustProxy }) {
  const routes = new Hono5();
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
      const input = await readJson(c, saveRequest2);
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
import { Hono as Hono6 } from "hono";
function staticSite(root) {
  const site = new Hono6();
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
  const deps = {
    ...services,
    trustProxy: options.trustProxy,
    devUser: options.devUser ?? null,
    devUserCreate: options.devUserCreate ?? true,
    log: options.log
  };
  const api = new Hono7();
  api.onError(onError);
  api.use("*", sameOriginOnly());
  api.get("/health", (c) => c.json({ ok: true }));
  api.route("/auth", authRoutes(deps));
  api.route("/ask", askRoutes(deps));
  api.route("/workspace", workspaceRoutes(deps));
  api.route("/speech", speechRoutes(deps));
  api.route("/talk", talkRoutes(deps));
  api.all("*", () => {
    throw new NotFoundError("That API route");
  });
  const app = new Hono7();
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

// server/src/infrastructure/azure-speech.ts
var AZURE_VOICES = [
  { id: "xiaoxiao", name: "Xiaoxiao", gender: "female", azure: "zh-CN-XiaoxiaoNeural" },
  { id: "yunxi", name: "Yunxi", gender: "male", azure: "zh-CN-YunxiNeural" },
  { id: "xiaoyi", name: "Xiaoyi", gender: "female", azure: "zh-CN-XiaoyiNeural" }
];
var SpeechServiceError = class extends Error {
};
var escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
function azureSpeech(opts) {
  if (!/^[a-z0-9]+$/.test(opts.region)) throw new Error(`AZURE_SPEECH_REGION \u201C${opts.region}\u201D is not a region name.`);
  const endpoint = `https://${opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const doFetch = opts.fetch ?? fetch;
  return {
    voices: AZURE_VOICES.map(({ id, name, gender }) => ({ id, name, gender })),
    async synthesize(text, voice, slow) {
      const v = AZURE_VOICES.find((x) => x.id === voice);
      if (!v) throw new SpeechServiceError(`No voice called ${voice}.`);
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="${v.azure}"><prosody rate="${slow ? "-25%" : "0%"}">${escapeXml(text)}</prosody></voice></speak>`;
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": opts.key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "hanzi-workshop"
        },
        body: ssml,
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) {
        throw new SpeechServiceError(`Azure speech answered ${res.status}.`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }
  };
}
function speechFromEnv(env) {
  const key = env.AZURE_SPEECH_KEY?.trim();
  const region = env.AZURE_SPEECH_REGION?.trim().toLowerCase();
  if (!key || !region) return null;
  return azureSpeech({ key, region });
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

// server/src/infrastructure/postgres/conversation-repository.ts
var PostgresConversationRepository = class {
  constructor(db) {
    this.db = db;
  }
  async list(userId, limit) {
    const { rows } = await this.db.query(
      `SELECT id, title, options, turns, updated_at FROM conversations
       WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT $2`,
      [userId, limit]
    );
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      level: JSON.parse(row.options).level,
      turns: JSON.parse(row.turns).length,
      updatedAt: row.updated_at
    }));
  }
  async find(userId, id) {
    const { rows } = await this.db.query("SELECT * FROM conversations WHERE id = $1 AND user_id = $2", [
      id,
      userId
    ]);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      options: JSON.parse(row.options),
      voice: row.voice,
      turns: JSON.parse(row.turns),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  async create(userId, conversation) {
    await this.db.query(
      `INSERT INTO conversations (id, user_id, title, options, voice, turns, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        conversation.id,
        userId,
        conversation.title,
        JSON.stringify(conversation.options),
        conversation.voice,
        JSON.stringify(conversation.turns),
        conversation.createdAt,
        conversation.updatedAt
      ]
    );
    return conversation;
  }
  async save(userId, conversation) {
    const result = await this.db.query(
      `UPDATE conversations SET title = $1, options = $2, voice = $3, turns = $4, updated_at = $5
       WHERE id = $6 AND user_id = $7`,
      [
        conversation.title,
        JSON.stringify(conversation.options),
        conversation.voice,
        JSON.stringify(conversation.turns),
        conversation.updatedAt,
        conversation.id,
        userId
      ]
    );
    return result.rowCount === 1;
  }
  async delete(userId, id) {
    const result = await this.db.query("DELETE FROM conversations WHERE id = $1 AND user_id = $2", [id, userId]);
    return result.rowCount === 1;
  }
};

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
  workspaces: new PostgresWorkspaceRepository(db),
  conversations: new PostgresConversationRepository(db)
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
      policy: { registration: REGISTRATION },
      speech: speechFromEnv(process.env)
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
