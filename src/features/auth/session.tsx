import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDto } from '../../../shared/api';
import { authApi } from '../../api/auth';
import { ApiError, onSignedOut } from '../../api/http';
import { forgetAccount, setStorageAccount } from '../../platform/accountStorage';
import { flushWorkspace } from '../../store/store';

export type Session =
  | { status: 'checking' }
  | { status: 'unreachable'; message: string }
  /** `initial`: never signed in on this visit; `expired`: the server ended it; `left`: signed out on purpose */
  | { status: 'signed-out'; reason: 'initial' | 'expired' | 'left' }
  | { status: 'signed-in'; user: UserDto };

interface SessionApi {
  session: Session;
  signIn(username: string, password: string): Promise<void>;
  register(username: string, password: string, invite?: string): Promise<void>;
  signOut(): Promise<void>;
  /** The account was deleted: what this device kept for it goes, and the sign-in page comes back. */
  deleted(): void;
  retry(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

/** How long signing out waits for unsaved work to reach the server before going anyway. */
const SIGN_OUT_WAIT_MS = 4_000;

/**
 * The account this tab has shown. Screens keep what they fetched for a visit
 * (tries, narrators, the history) in memory; signing in as someone else in
 * the same tab would show them the last account's. A different account
 * starts the page afresh instead, so nothing of the one before is left.
 */
let shownAccount: string | null = null;
function enter(user: UserDto): boolean {
  if (shownAccount && shownAccount !== user.id) {
    window.location.reload();
    return false;
  }
  shownAccount = user.id;
  setStorageAccount(user.id);
  return true;
}

/**
 * Who is signed in, as far as this tab knows.
 *
 * The answer always comes from the server rather than from anything kept in the
 * browser: the cookie that proves it is HttpOnly, so no script on the page can
 * read it, and the only way to know it is still good is to ask.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'checking' });

  const check = useCallback(() => {
    setSession({ status: 'checking' });
    authApi
      .session()
      .then(({ user }) => {
        if (!user) setSession({ status: 'signed-out', reason: 'initial' });
        else if (enter(user)) setSession({ status: 'signed-in', user });
      })
      // .catch rather than a second argument to .then: this has to catch what
      // the line above throws too, or a surprising answer leaves the splash up
      // for ever with nothing said.
      .catch((err: unknown) =>
        setSession({ status: 'unreachable', message: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  useEffect(check, [check]);

  // A 401 from any request means the session is over: it ran out, or the
  // password was changed on another device.
  useEffect(() => {
    onSignedOut(() =>
      setSession((s) => (s.status === 'signed-in' ? { status: 'signed-out', reason: 'expired' } : s)),
    );
    return () => onSignedOut(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { user } = await authApi.login({ username, password });
    if (enter(user)) setSession({ status: 'signed-in', user });
  }, []);

  const register = useCallback(async (username: string, password: string, invite?: string) => {
    const { user } = await authApi.register({ username, password, ...(invite && { invite }) });
    if (enter(user)) setSession({ status: 'signed-in', user });
  }, []);

  const signOut = useCallback(async () => {
    await Promise.race([flushWorkspace(), new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
    try {
      await authApi.logout();
    } catch (err) {
      // Already signed out is fine. Anything else means the server still holds
      // the session, and claiming otherwise on a shared tablet would be a lie.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    setStorageAccount(null);
    setSession({ status: 'signed-out', reason: 'left' });
  }, []);

  const deleted = useCallback(() => {
    if (shownAccount) forgetAccount(shownAccount);
    shownAccount = null;
    setStorageAccount(null);
    setSession({ status: 'signed-out', reason: 'left' });
  }, []);

  const value = useMemo(
    () => ({ session, signIn, register, signOut, deleted, retry: check }),
    [session, signIn, register, signOut, deleted, check],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession() needs a <SessionProvider> above it.');
  return api;
}

/** The signed-in user, for screens that only exist behind a session. */
export function useUser(): UserDto {
  const { session } = useSession();
  if (session.status !== 'signed-in') throw new Error('useUser() is only for screens behind a session.');
  return session.user;
}
