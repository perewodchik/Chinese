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
var OutdatedAppError = class extends AppError {
  constructor() {
    super(
      "outdated_app",
      "This page is an older version of the app. Reload it to keep saving \u2014 nothing done here is lost."
    );
  }
};
var RevisionConflictError = class extends AppError {
  current;
  constructor(current) {
    super("conflict", "This workspace was saved from somewhere else in the meantime.");
    this.current = current;
  }
};
var WorldConflictError = class extends AppError {
  current;
  constructor(current) {
    super("conflict", "This game was saved from somewhere else in the meantime.");
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

// shared/personas.ts
var CLEAR = "Keep your sentences short and simple, and your words everyday: the learner has to follow you by ear.";
var PERSONAS = [
  {
    id: "chen",
    name: "Chen",
    zh: "\u9648",
    gender: "male",
    pace: 0.8,
    blurb: "A patient young man who speaks slowly and warmly, so you can catch every word.",
    character: `Chen, a very patient, gentle young man in his late twenties. You talk slowly and calmly, like a good friend who has slowed down on purpose so the learner can follow every word. You never rush them, you reassure rather than cheer, and when they struggle you say there is no hurry. Use the shortest, simplest sentences you can. ${CLEAR}`
  },
  {
    id: "wang",
    name: "Teacher Wang",
    zh: "\u738B\u8001\u5E08",
    gender: "female",
    blurb: "A warm, experienced teacher with textbook-clear standard Mandarin.",
    character: `Teacher Wang, an experienced and warm Mandarin teacher in her forties. You speak very clear, standard Mandarin, are kind and steady, and model good sentences without lecturing. ${CLEAR}`
  },
  {
    id: "xiaoyu",
    name: "Xiaoyu",
    zh: "\u5C0F\u96E8",
    gender: "female",
    blurb: "A university student your own age: natural, friendly, relaxed.",
    character: `Xiaoyu, a friendly university student around twenty, relaxed and natural, like a classmate. You chat about everyday student life. Friendly, but not loud or over-excited. ${CLEAR}`
  },
  {
    id: "zhiyuan",
    name: "Zhiyuan",
    zh: "\u5FD7\u8FDC",
    gender: "male",
    blurb: "A radio host\u2019s voice: rich, very standard and very clear, telling everyday stories.",
    character: `Zhiyuan, a radio host in his mid-thirties who tells everyday stories on air. Your Mandarin is very standard and very clear, your tone warm and patient. You like to share a small story and ask the learner about theirs. ${CLEAR}`
  },
  {
    id: "wei",
    name: "Wei",
    zh: "\u8001\u9B4F",
    gender: "male",
    blurb: "Runs a small restaurant: warm, down to earth, happiest talking about food.",
    character: `Wei, a warm, down-to-earth man around forty who runs a small family restaurant. You love talking about food, cooking and family life, and you talk plainly, like a friendly older brother. ${CLEAR}`
  }
];

// shared/talk.ts
var TALK_LEVELS = ["hsk1", "hsk2", "hsk3"];
var TALK_LENGTHS = ["short", "normal", "long"];
var TALK_MODES = ["breakdown", "teaching", "conversation", "skim"];
var TALK_TOPIC_MAX_CHARS = 60;
var TALK_VOCAB_MAX = { known: 1e3, learning: 15 };
var TALK_RECORDED_MAX = 400;
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

// shared/narration.ts
var EMOTIONS = ["calm", "happy", "sad", "surprised", "angry", "fearful"];
var SPEED_RANGE = [0.5, 2];
var PITCH_RANGE = [-12, 12];
var narratorRecordingId = (narrator) => `mm-${narrator.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 64);
var SOUNDS = [
  [/哈哈|大笑/, "(laughs)"],
  [/笑/, "(chuckle)"],
  [/叹气/, "(sighs)"],
  [/打喷嚏|阿嚏/, "(sneezes)"],
  [/咳/, "(coughs)"]
];
function soundOf(zh) {
  for (const [re, tag] of SOUNDS) if (re.test(zh)) return tag;
  return null;
}

// server/src/infrastructure/minimax.ts
var BASE = "https://api.minimax.io/v1";
var NarratorRefused = class extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
  }
};
function refusal(base, status) {
  const code = base?.status_code ?? status;
  const msg = base?.status_msg ?? `HTTP ${status}`;
  if (code === 1004 || code === 2049 || status === 401) return new NarratorRefused("MiniMax did not accept the key.", "key");
  if (code === 1008 || /balance|insufficient/i.test(msg)) return new NarratorRefused("The MiniMax account has no balance left for the API.", "balance");
  if (code === 1002 || status === 429) return new NarratorRefused("MiniMax asked to slow down. Try again in a minute.", "busy");
  return new NarratorRefused(`MiniMax said: ${msg}`, "other");
}
function minimaxNarrator(fetcher = fetch) {
  const post = async (path, key, body) => {
    const res = await fetcher(`${BASE}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || (json.base_resp?.status_code ?? 0) !== 0) throw refusal(json?.base_resp, res.status);
    return json;
  };
  return {
    async voices(key) {
      const out = await post("/get_voice", key, { voice_type: "system" });
      return (out.system_voice ?? []).filter((v) => /^Chinese \(Mandarin\)/.test(v.voice_id)).map((v) => ({ id: v.voice_id, name: v.voice_name || v.voice_id.replace(/^Chinese \(Mandarin\)_/, "").replace(/_/g, " "), description: (v.description ?? []).join(" ") }));
    },
    async design(key, prompt, previewText) {
      const out = await post("/voice_design", key, { prompt, preview_text: previewText });
      if (!out.voice_id) throw new NarratorRefused("MiniMax made no voice from that description.", "other");
      return { voiceId: out.voice_id, trial: new Uint8Array(Buffer.from(out.trial_audio ?? "", "hex")) };
    },
    async read(key, text, voice, tuning) {
      const out = await post("/t2a_v2", key, {
        model: "speech-2.8-hd",
        text,
        stream: false,
        language_boost: "Chinese",
        voice_setting: { voice_id: voice, speed: tuning.speed, vol: 1, pitch: tuning.pitch, ...tuning.emotion ? { emotion: tuning.emotion } : {} },
        audio_setting: { sample_rate: 32e3, bitrate: 64e3, format: "mp3", channel: 1 }
      });
      const hex = out.data?.audio;
      if (!hex) throw new NarratorRefused("MiniMax sent no audio back.", "other");
      return new Uint8Array(Buffer.from(hex, "hex"));
    }
  };
}

// server/src/application/narration-service.ts
var KEY = "minimax";
var clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
var NarrationService = class {
  constructor(deps) {
    this.deps = deps;
  }
  voiceCache = /* @__PURE__ */ new Map();
  /* ------------------------------------------------------------ the key */
  async status(userId) {
    const key = await this.deps.secrets.get(userId, KEY);
    return { key: { set: Boolean(key), hint: key ? `\u2026${key.slice(-4)}` : null } };
  }
  async setKey(userId, raw) {
    const key = raw.trim();
    if (key.length < 16 || /\s/.test(key)) throw new ValidationError("That does not look like a MiniMax API key.", { key: "Not a key." });
    await this.voicesFor(key, true);
    await this.deps.secrets.set(userId, KEY, key, this.deps.clock.now());
    return this.status(userId);
  }
  async deleteKey(userId) {
    await this.deps.secrets.delete(userId, KEY);
    return this.status(userId);
  }
  /** MiniMax's own Mandarin voices. */
  async voices(userId) {
    return this.voicesFor(await this.keyOf(userId));
  }
  /* ------------------------------------------------------- the narrators */
  async narrators(userId) {
    return (await this.deps.narrators.list(userId)).map(toDto);
  }
  /** A narrator with a new voice made from a description, and the preview sentence read in it. */
  async design(userId, input) {
    const key = await this.keyOf(userId);
    const name = input.name.trim();
    const prompt = input.prompt.trim();
    const previewText = input.previewText.trim();
    if (!name) throw new ValidationError("Give the voice a name.", { name: "A name." });
    if (prompt.length < 10) throw new ValidationError("Describe the voice in a sentence or two.", { prompt: "Too short." });
    if (!previewText) throw new ValidationError("A sentence for it to read first.", { previewText: "A sentence." });
    const made = await this.call(() => this.narrator().design(key, prompt, previewText));
    const now = this.deps.clock.now();
    const record = {
      id: this.deps.tokens.id(),
      userId,
      name,
      kind: "designed",
      voiceId: made.voiceId,
      prompt,
      previewText,
      speed: 1,
      pitch: 0,
      emotion: null,
      createdAt: now,
      updatedAt: now
    };
    await this.deps.narrators.save(record);
    return { narrator: toDto(record), trial: made.trial };
  }
  /** A narrator with one of MiniMax's own voices. */
  async adopt(userId, input) {
    const key = await this.keyOf(userId);
    const voice = (await this.voicesFor(key)).find((v) => v.id === input.voice);
    if (!voice) throw new ValidationError(`MiniMax has no voice ${input.voice}.`);
    const now = this.deps.clock.now();
    const record = {
      id: this.deps.tokens.id(),
      userId,
      name: input.name.trim() || voice.name.replace(/\s*\((?:Female|Male)\)\s*/i, ""),
      kind: "system",
      voiceId: voice.id,
      prompt: voice.description,
      previewText: "",
      speed: 1,
      pitch: 0,
      emotion: null,
      createdAt: now,
      updatedAt: now
    };
    await this.deps.narrators.save(record);
    return toDto(record);
  }
  async change(userId, id, change) {
    const n = await this.find(userId, id);
    if (change.emotion !== void 0 && change.emotion !== null && !EMOTIONS.includes(change.emotion)) {
      throw new ValidationError(`An emotion is one of ${EMOTIONS.join(", ")}.`);
    }
    const next = {
      ...n,
      name: change.name?.trim() || n.name,
      speed: change.speed === void 0 ? n.speed : Math.round(clamp(change.speed, SPEED_RANGE) * 100) / 100,
      pitch: change.pitch === void 0 ? n.pitch : Math.round(clamp(change.pitch, PITCH_RANGE)),
      emotion: change.emotion === void 0 ? n.emotion : change.emotion,
      updatedAt: this.deps.clock.now()
    };
    await this.deps.narrators.save(next);
    return toDto(next);
  }
  async remove(userId, id) {
    if (!await this.deps.narrators.delete(userId, id)) throw new NotFoundError("That narrator");
  }
  /** A sentence read by the narrator as it is now; nothing kept. */
  async preview(userId, id, text) {
    const key = await this.keyOf(userId);
    const n = await this.find(userId, id);
    const line = text.trim() || n.previewText || "\u4F60\u597D\uFF0C\u6211\u4EEC\u4ECA\u5929\u4E00\u8D77\u8BFB\u4E00\u4E2A\u5C0F\u6545\u4E8B\u3002";
    return this.call(() => this.narrator().read(key, line, n.voiceId, tuningOf(n)));
  }
  /** One sentence of a text read by the narrator and kept; the id Listen offers it under. */
  async line(userId, narratorId, text) {
    const key = await this.keyOf(userId);
    const n = await this.find(userId, narratorId);
    const line = text.trim();
    if (!line) throw new ValidationError("Nothing to read.");
    const sound = soundOf(line);
    const mp32 = await this.call(() => this.narrator().read(key, sound ? `${line} ${sound}` : line, n.voiceId, tuningOf(n)));
    const id = narratorRecordingId(n.id);
    await this.deps.recordings.keep({ id, name: n.name, gender: "female" }, "teaching", line, mp32);
    return id;
  }
  /* ------------------------------------------------------------ helpers */
  async find(userId, id) {
    const n = await this.deps.narrators.find(userId, id);
    if (!n) throw new NotFoundError("That narrator");
    return n;
  }
  narrator() {
    if (!this.deps.narrator) throw new AppError("unavailable", "This server cannot reach MiniMax.");
    return this.deps.narrator;
  }
  async keyOf(userId) {
    const key = await this.deps.secrets.get(userId, KEY);
    if (!key) throw new AppError("not_found", "Add your MiniMax API key first.");
    return key;
  }
  async voicesFor(key, fresh = false) {
    const kept2 = this.voiceCache.get(key);
    if (kept2 && !fresh && this.deps.clock.now() - kept2.at < 36e5) return kept2.voices;
    const list = await this.call(() => this.narrator().voices(key));
    const voices = list.map((v) => ({ ...v, gender: genderOf(`${v.name} ${v.description}`) }));
    this.voiceCache.set(key, { at: this.deps.clock.now(), voices });
    return voices;
  }
  async call(fn) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof NarratorRefused) {
        if (err.reason === "key") throw new ValidationError(err.message, { key: "MiniMax did not accept it." });
        throw new AppError("unavailable", err.message);
      }
      if (err instanceof AppError) throw err;
      throw new AppError("unavailable", "MiniMax did not answer. Try again in a minute.");
    }
  }
};
var tuningOf = (n) => ({ speed: n.speed, pitch: n.pitch, emotion: n.emotion });
var toDto = (n) => ({
  id: n.id,
  name: n.name,
  kind: n.kind,
  voiceId: n.voiceId,
  prompt: n.prompt,
  previewText: n.previewText,
  speed: n.speed,
  pitch: n.pitch,
  emotion: EMOTIONS.includes(n.emotion ?? "") ? n.emotion : null,
  recordingId: narratorRecordingId(n.id),
  createdAt: n.createdAt
});
var genderOf = (s) => /\b(male|man|boy|gentleman|uncle|executive|lord)\b/i.test(s) && !/\b(female|woman|girl|lady)\b/i.test(s) ? "male" : "female";

// server/src/application/picture-service.ts
import { createHash } from "node:crypto";

// shared/api.ts
var PICTURE_TYPES = ["image/jpeg", "image/webp", "image/png"];
var PICTURE_MAX_BYTES = 2 * 1024 * 1024;
var WORKSPACE_MAX_BYTES = 16 * 1024 * 1024;
var workspaceTag = (revision) => `"r${revision}"`;

// server/src/application/picture-service.ts
var pictureKey = (bytes) => createHash("sha256").update(bytes).digest("hex");
var PictureService = class {
  constructor(deps) {
    this.deps = deps;
  }
  async put(userId, key, mime, bytes) {
    if (!PICTURE_TYPES.includes(mime)) {
      throw new ValidationError(`A picture is one of ${PICTURE_TYPES.join(", ")}.`);
    }
    if (!bytes.length) throw new ValidationError("The picture is empty.");
    if (bytes.length > PICTURE_MAX_BYTES) {
      throw new ValidationError(`A picture is at most ${Math.round(PICTURE_MAX_BYTES / 1024)} KB.`);
    }
    if (pictureKey(bytes) !== key) throw new ValidationError("The key is not the digest of this picture.");
    const kept2 = await this.deps.pictures.find(key);
    if (kept2 && kept2.userId !== userId) throw new ValidationError("That picture is kept under another account.");
    if (kept2) return;
    await this.deps.pictures.save({ key, userId, mime, bytes, createdAt: this.deps.clock.now() });
  }
  async get(userId, key) {
    const kept2 = /^[0-9a-f]{64}$/.test(key) ? await this.deps.pictures.find(key) : null;
    if (!kept2 || kept2.userId !== userId) throw new NotFoundError("That picture");
    return { mime: kept2.mime, bytes: kept2.bytes };
  }
};

// server/src/application/recording-service.ts
import { createHash as createHash2 } from "node:crypto";
var recordingKey = (voice, mode, text) => createHash2("sha256").update(`${voice}
${mode}
${text}`).digest("hex");
var RecordingService = class {
  constructor(deps) {
    this.deps = deps;
  }
  /**
   * The voices to offer. Where the models are on this machine, those: they
   * read anything. Elsewhere, the voices something has been recorded in,
   * marked as reading only what was recorded.
   */
  async voices() {
    const live = this.deps.live?.voices ?? [];
    if (live.length) return live;
    return (await this.deps.recordings.voices()).map((v) => ({ ...v, recorded: true }));
  }
  /**
   * One sentence as MP3: the recording if there is one, otherwise read now by
   * the model — and kept, when `keep` says it is a sentence of a text rather
   * than a turn of a conversation that will never be said again.
   */
  async read(text, voice, mode, keep) {
    const key = recordingKey(voice, mode, text);
    const kept2 = await this.deps.recordings.find(key);
    if (kept2) return kept2;
    const live = this.deps.live;
    if (!live) throw new AppError("not_found", "This sentence has not been recorded in that voice yet.");
    const info = live.voices.find((v) => v.id === voice);
    if (!info) throw new ValidationError(`There is no voice called ${voice}.`);
    let mp32;
    try {
      mp32 = await live.synthesize(text, voice, mode);
    } catch {
      throw new AppError("unavailable", "The voice did not answer. The system voice will have to do for now.");
    }
    if (keep) await this.deps.recordings.save({ key, voice: info, text, mp3: mp32, createdAt: this.deps.clock.now() });
    return mp32;
  }
  /**
   * A sentence someone recorded elsewhere — read by a voice service on its
   * own site and cut out of the whole passage — kept as this voice's reading
   * of it, in place of any reading kept before.
   */
  async keep(voice, mode, text, mp32) {
    const line = text.trim();
    if (!line) throw new ValidationError("Which sentence is this a recording of?");
    if (!/^[a-z0-9-]{2,64}$/.test(voice.id)) throw new ValidationError("A voice is named in lower-case letters, digits and dashes.");
    if (mp32.length < 200) throw new ValidationError("The recording is empty.");
    await this.deps.recordings.replace({ key: recordingKey(voice.id, mode, line), voice, text: line, mp3: mp32, createdAt: this.deps.clock.now() });
  }
  /** For each sentence, whether it has been recorded in this voice. */
  async have(voice, mode, texts) {
    const keys = texts.map((t) => recordingKey(voice, mode, t.trim()));
    const kept2 = await this.deps.recordings.have([...new Set(keys)]);
    return keys.map((k) => kept2.has(k));
  }
  /**
   * Records every sentence of these passages that is not recorded in this
   * voice yet. One at a time, as the model reads about as fast as it speaks:
   * a shelf of texts is minutes. Says how far it has got after each passage.
   */
  async recordAll(passages, voice, say) {
    let recorded = 0;
    let already = 0;
    for (const p of passages) {
      const lines = [...new Set(p.lines.map((l) => l.trim()).filter(Boolean))];
      const have = await this.have(voice, "teaching", lines);
      const missing = lines.filter((_, i) => !have[i]);
      already += lines.length - missing.length;
      for (const line of missing) {
        await this.read(line, voice, "teaching", true);
        recorded += 1;
      }
      say(`${p.title}: ${missing.length ? `${missing.length} of ${lines.length} sentences recorded` : "recorded already"}`);
    }
    return { recorded, already };
  }
};

// server/src/application/workspace-service.ts
var toDto2 = (w) => w ? { revision: w.revision, document: w.document, updatedAt: w.updatedAt } : { revision: 0, document: null, updatedAt: null };
var WorkspaceService = class {
  constructor(deps) {
    this.deps = deps;
  }
  async get(userId) {
    return toDto2(await this.deps.workspaces.find(userId));
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
    const current = write.current;
    if (current && current.revision === baseRevision && versionOf(current.document) > document.version) {
      throw new OutdatedAppError();
    }
    throw new RevisionConflictError(toDto2(current));
  }
};
function isDocument(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const version = v.version;
  return typeof version === "number" && Number.isInteger(version) && version > 0;
}
function versionOf(document) {
  const version = document?.version;
  return typeof version === "number" ? version : 0;
}

// server/src/application/world-service.ts
var toDto3 = (w) => w ? { revision: w.revision, save: w.save, updatedAt: w.updatedAt } : { revision: 0, save: null, updatedAt: null };
var WorldService = class {
  constructor(deps) {
    this.deps = deps;
  }
  async get(userId) {
    return toDto3(await this.deps.saves.find(userId));
  }
  revision(userId) {
    return this.deps.saves.revisionOf(userId);
  }
  async save(userId, baseRevision, save) {
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new ValidationError("The base revision has to be a whole number, 0 or more.", { baseRevision: "Not a revision." });
    }
    if (!isSave(save)) {
      throw new ValidationError("A game save is a JSON object carrying its format version.", { save: "Not a game save." });
    }
    const write = await this.deps.saves.save(userId, baseRevision, save, this.deps.clock.now());
    if (write.saved) return { revision: write.revision, updatedAt: write.updatedAt };
    const current = write.current;
    if (current && current.revision === baseRevision && versionOf2(current.save) > save.version) {
      throw new OutdatedAppError();
    }
    throw new WorldConflictError(toDto3(current));
  }
};
function isSave(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const version = v.version;
  return typeof version === "number" && Number.isInteger(version) && version > 0;
}
function versionOf2(save) {
  const version = save?.version;
  return typeof version === "number" ? version : 0;
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
import { createHash as createHash3, randomBytes as randomBytes2, randomUUID } from "node:crypto";
var cryptoTokens = {
  // 256 bits: not something to guess, and base64url so it needs no escaping in a cookie.
  secret: () => randomBytes2(32).toString("base64url"),
  digest: (secret) => createHash3("sha256").update(secret).digest("base64url"),
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
  const world = new WorldService({ saves: stores.worldSaves, clock });
  const recordings = new RecordingService({ recordings: stores.recordings, live: options.talkVoices ?? null, clock });
  const conversations = new ConversationService({ conversations: stores.conversations, clock, tokens: cryptoTokens });
  return {
    auth,
    workspaces,
    world,
    conversations,
    clock,
    speech: options.speech ?? null,
    tutor: options.tutor ?? null,
    talkVoices: options.talkVoices ?? null,
    recordings,
    pictures: new PictureService({ pictures: stores.pictures, clock }),
    narration: new NarrationService({ secrets: stores.secrets, narrators: stores.narrators, tokens: cryptoTokens, narrator: options.narrator === void 0 ? minimaxNarrator() : options.narrator, recordings, clock })
  };
}

// server/src/http/app.ts
import { Hono as Hono12 } from "hono";
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
  outdated_app: 409,
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
    if (err instanceof WorldConflictError) {
      const body = { error: { code: "conflict", message: err.message }, current: err.current };
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
import { createHash as createHash4 } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";

// shared/ask.ts
var ASK_KINDS = ["passages", "wordlist", "check", "video"];
var ASK_MAX_CHARS = 8e4;
var ASK_TIMEOUT_MS = {
  passages: 15 * 6e4,
  wordlist: 10 * 6e4,
  // One answer to one question: a reader is sitting there waiting for it.
  check: 3 * 6e4,
  // A study pack for a part of a video: a page of notes, questions and words.
  video: 6 * 6e4
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
  const checks = new RateLimiter(120, 60 * 6e4, clock);
  routes.get("/", session, async (c) => {
    c.header("Cache-Control", "no-store");
    const body = { claude: { state: tutor ? await tutor.status() : "missing" } };
    return c.json(body);
  });
  const kept2 = /* @__PURE__ */ new Map();
  const KEEP_MS = 60 * 6e4;
  routes.post("/", session, async (c) => {
    if (!tutor) throw new TutorUnavailableError("Claude Code is not installed on this server.");
    const input = await readJson(c, askRequest);
    const user = c.get("session").user.id;
    const run = () => tutor.ask(input.prompt, { timeoutMs: ASK_TIMEOUT_MS[input.kind] });
    let text;
    if (input.kind === "video") {
      const key = createHash4("sha256").update(`${user}
${input.prompt}`).digest("hex");
      const now = clock.now();
      for (const [k, v] of kept2) if (now - v.at > KEEP_MS) kept2.delete(k);
      let entry = kept2.get(key);
      if (!entry) {
        asks.consume(user);
        entry = { at: now, answer: run() };
        kept2.set(key, entry);
        entry.answer.catch(() => kept2.delete(key));
      }
      text = await entry.answer;
    } else {
      (input.kind === "check" ? checks : asks).consume(user);
      text = await run();
    }
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

// server/src/http/routes/narration.ts
import { Hono as Hono3 } from "hono";
import { z as z3 } from "zod";
var keyRequest = z3.object({ key: z3.string().min(1).max(400) });
var lineRequest = z3.object({ narrator: z3.string().min(1).max(80), text: z3.string().trim().min(1).max(240), again: z3.boolean().optional() });
var designRequest = z3.object({ name: z3.string().trim().min(1).max(60), prompt: z3.string().trim().min(1).max(2e3), previewText: z3.string().trim().min(1).max(200) });
var adoptRequest = z3.object({ name: z3.string().max(60), voice: z3.string().min(1).max(120) });
var changeRequest = z3.object({
  name: z3.string().trim().min(1).max(60).optional(),
  speed: z3.number().min(0.5).max(2).optional(),
  pitch: z3.number().min(-12).max(12).optional(),
  emotion: z3.enum(EMOTIONS).nullable().optional()
});
var previewRequest = z3.object({ text: z3.string().max(200) });
var mp3 = (c, bytes) => {
  c.header("Content-Type", "audio/mpeg");
  c.header("Cache-Control", "no-store");
  return c.body(bytes);
};
function narrationRoutes({ auth, clock, trustProxy, narration }) {
  const routes = new Hono3();
  const session = requireSession(auth, { trustProxy, clock });
  const lines = new RateLimiter(600, 10 * 6e4, clock);
  const keys = new RateLimiter(20, 10 * 6e4, clock);
  const makes = new RateLimiter(30, 10 * 6e4, clock);
  const user = (c) => c.get("session").user.id;
  const json = (c, body) => {
    c.header("Cache-Control", "no-store");
    return c.json(body);
  };
  routes.get("/", session, async (c) => json(c, await narration.status(user(c))));
  routes.put("/key", session, async (c) => {
    keys.consume(user(c));
    const { key } = await readJson(c, keyRequest);
    return json(c, await narration.setKey(user(c), key));
  });
  routes.delete("/key", session, async (c) => json(c, await narration.deleteKey(user(c))));
  routes.get("/voices", session, async (c) => json(c, { voices: await narration.voices(user(c)) }));
  routes.get("/narrators", session, async (c) => json(c, { narrators: await narration.narrators(user(c)) }));
  routes.post("/narrators/design", session, async (c) => {
    makes.consume(user(c));
    const input = await readJson(c, designRequest);
    const { narrator, trial } = await narration.design(user(c), input);
    return json(c, { narrator, trial: Buffer.from(trial).toString("base64") });
  });
  routes.post("/narrators", session, async (c) => {
    makes.consume(user(c));
    const input = await readJson(c, adoptRequest);
    return json(c, { narrator: await narration.adopt(user(c), input) });
  });
  routes.patch("/narrators/:id", session, async (c) => {
    const change = await readJson(c, changeRequest);
    return json(c, { narrator: await narration.change(user(c), c.req.param("id"), change) });
  });
  routes.delete("/narrators/:id", session, async (c) => {
    await narration.remove(user(c), c.req.param("id"));
    return json(c, { ok: true });
  });
  routes.post("/narrators/:id/preview", session, async (c) => {
    lines.consume(user(c));
    const { text } = await readJson(c, previewRequest);
    return mp3(c, await narration.preview(user(c), c.req.param("id"), text));
  });
  routes.post("/line", session, async (c) => {
    lines.consume(user(c));
    const input = await readJson(c, lineRequest);
    return json(c, { recordedAs: await narration.line(user(c), input.narrator, input.text) });
  });
  return routes;
}

// server/src/http/routes/pictures.ts
import { Hono as Hono4 } from "hono";
function pictureRoutes({ auth, clock, trustProxy, pictures }) {
  const routes = new Hono4();
  const session = requireSession(auth, { trustProxy, clock });
  const uploads = new RateLimiter(300, 10 * 6e4, clock);
  routes.get("/:key", session, async (c) => {
    const { mime, bytes } = await pictures.get(c.get("session").user.id, c.req.param("key"));
    c.header("Content-Type", mime);
    c.header("Cache-Control", "private, max-age=31536000, immutable");
    return c.body(bytes);
  });
  routes.put("/:key", session, async (c) => {
    const user = c.get("session").user.id;
    uploads.consume(user);
    const mime = (c.req.header("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    await pictures.put(user, c.req.param("key"), mime, bytes);
    c.header("Cache-Control", "no-store");
    return c.json({ ok: true });
  });
  return routes;
}

// server/src/http/routes/speech.ts
import { Hono as Hono5 } from "hono";
var SPEECH_MAX_CHARS = 240;
function speechRoutes({ auth, clock, trustProxy, speech }) {
  const routes = new Hono5();
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

// server/src/http/routes/strokes.ts
import { Hono as Hono6 } from "hono";

// shared/strokes.ts
var STROKES_PER_REQUEST = 24;

// server/src/infrastructure/stroke-outlines.ts
var SOURCE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/";
var TIMEOUT_MS = 1e4;
var kept = /* @__PURE__ */ new Map();
async function lookUpOutlines(chars, get2 = fetch) {
  const out = {};
  await Promise.all(
    chars.map(async (c) => {
      if (!kept.has(c)) {
        const found2 = await fetchOne(c, get2);
        if (found2 !== "failed") kept.set(c, found2);
      }
      const found = kept.get(c);
      if (found) out[c] = found;
    })
  );
  return out;
}
async function fetchOne(c, get2) {
  try {
    const r = await get2(SOURCE + encodeURIComponent(c) + ".json", { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (r.status === 404) return null;
    if (!r.ok) return "failed";
    const d = await r.json();
    if (!Array.isArray(d.strokes) || !d.strokes.every((s) => typeof s === "string")) return null;
    return { s: d.strokes, m: Array.isArray(d.medians) ? d.medians : void 0 };
  } catch {
    return "failed";
  }
}

// server/src/http/routes/strokes.ts
var HANZI = /^\p{Script=Han}$/u;
function strokeRoutes({ auth, clock, trustProxy }) {
  const routes = new Hono6();
  const session = requireSession(auth, { trustProxy, clock });
  routes.get("/", session, async (c) => {
    const chars = [.../* @__PURE__ */ new Set([...c.req.query("c") ?? ""])];
    if (!chars.length || chars.length > STROKES_PER_REQUEST || !chars.every((x) => HANZI.test(x))) {
      throw new ValidationError(`Ask for one to ${STROKES_PER_REQUEST} Chinese characters.`);
    }
    const body = { strokes: await lookUpOutlines(chars) };
    c.header("Cache-Control", "private, max-age=2592000, immutable");
    return c.json(body);
  });
  return routes;
}

// server/src/http/routes/talk.ts
import { Hono as Hono7 } from "hono";
import { z as z4 } from "zod";
var talkOptions = z4.object({
  level: z4.enum(TALK_LEVELS),
  length: z4.enum(TALK_LENGTHS),
  explain: z4.boolean(),
  words: z4.boolean(),
  hints: z4.boolean(),
  // The learner's own words, and they go into a prompt: a topic the length
  // of an essay is a way of talking past everything above it.
  topic: z4.string().trim().max(TALK_TOPIC_MAX_CHARS),
  persona: z4.string().max(64).optional()
});
var savedWord = z4.object({
  hanzi: z4.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z4.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z4.string().max(TALK_LINE_MAX_CHARS)
});
var savedTurn = z4.object({
  who: z4.enum(["tutor", "learner"]),
  hanzi: z4.string().max(TALK_LINE_MAX_CHARS),
  pinyin: z4.string().max(TALK_LINE_MAX_CHARS * 2),
  english: z4.string().max(TALK_LINE_MAX_CHARS * 2),
  words: z4.array(savedWord).max(10).optional(),
  hints: z4.array(savedWord).max(10).optional(),
  note: z4.string().max(TALK_LINE_MAX_CHARS * 2).optional()
});
var recordedRequest = z4.object({
  voice: z4.string().min(1).max(64),
  mode: z4.enum(TALK_MODES).optional(),
  texts: z4.array(z4.string().max(TALK_LINE_MAX_CHARS)).max(TALK_RECORDED_MAX)
});
var startRequest = z4.object({
  options: talkOptions,
  voice: z4.string().max(64).nullable()
});
var saveRequest = z4.object({
  options: talkOptions,
  voice: z4.string().max(64).nullable(),
  turns: z4.array(savedTurn).max(TALK_SAVED_TURNS_MAX)
});
var replyRequest = z4.object({
  lines: z4.array(z4.object({ who: z4.enum(["tutor", "learner"]), text: z4.string().trim().min(1).max(TALK_LINE_MAX_CHARS) })).max(TALK_MAX_LINES * 5),
  options: talkOptions,
  vocab: z4.object({
    known: z4.array(z4.string().max(12)).max(TALK_VOCAB_MAX.known),
    learning: z4.array(z4.string().max(12)).max(TALK_VOCAB_MAX.learning)
  }).optional()
});
function talkRoutes({ auth, clock, trustProxy, tutor, talkVoices, conversations, recordings }) {
  const routes = new Hono7();
  const session = requireSession(auth, { trustProxy, clock });
  const turns = new RateLimiter(120, 10 * 6e4, clock);
  const clips = new RateLimiter(600, 10 * 6e4, clock);
  const saves = new RateLimiter(400, 10 * 6e4, clock);
  routes.get("/", session, async (c) => {
    c.header("Cache-Control", "no-store");
    talkVoices?.warm?.(c.req.query("voice"));
    const body = {
      claude: { state: tutor ? await tutor.status() : "missing" },
      voices: await recordings.voices()
    };
    return c.json(body);
  });
  routes.post("/reply", session, async (c) => {
    if (!tutor) throw new TutorUnavailableError("Claude Code is not installed on this server.");
    const input = await readJson(c, replyRequest);
    turns.consume(c.get("session").user.id);
    const reply = await tutor.reply({
      lines: input.lines,
      options: input.options,
      ...input.vocab && { vocab: input.vocab }
    });
    c.header("Cache-Control", "no-store");
    return c.json(reply);
  });
  routes.get("/audio", session, async (c) => {
    const text = (c.req.query("text") ?? "").trim();
    const voice = c.req.query("voice") ?? talkVoices?.voices[0]?.id;
    const asked = c.req.query("mode");
    const mode = TALK_MODES.includes(asked ?? "") ? asked : "conversation";
    if (!voice) throw new AppError("not_found", "No local voice is set up on this server.");
    if (!text) throw new ValidationError("Nothing to say.");
    if ([...text].length > SPEECH_MAX_CHARS) throw new ValidationError(`At most ${SPEECH_MAX_CHARS} characters at a time.`);
    clips.consume(c.get("session").user.id);
    const audio = await recordings.read(text, voice, mode, c.req.query("keep") === "1");
    c.header("Content-Type", "audio/mpeg");
    c.header("Cache-Control", "private, max-age=31536000, immutable");
    return c.body(audio);
  });
  routes.post("/recorded", session, async (c) => {
    const input = await readJson(c, recordedRequest);
    c.header("Cache-Control", "no-store");
    const body = { have: await recordings.have(input.voice, input.mode ?? "teaching", input.texts) };
    return c.json(body);
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

// server/src/http/routes/videos.ts
import { Hono as Hono8 } from "hono";

// shared/videos.ts
var PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
var VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// server/src/infrastructure/youtube.ts
var YouTubeRefused = class extends Error {
};
var YouTubeNotFound = class extends Error {
};
var ANDROID = { clientName: "ANDROID", clientVersion: "20.10.38" };
var HEADERS = {
  "Accept-Language": "en-US,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
};
var TIMEOUT_MS2 = 15e3;
async function get(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS2) });
  if (res.status === 429 || res.status === 403) throw new YouTubeRefused(`YouTube answered ${res.status}.`);
  return res;
}
async function lookUpVideo(videoId) {
  const page = await (await get(`https://www.youtube.com/watch?v=${videoId}`, { headers: HEADERS })).text();
  if (page.includes('action="https://consent.youtube.com/s"')) throw new YouTubeRefused("YouTube asked for cookie consent.");
  if (page.includes('class="g-recaptcha"')) throw new YouTubeRefused("YouTube asked this server to prove it is a person.");
  const key = page.match(/"INNERTUBE_API_KEY":\s*"([A-Za-z0-9_-]+)"/)?.[1];
  if (!key) throw new YouTubeRefused("The watch page did not have what the player needs.");
  const res = await get(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: ANDROID }, videoId })
  });
  const player = await res.json();
  const status = player.playabilityStatus?.status;
  if (status === "ERROR") throw new YouTubeNotFound(player.playabilityStatus?.reason ?? "There is no such video.");
  if (status === "LOGIN_REQUIRED" && !player.videoDetails)
    throw new YouTubeRefused(player.playabilityStatus?.reason ?? "YouTube wanted a signed-in viewer.");
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const zh = pickChinese(tracks);
  const en = tracks.find((t) => t.languageCode.startsWith("en") && t.kind !== "asr") ?? tracks.find((t) => t.languageCode.startsWith("en"));
  const details = player.videoDetails ?? {};
  return {
    videoId,
    title: details.title ?? "",
    channel: details.author ?? "",
    seconds: Number(details.lengthSeconds ?? 0) || 0,
    description: (details.shortDescription ?? "").slice(0, 2e3),
    chinese: zh ? {
      source: zh.kind === "asr" ? "captions-auto" : "captions",
      language: zh.languageCode,
      cues: await cuesOf(zh)
    } : null,
    english: en ? await cuesOf(en) : null,
    languages: tracks.map((t) => t.kind === "asr" ? `${t.languageCode} (auto)` : t.languageCode)
  };
}
function pickChinese(tracks) {
  const zh = tracks.filter((t) => /^(zh|cmn)/i.test(t.languageCode));
  const made = zh.filter((t) => t.kind !== "asr");
  const rank = (t) => /hans|cn|sg/i.test(t.languageCode) ? 0 : /^(zh|cmn)$/i.test(t.languageCode) ? 1 : 2;
  return [...made].sort((a, b) => rank(a) - rank(b))[0] ?? zh[0];
}
async function cuesOf(track) {
  const xml = await (await get(track.baseUrl.replace("&fmt=srv3", ""), { headers: HEADERS })).text();
  return parseTimedText(xml);
}
function parseTimedText(xml) {
  const out = [];
  for (const m of xml.matchAll(/<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
    const at = Number(m[1]);
    const dur = Number(m[2] ?? 0);
    const text = decode(m[3].replace(/<[^>]+>/g, "")).trim();
    if (!text) continue;
    out.push({ at: round(at), end: round(at + dur), text });
  }
  return out;
}
var round = (n) => Math.round(n * 1e3) / 1e3;
function decode(s) {
  const once = (x) => x.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return once(once(s));
}
var lengthOf = (t) => typeof t === "string" && /^\d+(:\d+)+$/.test(t) ? t.split(":").reduce((a, p) => a * 60 + Number(p), 0) : 0;
function readItems(data) {
  const videos = [];
  let next = null;
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    const j = o;
    const old = j.playlistVideoRenderer;
    if (old && typeof old.videoId === "string") {
      const title = old.title?.runs?.[0]?.text;
      videos.push({ videoId: old.videoId, title: typeof title === "string" ? title : "", seconds: Number(old.lengthSeconds) || 0 });
      return;
    }
    const lockup = j.lockupViewModel;
    if (lockup && typeof lockup.contentId === "string" && String(lockup.contentType).includes("VIDEO")) {
      const title = lockup.metadata?.lockupMetadataViewModel?.title?.content;
      let badge = null;
      const findBadge = (x) => {
        if (badge || !x || typeof x !== "object") return;
        const b = x.thumbnailBadgeViewModel;
        if (b && typeof b.text === "string") badge = b.text;
        else for (const k in x) findBadge(x[k]);
      };
      findBadge(lockup.contentImage);
      videos.push({ videoId: lockup.contentId, title: typeof title === "string" ? title : "", seconds: lengthOf(badge) });
      return;
    }
    const token = j.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    if (typeof token === "string") next = token;
    for (const k in j) walk(j[k]);
  };
  walk(data);
  return { videos, next };
}
async function lookUpPlaylist(playlistId) {
  const page = await (await get(`https://www.youtube.com/playlist?list=${playlistId}`, { headers: HEADERS })).text();
  if (page.includes('action="https://consent.youtube.com/s"')) throw new YouTubeRefused("YouTube asked for cookie consent.");
  const raw = page.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
  if (!raw) throw new YouTubeRefused("The playlist page did not have its list in it.");
  const data = JSON.parse(raw);
  const title = data.metadata?.playlistMetadataRenderer?.title;
  const first = readItems(data);
  if (!first.videos.length && page.includes('"alerts"')) throw new YouTubeNotFound("That playlist is empty, private or gone.");
  const videos = [...first.videos];
  let next = first.next;
  const key = page.match(/"INNERTUBE_API_KEY":\s*"([A-Za-z0-9_-]+)"/)?.[1];
  const version = page.match(/"INNERTUBE_CLIENT_VERSION":\s*"([\d.]+)"/)?.[1];
  for (let pages = 0; next && key && version && pages < 5; pages++) {
    const res = await get(`https://www.youtube.com/youtubei/v1/browse?key=${key}`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: version } }, continuation: next })
    });
    const more = readItems(await res.json());
    videos.push(...more.videos);
    next = more.next;
  }
  const seen = /* @__PURE__ */ new Set();
  return {
    playlistId,
    title: typeof title === "string" ? title : "A playlist",
    videos: videos.filter((v) => !seen.has(v.videoId) && seen.add(v.videoId)),
    more: !!next
  };
}

// server/src/http/routes/videos.ts
function videoRoutes({ auth, clock, trustProxy, log }) {
  const routes = new Hono8();
  const session = requireSession(auth, { trustProxy, clock });
  const lookups = new RateLimiter(60, 60 * 6e4, clock);
  routes.get("/youtube/:id", session, async (c) => {
    const id = c.req.param("id");
    if (!VIDEO_ID.test(id)) throw new ValidationError("That is not a YouTube video id.");
    lookups.consume(c.get("session").user.id);
    let found;
    try {
      found = await lookUpVideo(id);
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError("not_found", err.message);
      const why = err instanceof Error ? err.message : String(err);
      log(`videos: YouTube lookup of ${id} failed: ${why}`);
      throw new AppError(
        "unavailable",
        err instanceof YouTubeRefused ? `YouTube would not give this server the captions (${why}). Paste the text instead, or add it from the home computer.` : `YouTube did not answer (${why}). Try again, or paste the text.`
      );
    }
    c.header("Cache-Control", "private, max-age=86400");
    return c.json(found);
  });
  routes.get("/playlist/:id", session, async (c) => {
    const id = c.req.param("id");
    if (!PLAYLIST_ID.test(id)) throw new ValidationError("That is not a YouTube playlist id.");
    lookups.consume(c.get("session").user.id);
    try {
      const found = await lookUpPlaylist(id);
      c.header("Cache-Control", "private, max-age=3600");
      return c.json(found);
    } catch (err) {
      if (err instanceof YouTubeNotFound) throw new AppError("not_found", err.message);
      const why = err instanceof Error ? err.message : String(err);
      log(`videos: YouTube playlist ${id} failed: ${why}`);
      throw new AppError("unavailable", `YouTube would not list that playlist here (${why}).`);
    }
  });
  return routes;
}

// server/src/http/routes/workspace.ts
import { Hono as Hono9 } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z as z5 } from "zod";
var saveRequest2 = z5.object({
  baseRevision: z5.number().int().min(0),
  document: z5.record(z5.string(), z5.unknown())
});
function workspaceRoutes({ auth, workspaces, clock, trustProxy }) {
  const routes = new Hono9();
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

// server/src/http/routes/world.ts
import { Hono as Hono10 } from "hono";
import { bodyLimit as bodyLimit2 } from "hono/body-limit";
import { z as z6 } from "zod";

// shared/world.ts
var WORLD_SAVE_MAX_BYTES = 512 * 1024;
var worldTag = (revision) => `"w${revision}"`;

// server/src/http/routes/world.ts
var putRequest = z6.object({
  baseRevision: z6.number().int().min(0),
  save: z6.record(z6.string(), z6.unknown())
});
function worldRoutes({ auth, world, clock, trustProxy }) {
  const routes = new Hono10();
  const session = requireSession(auth, { trustProxy, clock });
  routes.get("/", session, async (c) => {
    const userId = c.get("session").user.id;
    c.header("Cache-Control", "no-store");
    const known = c.req.header("if-none-match");
    if (known) {
      const tag = worldTag(await world.revision(userId));
      if (known.replace(/^W\//, "") === tag) {
        c.header("ETag", tag);
        return c.body(null, 304);
      }
    }
    const current = await world.get(userId);
    c.header("ETag", worldTag(current.revision));
    return c.json(current);
  });
  routes.put(
    "/",
    session,
    bodyLimit2({
      maxSize: WORLD_SAVE_MAX_BYTES,
      onError: (c) => c.json(errorBody("payload_too_large", "That game save is larger than the server keeps."), 413)
    }),
    async (c) => {
      const input = await readJson(c, putRequest);
      const saved = await world.save(c.get("session").user.id, input.baseRevision, input.save);
      return c.json(saved);
    }
  );
  return routes;
}

// server/src/http/static-site.ts
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono as Hono11 } from "hono";
function staticSite(root) {
  const site = new Hono11();
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
  const api = new Hono12();
  api.onError(onError);
  api.use("*", sameOriginOnly());
  api.get("/health", (c) => c.json({ ok: true }));
  api.route("/auth", authRoutes(deps));
  api.route("/ask", askRoutes(deps));
  api.route("/workspace", workspaceRoutes(deps));
  api.route("/world", worldRoutes(deps));
  api.route("/speech", speechRoutes(deps));
  api.route("/talk", talkRoutes(deps));
  api.route("/videos", videoRoutes(deps));
  api.route("/strokes", strokeRoutes(deps));
  api.route("/pictures", pictureRoutes(deps));
  api.route("/narration", narrationRoutes(deps));
  api.all("*", () => {
    throw new NotFoundError("That API route");
  });
  const app = new Hono12();
  app.onError(onError);
  if (options.compress !== false) app.use("*", compress());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Video thumbnails on the Videos shelf.
        imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        // The worksheet preview is the PDF itself, in a frame, from a blob; a
        // video being studied is YouTube's own player, in a frame.
        frameSrc: ["'self'", "blob:", "https://www.youtube-nocookie.com"],
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

// server/src/infrastructure/postgres/picture-repository.ts
var PostgresPictureRepository = class {
  constructor(db) {
    this.db = db;
  }
  async find(key) {
    const { rows } = await this.db.query(
      "SELECT user_id, mime, bytes, created_at FROM pictures WHERE key = $1",
      [key]
    );
    const row = rows[0];
    return row ? { key, userId: row.user_id, mime: row.mime, bytes: new Uint8Array(row.bytes), createdAt: Number(row.created_at) } : null;
  }
  async save(p) {
    await this.db.query(
      `INSERT INTO pictures (key, user_id, mime, bytes, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [p.key, p.userId, p.mime, Buffer.from(p.bytes), p.createdAt]
    );
  }
};

// server/src/infrastructure/sqlite/narrator-repository.ts
var narratorFromRow = (r) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  kind: r.kind === "system" ? "system" : "designed",
  voiceId: r.voice_id,
  prompt: r.prompt,
  previewText: r.preview_text,
  speed: Number(r.speed),
  pitch: Number(r.pitch),
  emotion: r.emotion,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at)
});

// server/src/infrastructure/postgres/narrator-repository.ts
var PostgresNarratorRepository = class {
  constructor(db) {
    this.db = db;
  }
  async list(userId) {
    const { rows } = await this.db.query("SELECT * FROM narrators WHERE user_id = $1 ORDER BY created_at", [userId]);
    return rows.map(narratorFromRow);
  }
  async find(userId, id) {
    const { rows } = await this.db.query("SELECT * FROM narrators WHERE user_id = $1 AND id = $2", [userId, id]);
    return rows[0] ? narratorFromRow(rows[0]) : null;
  }
  async save(n) {
    await this.db.query(
      `INSERT INTO narrators (id, user_id, name, kind, voice_id, prompt, preview_text, speed, pitch, emotion, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, voice_id = EXCLUDED.voice_id, prompt = EXCLUDED.prompt,
         preview_text = EXCLUDED.preview_text, speed = EXCLUDED.speed, pitch = EXCLUDED.pitch, emotion = EXCLUDED.emotion, updated_at = EXCLUDED.updated_at`,
      [n.id, n.userId, n.name, n.kind, n.voiceId, n.prompt, n.previewText, n.speed, n.pitch, n.emotion, n.createdAt, n.updatedAt]
    );
  }
  async delete(userId, id) {
    const r = await this.db.query("DELETE FROM narrators WHERE user_id = $1 AND id = $2", [userId, id]);
    return (r.rowCount ?? 0) > 0;
  }
};

// server/src/infrastructure/postgres/secret-repository.ts
var PostgresSecretRepository = class {
  constructor(db) {
    this.db = db;
  }
  async get(userId, name) {
    const { rows } = await this.db.query("SELECT value FROM user_secrets WHERE user_id = $1 AND name = $2", [userId, name]);
    return rows[0]?.value ?? null;
  }
  async set(userId, name, value, at) {
    await this.db.query(
      `INSERT INTO user_secrets (user_id, name, value, updated_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, name) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [userId, name, value, at]
    );
  }
  async delete(userId, name) {
    await this.db.query("DELETE FROM user_secrets WHERE user_id = $1 AND name = $2", [userId, name]);
  }
};

// server/src/infrastructure/postgres/recording-repository.ts
var PostgresRecordingRepository = class {
  constructor(db) {
    this.db = db;
  }
  async find(key) {
    const { rows } = await this.db.query("SELECT mp3 FROM recordings WHERE key = $1", [key]);
    const row = rows[0];
    return row ? new Uint8Array(row.mp3) : null;
  }
  async have(keys) {
    if (!keys.length) return /* @__PURE__ */ new Set();
    const { rows } = await this.db.query("SELECT key FROM recordings WHERE key = ANY($1::text[])", [[...keys]]);
    return new Set(rows.map((r) => r.key));
  }
  async save(r) {
    await this.db.query(
      `INSERT INTO recordings (key, voice, voice_name, gender, text, mp3, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO NOTHING`,
      [r.key, r.voice.id, r.voice.name, r.voice.gender, r.text, Buffer.from(r.mp3), r.createdAt]
    );
  }
  async replace(r) {
    await this.db.query(
      `INSERT INTO recordings (key, voice, voice_name, gender, text, mp3, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET voice_name = EXCLUDED.voice_name, gender = EXCLUDED.gender, mp3 = EXCLUDED.mp3, created_at = EXCLUDED.created_at`,
      [r.key, r.voice.id, r.voice.name, r.voice.gender, r.text, Buffer.from(r.mp3), r.createdAt]
    );
  }
  async voices() {
    const { rows } = await this.db.query(
      `SELECT voice, MIN(voice_name) AS voice_name, MIN(gender) AS gender
       FROM recordings GROUP BY voice ORDER BY voice`
    );
    return rows.map((r) => ({ id: r.voice, name: r.voice_name, gender: r.gender === "male" ? "male" : "female" }));
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
             WHERE user_id = $3 AND revision = $4
               AND COALESCE((document::jsonb ->> 'version')::int, 0) <= $5`,
      [json, at, userId, baseRevision, document.version]
    );
    if (result.rowCount === 1) {
      return { saved: true, revision: baseRevision + 1, updatedAt: at };
    }
    return { saved: false, current: await this.find(userId) };
  }
};

// server/src/infrastructure/postgres/world-save-repository.ts
var PostgresWorldSaveRepository = class {
  constructor(db) {
    this.db = db;
  }
  async find(userId) {
    const { rows } = await this.db.query("SELECT * FROM world_saves WHERE user_id = $1", [userId]);
    const row = rows[0];
    if (!row) return null;
    return { userId: row.user_id, revision: row.revision, save: JSON.parse(row.save), updatedAt: row.updated_at };
  }
  async revisionOf(userId) {
    const { rows } = await this.db.query("SELECT revision FROM world_saves WHERE user_id = $1", [userId]);
    return rows[0]?.revision ?? 0;
  }
  async save(userId, baseRevision, save, at) {
    const json = JSON.stringify(save);
    const result = baseRevision === 0 ? await this.db.query(
      `INSERT INTO world_saves (user_id, revision, save, updated_at)
             VALUES ($1, 1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
      [userId, json, at]
    ) : await this.db.query(
      `UPDATE world_saves
             SET save = $1, updated_at = $2, revision = revision + 1
             WHERE user_id = $3 AND revision = $4
               AND COALESCE((save::jsonb ->> 'version')::int, 0) <= $5`,
      [json, at, userId, baseRevision, save.version]
    );
    if (result.rowCount === 1) return { saved: true, revision: baseRevision + 1, updatedAt: at };
    return { saved: false, current: await this.find(userId) };
  }
};

// server/src/infrastructure/postgres/stores.ts
var postgresStores = (db) => ({
  users: new PostgresUserRepository(db),
  sessions: new PostgresSessionRepository(db),
  workspaces: new PostgresWorkspaceRepository(db),
  worldSaves: new PostgresWorldSaveRepository(db),
  conversations: new PostgresConversationRepository(db),
  recordings: new PostgresRecordingRepository(db),
  pictures: new PostgresPictureRepository(db),
  secrets: new PostgresSecretRepository(db),
  narrators: new PostgresNarratorRepository(db)
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
