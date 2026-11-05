import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ServerUnreachable } from '../features/auth/gates';
import { useSession } from '../features/auth/session';
import { LibraryGate } from '../features/shared/library';
import { paths } from '../navigation/paths';
import { Splash } from '../ui/Splash';
import { AppLayout } from './AppLayout';
import { WorkspaceGate } from './WorkspaceGate';

/**
 * Everything behind the sign-in page.
 *
 * Someone who is not signed in is sent to sign in with the page they wanted
 * remembered, so a bookmark to a collection still lands on that collection.
 * Signing out on purpose forgets it: the next person to sign in on a shared
 * tablet should not open onto the last person's page.
 */
export function RequireSession() {
  const { session, retry } = useSession();
  const location = useLocation();

  switch (session.status) {
    case 'checking':
      return <Splash mark="写">Checking who is signed in…</Splash>;
    case 'unreachable':
      return <ServerUnreachable message={session.message} onRetry={retry} />;
    case 'signed-out': {
      // Someone arriving at the bare address, signed in nowhere: the front
      // door, a page of its own (public/welcome.html) rather than a password box.
      if (session.reason === 'initial' && location.pathname === '/' && !location.search) return <FrontDoor />;
      const here = `${location.pathname}${location.search}`;
      const to = session.reason === 'left' ? paths.login() : paths.login(here, session.reason === 'expired');
      return <Navigate to={to} replace />;
    }
    case 'signed-in':
      // The workspace is fetched while the character data is still arriving,
      // rather than after it.
      return (
        <WorkspaceGate key={session.user.id} user={session.user}>
          <LibraryGate>
            <AppLayout />
          </LibraryGate>
        </WorkspaceGate>
      );
  }
}

/** Leaves the app for the front door, the plain page that says what this is. */
function FrontDoor() {
  useEffect(() => window.location.replace('/welcome.html'), []);
  return <Splash mark="写">Hanzi Workshop</Splash>;
}
