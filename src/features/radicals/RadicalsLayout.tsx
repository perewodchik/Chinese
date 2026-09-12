import { Outlet } from 'react-router';
import { useRadicalDrawer } from '../../navigation/radicalDrawer';
import { RadicalDrawer } from './RadicalDrawer';
import { RadicalGate } from './library';

/**
 * Everything under /radicals: the pages, and the drawer that can be open over
 * any of them.
 *
 * A section of its own, with its own data and its own store slice. Radicals
 * are shapes you learn early and stop studying; characters are studied for
 * years and scheduled for review. Keeping them apart is what lets each side
 * say plainly what it means.
 */
export function RadicalsLayout() {
  const drawer = useRadicalDrawer();
  return (
    <RadicalGate>
      <Outlet />
      {drawer.radical !== null && <RadicalDrawer n={drawer.radical} onClose={drawer.close} />}
    </RadicalGate>
  );
}
