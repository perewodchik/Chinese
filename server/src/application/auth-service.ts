import type { UserDto } from '../../../shared/api';
import {
  normaliseUsername,
  PASSWORD_MAX,
  passwordProblem,
  usernameKey,
  usernameProblem,
} from '../../../shared/credentials';
import type { User } from '../domain/entities';
import {
  InvalidCredentialsError,
  NotFoundError,
  RegistrationClosedError,
  UnauthorizedError,
  UsernameTakenError,
  ValidationError,
} from '../domain/errors';
import { randomInt } from 'node:crypto';
import type { Clock, InviteRepository, PasswordHasher, SessionRepository, Tokens, UserRepository } from './ports';

const DAY = 86_400_000;

export interface AuthPolicy {
  /** anyone may make an account, nobody may, or only someone with an invitation */
  registration: 'open' | 'closed' | 'invite';
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
  invites: InviteRepository;
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

/** A code as typed: any case, with or without the dashes and spaces it was printed with. */
export const normaliseInvite = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const toUserDto = (u: User): UserDto => ({
  id: u.id,
  username: u.username,
  createdAt: u.createdAt,
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
  async invite(note: string, days: number | null): Promise<IssuedInvite> {
    const code = Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');
    const now = this.deps.clock.now();
    const expiresAt = days === null ? null : now + days * DAY;
    await this.deps.invites.insert({ digest: this.deps.tokens.digest(code), note: note.trim().slice(0, 120), createdAt: now, expiresAt, usedBy: null, usedAt: null });
    return { code: code.match(/.{1,4}/g)!.join('-'), note, expiresAt };
  }

  /** The invitations given out, with who used each (by name) — never their codes, which are not kept. */
  async invites(): Promise<Array<{ note: string; createdAt: number; expiresAt: number | null; usedBy: string | null; usedAt: number | null }>> {
    const [list, users] = await Promise.all([this.deps.invites.list(), this.deps.users.list()]);
    const name = new Map(users.map((u) => [u.id, u.username]));
    return list.map((i) => ({ note: i.note, createdAt: i.createdAt, expiresAt: i.expiresAt, usedBy: i.usedBy ? (name.get(i.usedBy) ?? 'an account since deleted') : null, usedAt: i.usedAt }));
  }

  /** An account made by whoever runs the server, whether or not sign-ups are open. No session comes with it. */
  async addUser(username: string, password: string): Promise<UserDto> {
    return toUserDto(await this.createUser(username, password));
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
  }

  /** For whoever runs the server: a new password for an account, and every session of it ended. */
  async resetPassword(username: string, newPassword: string): Promise<UserDto> {
    const { users, sessions, hasher, clock } = this.deps;
    const user = await users.findByUsernameKey(usernameKey(username));
    if (!user) throw new NotFoundError(`An account called “${username}”`);
    const problem = passwordProblem(newPassword, user.username);
    if (problem) throw new ValidationError(problem);

    await users.updatePassword(user.id, await hasher.hash(newPassword), clock.now());
    await sessions.deleteForUser(user.id);
    return toUserDto(user);
  }

  async listUsers(): Promise<UserDto[]> {
    return (await this.deps.users.list()).map(toUserDto);
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
