import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { safeNext } from '../../navigation/paths';
import { Splash } from '../../ui/Splash';
import { useSession } from './session';

/** When the server does not answer at all — asleep, switched off, or on another network. */
export function ServerUnreachable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Splash mark="断">
      <p>Could not reach the Hanzi Workshop server.</p>
      <p className="small">{message}</p>
      <p className="small">
        If it runs on another computer, check that the computer is awake, the app is running there, and
        both are on the same Wi-Fi.
      </p>
      <button className="btn primary" onClick={onRetry} style={{ marginTop: 10 }}>
        Try again
      </button>
    </Splash>
  );
}

/** The sign-in pages, for people who are not signed in; anyone who is goes on to where they were headed. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, retry } = useSession();
  const [params] = useSearchParams();

  if (session.status === 'checking') return <Splash mark="写">Checking who is signed in…</Splash>;
  if (session.status === 'unreachable') return <ServerUnreachable message={session.message} onRetry={retry} />;
  if (session.status === 'signed-in') return <Navigate to={safeNext(params.get('next'))} replace />;
  return <>{children}</>;
}
