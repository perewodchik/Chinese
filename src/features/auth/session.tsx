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
  register(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

/** How long signing out waits for unsaved work to reach the server before going anyway. */
const SIGN_OUT_WAIT_MS = 4_000;

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
    authApi.session().then(
      ({ user }) =>
        setSession(user ? { status: 'signed-in', user } : { status: 'signed-out', reason: 'initial' }),
      (err: unknown) =>
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
    setSession({ status: 'signed-in', user });
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { user } = await authApi.register({ username, password });
    setSession({ status: 'signed-in', user });
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
    setSession({ status: 'signed-out', reason: 'left' });
  }, []);

  const value = useMemo(
    () => ({ session, signIn, register, signOut, retry: check }),
    [session, signIn, register, signOut, check],
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
