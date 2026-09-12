import { useCallback, useState } from 'react';
import { getSyncStatus } from '../../store/store';
import { useToast } from '../../ui/toast';
import { messageFor } from './messages';
import { useSession } from './session';

/**
 * Signing out, with a word first when there is work the server does not have
 * yet. It is not lost — it stays on this device and is saved the next time
 * someone signs in to that account here — but on a shared tablet that is worth
 * knowing before walking away.
 */
export function useSignOut() {
  const { signOut } = useSession();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);

  const leave = useCallback(async () => {
    const unsaved = getSyncStatus()?.unsaved ?? 0;
    if (
      unsaved > 0 &&
      !confirm(
        `${unsaved} change${unsaved === 1 ? ' has' : 's have'} not reached the server yet. ` +
          'They stay on this device and are saved the next time you sign in here. Sign out anyway?',
      )
    ) {
      return;
    }
    setLeaving(true);
    try {
      await signOut();
    } catch (err) {
      toast(`Could not sign out: ${messageFor(err)}`);
      setLeaving(false);
    }
  }, [signOut, toast]);

  return { leave, leaving };
}
