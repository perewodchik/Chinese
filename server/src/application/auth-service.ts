import { TOKEN_PREFIX, TOKEN_SCOPES, type AccessTokenDto, type SessionDto, type TokenScope, type UserDto } from '../../../shared/api';
import {
  normaliseUsername,
  PASSWORD_MAX,
  passwordProblem,
  usernameKey,
  usernameProblem,
} from '../../../shared/credentials';
import type { ApiToken, User } from '../domain/entities';
import {
  AccountBlockedError,
  InvalidCredentialsError,
  NotFoundError,
  RegistrationClosedError,
  UnauthorizedError,
  UsernameTakenError,
  ValidationError,
} from '../domain/errors';
import { randomInt } from 'node:crypto';
import type { Actor, AdminLogRecord, AdminLogRepository, ApiTokenRepository, Clock, InviteRepository, PasswordHasher, RecoveryCodeRepository, SessionRepository, Tokens, UserRepository } from './ports';

const DAY = 86_400_000;

export interface AuthPolicy {
  /** anyone may make an account, nobody may, or only someone with an invitation */
  registration: 'open' | 'closed' | 'invite';
  /**
   * Names (as `usernameKey` gives them) that the sign-up form never hands
   * out: the accounts that run the site. Whoever runs the server makes those
   * with `npm run admin -- add-user`. Without this, a name listed in
   * HANZI_ADMIN_USERS before its account exists — or after it was deleted —
   * would make an administrator of whoever registered it first.
   */
  reservedNames?: readonly string[];
  /** how long a session lasts once it stops being used */
  sessionTtlMs: number;
  /** how often a session in use has its expiry pushed back */
  sessionRefreshMs: number;
}

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  registration: 'open',
  sessionTtlMs: 30 * DAY,
  sessionRefreshMs: DAY,
};

export interface AuthDeps {
  users: UserRepository;
  sessions: SessionRepository;
  apiTokens: ApiTokenRepository;
  /** what the accounts that run the site did; every method here that one of them calls writes to it */
  adminLog: AdminLogRepository;
  invites: InviteRepository;
  recoveryCodes: RecoveryCodeRepository;
  hasher: PasswordHasher;
  tokens: Tokens;
  clock: Clock;
  policy: AuthPolicy;
}

/** A session that has just been made. The token goes into the cookie and nowhere else. */
export interface IssuedSession {
  user: UserDto;
  token: string;
  expiresAt: number;
}

export interface ActiveSession {
  user: UserDto;
  sessionId: string;
  expiresAt: number;
  /** the expiry moved on this request, so the cookie should be sent again */
  renewed: boolean;
  /**
   * Set when an access token opened this rather than a cookie: what the token
   * may do. A route that does not name one of these refuses it.
   */
  scopes?: readonly TokenScope[];
}

interface SignIn {
  username: string;
  password: string;
  userAgent: string | null;
}

/** An invitation as it was given out: the code to type, once. */
export interface IssuedInvite {
  code: string;
  note: string;
  expiresAt: number | null;
}

/** Letters and digits that cannot be read as one another: no 0/O, 1/I/L. */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 12;

/** How many recovery codes an account is given at a time, and how long each is. */
const RECOVERY_CODES = 8;
const RECOVERY_LENGTH = 10;

/** How many tokens an account may have working at once, and the most days one lasts. */
const TOKENS_MAX = 20;
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const TOKEN_DAYS_MAX = 365;
/** A token's last use is written at most this often, so a script's every request is not also a write. */
const TOKEN_TOUCH_MS = 60_000;

const toTokenDto = (t: ApiToken): AccessTokenDto => ({
  id: t.id,
  name: t.name,
  scopes: t.scopes.filter((s): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s)),
  createdAt: t.createdAt,
  lastUsedAt: t.lastUsedAt,
  expiresAt: t.expiresAt,
});

/** Who did it, when a command on the server did: `npm run admin`, the scripts, the tests. */
export const SERVER_COMMAND: Actor = { id: null, name: 'a command on the server', ip: null };
/** Who gave the first admins their role. */
const FROM_SETTINGS: Actor = { id: null, name: 'HANZI_ADMIN_USERS', ip: null };
/** How long the admins' log is kept. */
const ADMIN_LOG_DAYS = 365;

const randomCode = (length: number) => Array.from({ length }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');

/** A code as typed: any case, with or without the dashes and spaces it was printed with. */
export const normaliseInvite = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const toUserDto = (u: User): UserDto => ({
  id: u.id,
  username: u.username,
  createdAt: u.createdAt,
  role: u.role,
});

/**
 * Accounts and sessions.
 *
 * Two properties are worth their extra lines. A wrong name and a wrong password
 * fail the same way and take the same time, so the sign-in form is not a way to
 * find out who has an account. And a session is a random secret the browser
 * keeps in an HttpOnly cookie and the server keeps only as a digest, so it can
 * be revoked: signing out, or changing a password, ends a session on the
 * server rather than trusting a browser to forget it.
 */
export class AuthService {
  private decoy: Promise<string> | null = null;

  constructor(private readonly deps: AuthDeps) {}

  get registration(): AuthPolicy['registration'] {
    return this.deps.policy.registration;
  }

  async register(input: SignIn & { invite?: string }): Promise<IssuedSession> {
    const { registration } = this.deps.policy;
    if (registration === 'closed') throw new RegistrationClosedError();
    // Said as any taken name is, so the form does not tell a visitor which names run the site.
    if (this.deps.policy.reservedNames?.includes(usernameKey(input.username))) throw new UsernameTakenError();
    if (registration === 'open') return this.issue(await this.createUser(input.username, input.password), input.userAgent);

    const code = normaliseInvite(input.invite ?? '');
    if (!code) throw new ValidationError('An account here needs an invitation.', { invite: 'The code from your invitation.' });
    const digest = this.deps.tokens.digest(code);
    // Claimed only once the name and password are good, so a typo in either
    // does not use the invitation up; given back if the name turns out taken.
    const user = await this.createUser(input.username, input.password, async (userId) => {
      if (!(await this.deps.invites.claim(digest, userId, this.deps.clock.now()))) {
        throw new ValidationError('That invitation is not right, or it has been used.', { invite: 'Not a code that can be used.' });
      }
    }).catch(async (err: unknown) => {
      if (err instanceof UsernameTakenError && err.userId) await this.deps.invites.release(digest, err.userId);
      throw err;
    });
    return this.issue(user, input.userAgent);
  }

  /** For whoever runs the server: an invitation for one account, good for `days` (or for ever). */
  async invite(note: string, days: number | null, actor: Actor): Promise<IssuedInvite> {
    const code = Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
    const now = this.deps.clock.now();
    const expiresAt = days === null ? null : now + days * DAY;
    await this.deps.invites.insert({ digest: this.deps.tokens.digest(code), note: note.trim().slice(0, 120), createdAt: now, expiresAt, usedBy: null, usedAt: null });
    await this.record(actor, 'invite-made', null, { note: note.trim().slice(0, 120), days });
    return { code: code.match(/.{1,4}/g)!.join('-'), note, expiresAt };
  }

  /** The invitations given out, with who used each (by name) — never their codes, which are not kept. */
  async invites(): Promise<Array<{ note: string; createdAt: number; expiresAt: number | null; usedBy: string | null; usedAt: number | null }>> {
    const [list, users] = await Promise.all([this.deps.invites.list(), this.deps.users.list()]);
    const name = new Map(users.map((u) => [u.id, u.username]));
    return list.map((i) => ({ note: i.note, createdAt: i.createdAt, expiresAt: i.expiresAt, usedBy: i.usedBy ? (name.get(i.usedBy) ?? 'an account since deleted') : null, usedAt: i.usedAt }));
  }

  /** An account made by whoever runs the server, whether or not sign-ups are open. No session comes with it. */
  async addUser(username: string, password: string, actor: Actor): Promise<UserDto> {
    const user = await this.createUser(username, password);
    await this.record(actor, 'account-made', user, {});
    return toUserDto(user);
  }

  /** `before` runs once the name and password are good, just before the account is written, with its id. */
  private async createUser(rawName: string, password: string, before?: (userId: string) => Promise<void>): Promise<User> {
    const { users, hasher, tokens, clock } = this.deps;
    const username = normaliseUsername(rawName);
    const nameProblem = usernameProblem(username);
    const passProblem = passwordProblem(password, username);
    if (nameProblem || passProblem) {
      throw new ValidationError(nameProblem ?? passProblem ?? '', {
        ...(nameProblem && { username: nameProblem }),
        ...(passProblem && { password: passProblem }),
      });
    }

    const now = clock.now();
    const user: User = {
      id: tokens.id(),
      username,
      usernameKey: usernameKey(username),
      passwordHash: await hasher.hash(password),
      createdAt: now,
      updatedAt: now,
      // Never anything else from here: a role is given by a command on the
      // server or by an account that already has it, not asked for.
      role: 'learner',
      status: 'active',
      flags: {},
    };
    await before?.(user.id);
    if (!(await users.insert(user))) throw new UsernameTakenError(user.id);
    return user;
  }

  async login(input: SignIn): Promise<IssuedSession> {
    const { users, hasher } = this.deps;
    const plausible = input.password.length <= PASSWORD_MAX * 4;
    const user = plausible ? await users.findByUsernameKey(usernameKey(input.username)) : null;
    // Checked against a stand-in hash when there is no such account, so an
    // unknown name takes exactly as long to refuse as a wrong password.
    const matches = await hasher.verify(input.password, user?.passwordHash ?? (await this.decoyHash()));
    if (!user || !matches) throw new InvalidCredentialsError();
    if (user.status === 'blocked') throw new AccountBlockedError();
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
  async devSignIn(
    username: string,
    userAgent: string | null,
    create = true,
  ): Promise<IssuedSession | null> {
    const key = usernameKey(username);
    let user = await this.deps.users.findByUsernameKey(key);
    if (!user) {
      if (!create) return null;
      try {
        user = await this.createUser(username, this.deps.tokens.secret());
      } catch (err) {
        // A page asks who is signed in more than once as it opens; the first
        // of those made the account, and the rest simply use it.
        if (!(err instanceof UsernameTakenError)) throw err;
        user = await this.deps.users.findByUsernameKey(key);
        if (!user) throw err;
      }
    }
    if (user.status === 'blocked') return null;
    return this.issue(user, userAgent);
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.deps.sessions.delete(this.deps.tokens.digest(token));
  }

  /** The session a cookie belongs to, if it is still good, with its expiry pushed back when that is due. */
  async authenticate(token: string | undefined): Promise<ActiveSession | null> {
    if (!token) return null;
    const { sessions, users, tokens, clock, policy } = this.deps;
    const id = tokens.digest(token);
    const session = await sessions.findById(id);
    if (!session) return null;

    const now = clock.now();
    const user = session.expiresAt > now ? await users.findById(session.userId) : null;
    // A blocked account's cookies open nothing, wherever they are.
    if (!user || user.status === 'blocked') {
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

  /**
   * The browsers signed in to the account. A session's id is the digest of
   * its cookie; what goes to the page is a digest of that again, enough to
   * name one to sign out and of no use for anything else.
   */
  async sessionsOf(userId: string, currentId: string): Promise<SessionDto[]> {
    const { sessions, tokens, clock } = this.deps;
    return (await sessions.listForUser(userId, clock.now())).map((s) => ({
      id: tokens.digest(s.id).slice(0, 22),
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      userAgent: s.userAgent,
      current: s.id === currentId,
    }));
  }

  /** Signs one of the account's browsers out, by the handle `sessionsOf` gave it. False when there is no such one. */
  async signOutSession(userId: string, handle: string): Promise<boolean> {
    const { sessions, tokens, clock } = this.deps;
    const found = (await sessions.listForUser(userId, clock.now())).find((s) => tokens.digest(s.id).slice(0, 22) === handle);
    if (!found) return false;
    await sessions.delete(found.id);
    return true;
  }

  /** Every browser but this one signed out; how many went. */
  signOutOthers(userId: string, currentId: string): Promise<number> {
    return this.deps.sessions.deleteForUser(userId, currentId);
  }

  /** A new password, and every other browser signed out — which is usually why it is being changed. */
  async changePassword(input: {
    userId: string;
    sessionId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const { users, sessions, hasher, clock } = this.deps;
    const user = await users.findById(input.userId);
    if (!user) throw new UnauthorizedError();
    if (!(await hasher.verify(input.currentPassword, user.passwordHash))) {
      throw new ValidationError('That is not the current password.', {
        currentPassword: 'Not the current password.',
      });
    }
    const problem = passwordProblem(input.newPassword, user.username);
    if (problem) throw new ValidationError(problem, { newPassword: problem });

    await users.updatePassword(user.id, await hasher.hash(input.newPassword), clock.now());
    await sessions.deleteForUser(user.id, input.sessionId);
    // A token made by whoever knew the old password must not outlive it.
    await this.deps.apiTokens.revokeForUser(user.id, clock.now());
  }

  /**
   * The account gone, with everything it kept — asked for with its password,
   * so a browser left signed in is not enough to lose a year's work.
   */
  async deleteAccount(input: { userId: string; password: string }): Promise<void> {
    const { users, hasher } = this.deps;
    const user = await users.findById(input.userId);
    if (!user) throw new UnauthorizedError();
    if (!(await hasher.verify(input.password, user.passwordHash))) {
      throw new ValidationError('That is not the password.', { password: 'Not the password.' });
    }
    await users.delete(user.id);
  }

  /**
   * New recovery codes for the account, shown this once: the old ones stop
   * working. Asked for with the password, like anything that would let
   * someone into the account later. Kept as digests tied to the account, so
   * the list in the database opens nothing.
   */
  async makeRecoveryCodes(input: { userId: string; password: string }): Promise<string[]> {
    const { users, hasher, recoveryCodes, clock } = this.deps;
    const user = await users.findById(input.userId);
    if (!user) throw new UnauthorizedError();
    if (!(await hasher.verify(input.password, user.passwordHash))) {
      throw new ValidationError('That is not the password.', { password: 'Not the password.' });
    }
    const codes = Array.from({ length: RECOVERY_CODES }, () => randomCode(RECOVERY_LENGTH));
    await recoveryCodes.replace(user.id, codes.map((c) => this.recoveryDigest(user.id, c)), clock.now());
    return codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`);
  }

  recoveryStatus(userId: string): Promise<{ left: number; createdAt: number } | null> {
    return this.deps.recoveryCodes.status(userId);
  }

  /**
   * A forgotten password replaced with one of the account's recovery codes:
   * the code is used up, every browser is signed out, and this one is signed
   * in. A wrong name and a wrong code fail the same way.
   */
  async recover(input: { username: string; code: string; newPassword: string; userAgent: string | null }): Promise<IssuedSession> {
    const { users, sessions, hasher, recoveryCodes, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(input.username));
    const problem = passwordProblem(input.newPassword, user?.username ?? normaliseUsername(input.username));
    if (problem) throw new ValidationError(problem, { newPassword: problem });
    const code = normaliseInvite(input.code);
    const refused = new ValidationError('That name and code do not go together, or the code has been used.', { code: 'Not a code that works for this name.' });
    if (!user || code.length !== RECOVERY_LENGTH) throw refused;
    if (!(await recoveryCodes.use(user.id, this.recoveryDigest(user.id, code), clock.now()))) throw refused;
    if (user.status === 'blocked') throw new AccountBlockedError();
    await users.updatePassword(user.id, await hasher.hash(input.newPassword), clock.now());
    await sessions.deleteForUser(user.id);
    await this.deps.apiTokens.revokeForUser(user.id, clock.now());
    return this.issue(user, input.userAgent);
  }

  private recoveryDigest(userId: string, code: string) {
    return this.deps.tokens.digest(`${userId}:${normaliseInvite(code)}`);
  }

  /** For whoever runs the server: a new password for an account, and every session of it ended. */
  async resetPassword(username: string, newPassword: string, actor: Actor): Promise<UserDto> {
    const { users, sessions, hasher, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(username));
    if (!user) throw new NotFoundError(`An account called “${username}”`);
    const problem = passwordProblem(newPassword, user.username);
    if (problem) throw new ValidationError(problem);

    await users.updatePassword(user.id, await hasher.hash(newPassword), clock.now());
    await sessions.deleteForUser(user.id);
    await this.deps.apiTokens.revokeForUser(user.id, clock.now());
    await this.record(actor, 'password-reset', user, {});
    return toUserDto(user);
  }

  /**
   * The first accounts to run the site, from HANZI_ADMIN_USERS: given the
   * role once, and only while no account has it, so the setting can be taken
   * away afterwards and a name added to it later gives nobody anything. Only
   * names that already have an account are given it. Says which names were
   * given it, for the log, and whether there is an admin now.
   */
  async seedAdmins(names: readonly string[]): Promise<{ given: string[]; settled: boolean }> {
    const { users, clock } = this.deps;
    if (!names.length || (await users.countByRole('admin')) > 0) return { given: [], settled: true };
    const given: string[] = [];
    for (const name of names) {
      const user = await users.findByUsernameKey(usernameKey(name));
      if (!user || user.role === 'admin') continue;
      await users.setRole(user.id, 'admin', clock.now());
      await this.record(FROM_SETTINGS, 'role-granted', user, {});
      given.push(user.username);
    }
    // Not settled while none of the names has an account yet: the next
    // request looks again, so an account made later (npm run admin --
    // add-user, which the reserved names leave as the only way) is given it.
    return { given, settled: given.length > 0 };
  }

  /**
   * For whoever runs the server (`npm run admin -- grant-admin` and
   * `revoke-admin`), and later the admin pages: an account's role, by name.
   * The last account that runs the site keeps the role, so the site is never
   * left with nobody to run it.
   */
  async setRole(username: string, role: UserDto['role'], actor: Actor): Promise<UserDto> {
    const { users, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(username));
    if (!user) throw new NotFoundError(`An account called “${username}”`);
    if (user.role === role) return toUserDto(user);
    if (user.role === 'admin' && (await users.countByRole('admin')) <= 1) {
      throw new ValidationError('That is the last account that runs the site. Give the role to another first.');
    }
    await users.setRole(user.id, role, clock.now());
    await this.record(actor, role === 'admin' ? 'role-granted' : 'role-revoked', user, {});
    return toUserDto({ ...user, role });
  }

  /**
   * An account paused, or opened again. Pausing signs it out everywhere and
   * stops its tokens; the work it kept stays. An account cannot pause itself,
   * and the last one that runs the site cannot be paused.
   */
  async setStatus(username: string, status: 'active' | 'blocked', actor: Actor): Promise<UserDto> {
    const { users, sessions, apiTokens, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(username));
    if (!user) throw new NotFoundError(`An account called “${username}”`);
    if (status === 'blocked') {
      if (user.id === actor.id) throw new ValidationError('An account cannot pause itself.');
      if (user.role === 'admin' && (await users.countByRole('admin')) <= 1) {
        throw new ValidationError('That is the last account that runs the site, and cannot be paused.');
      }
    }
    if (user.status !== status) {
      await users.setStatus(user.id, status, clock.now());
      await this.record(actor, status === 'blocked' ? 'blocked' : 'unblocked', user, {});
    }
    if (status === 'blocked') {
      await sessions.deleteForUser(user.id);
      await apiTokens.revokeForUser(user.id, clock.now());
    }
    return toUserDto(user);
  }

  async listUsers(): Promise<UserDto[]> {
    return (await this.deps.users.list()).map(toUserDto);
  }

  /**
   * A token for a script, in place of the password: shown this once, kept as
   * its digest. Whether the account may have `scopes` (catalog:write is for
   * the accounts that run the site) is the route's to decide before this.
   */
  async makeAccessToken(userId: string, input: { name: string; days: number; scopes: TokenScope[] }): Promise<{ token: string; made: AccessTokenDto }> {
    const { apiTokens, tokens, clock } = this.deps;
    const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!name) throw new ValidationError('Give the token a name, so you know later what uses it.', { name: 'A name, such as “add-text skill”.' });
    if (!Number.isInteger(input.days) || input.days < 1 || input.days > TOKEN_DAYS_MAX) {
      throw new ValidationError(`A token lasts from 1 to ${TOKEN_DAYS_MAX} days.`, { days: `From 1 to ${TOKEN_DAYS_MAX} days.` });
    }
    const scopes = [...new Set(input.scopes)];
    if (!scopes.length) throw new ValidationError('A token has to be allowed to do something.');
    const now = clock.now();
    const live = (await apiTokens.listForUser(userId)).filter((t) => t.expiresAt > now);
    if (live.length >= TOKENS_MAX) throw new ValidationError(`An account has at most ${TOKENS_MAX} tokens at a time. Revoke one first.`);

    // 32 letters and digits: about 190 bits, and nothing to escape in a header or an environment variable.
    const token = `${TOKEN_PREFIX}${Array.from({ length: 32 }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('')}`;
    const record: ApiToken = { id: tokens.id(), userId, name, digest: tokens.digest(token), scopes, createdAt: now, lastUsedAt: null, expiresAt: now + input.days * DAY, revokedAt: null };
    await apiTokens.insert(record);
    return { token, made: toTokenDto(record) };
  }

  /** The account's tokens that are not revoked, expired ones too, newest first. */
  async accessTokensOf(userId: string): Promise<AccessTokenDto[]> {
    return (await this.deps.apiTokens.listForUser(userId)).map(toTokenDto);
  }

  /** False when the account has no such token, or it was revoked already. */
  revokeAccessToken(userId: string, id: string): Promise<boolean> {
    return this.deps.apiTokens.revoke(userId, id, this.deps.clock.now());
  }

  /**
   * The account a token opens, if it is the account's, not revoked and not
   * out of date — with what it may do. Never renewed: a token ends when it
   * says it does.
   */
  async authenticateAccessToken(token: string): Promise<ActiveSession | null> {
    const { apiTokens, users, tokens, clock } = this.deps;
    if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) return null;
    const found = await apiTokens.findByDigest(tokens.digest(token));
    const now = clock.now();
    if (!found || found.revokedAt !== null || found.expiresAt <= now) return null;
    const user = await users.findById(found.userId);
    if (!user || user.status === 'blocked') return null;
    if (found.lastUsedAt === null || now - found.lastUsedAt >= TOKEN_TOUCH_MS) await apiTokens.touch(found.id, now);
    return { user: toUserDto(user), sessionId: `token:${found.id}`, expiresAt: found.expiresAt, renewed: false, scopes: toTokenDto(found).scopes };
  }

  /** A page of the admins' log, the newest first. */
  adminLogPage(query: { action?: string; name?: string; before?: number; limit: number }): Promise<AdminLogRecord[]> {
    return this.deps.adminLog.list(query);
  }

  /**
   * One line of the admins' log, written as part of the action: awaited, so
   * an action whose line could not be written is answered as failed rather
   * than done unseen. Now and then, what is older than a year goes.
   */
  private async record(actor: Actor, action: string, target: User | null, details: AdminLogRecord['details']): Promise<void> {
    const at = this.deps.clock.now();
    await this.deps.adminLog.add({ at, actorId: actor.id, actorName: actor.name, action, targetId: target?.id ?? null, targetName: target?.username ?? null, details, ip: actor.ip });
    if (Math.random() < 0.01) await this.deps.adminLog.sweep(at - ADMIN_LOG_DAYS * DAY);
  }

  purgeExpiredSessions(): Promise<number> {
    return this.deps.sessions.deleteExpired(this.deps.clock.now());
  }

  private async issue(user: User, userAgent: string | null): Promise<IssuedSession> {
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
      userAgent: userAgent ? userAgent.slice(0, 300) : null,
    });
    return { user: toUserDto(user), token, expiresAt };
  }

  private decoyHash(): Promise<string> {
    this.decoy ??= this.deps.hasher.hash('a password nobody has');
    return this.decoy;
  }
}
