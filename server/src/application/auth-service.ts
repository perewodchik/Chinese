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
import type { Clock, PasswordHasher, SessionRepository, Tokens, UserRepository } from './ports';

const DAY = 86_400_000;

export interface AuthPolicy {
  registration: 'open' | 'closed';
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

  async register(input: SignIn): Promise<IssuedSession> {
    if (this.deps.policy.registration === 'closed') throw new RegistrationClosedError();
    const user = await this.createUser(input.username, input.password);
    return this.issue(user, input.userAgent);
  }

  /** An account made by whoever runs the server, whether or not sign-ups are open. No session comes with it. */
  async addUser(username: string, password: string): Promise<UserDto> {
    return toUserDto(await this.createUser(username, password));
  }

  private async createUser(rawName: string, password: string): Promise<User> {
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
    if (!(await users.insert(user))) throw new UsernameTakenError();
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
   * A session for the named account with no password asked — made if it does
   * not exist yet, with a password nobody knows (`npm run admin` can set one).
   *
   * Only the development server calls this, and only when HANZI_DEV_USER is
   * set, so the app can be opened and checked on this machine without signing
   * in. Nothing that serves the app to anyone else ever reaches it.
   */
  async devSignIn(username: string, userAgent: string | null): Promise<IssuedSession> {
    const key = usernameKey(username);
    let user = await this.deps.users.findByUsernameKey(key);
    if (!user) {
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
