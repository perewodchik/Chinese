import { RouterProvider } from 'react-router/dom';
import { SessionProvider } from '../features/auth/session';
import { LibraryProvider } from '../features/shared/library';
import { ToastProvider } from '../ui/toast';
import { router } from './router';

/**
 * The app, assembled.
 *
 * The providers sit outside the router because none of them depends on which
 * page is showing: the toast, who is signed in, and the character data, which
 * starts downloading before anyone has signed in at all.
 */
export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <LibraryProvider>
          <RouterProvider router={router} />
        </LibraryProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
