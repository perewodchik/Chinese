import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { AccountMenu } from '../features/auth/AccountMenu';
import { ItemDrawer } from '../features/library/ItemDrawer';
import { ProgressMeter } from '../features/library/ProgressMeter';
import { useDueCount } from '../features/review/useDueCount';
import { LegacyWorkNotice } from '../features/settings/LegacyWorkNotice';
import { useItemDrawer } from '../navigation/itemDrawer';
import { paths } from '../navigation/paths';
import { useScrollRestoration } from '../navigation/useScrollRestoration';
import { preloadFonts } from '../pdf/fonts';
import { useStore } from '../store/store';
import { useColorScheme } from '../ui/colorScheme';
import { SyncIndicator } from './SyncIndicator';

/** The frame every signed-in page sits in: the bar across the top, the page, and the character drawer. */
export function AppLayout() {
  const theme = useStore((s) => s.settings.theme);
  const collections = useStore((s) => s.collections.length);
  const texts = useStore((s) => s.texts.length);
  const due = useDueCount();
  const drawer = useItemDrawer();
  const main = useRef<HTMLElement>(null);

  useColorScheme(theme);
  useScrollRestoration(main);
  useEffect(() => {
    preloadFonts().catch(() => undefined);
  }, []);

  // Review comes first because it is the one section that knows what you should
  // be doing. The rest are places you go once you have decided for yourself.
  const sections = [
    { to: paths.review(), label: 'Review', count: due },
    { to: paths.library(), label: 'Library', count: 0 },
    { to: paths.collections(), label: 'Collections', count: collections },
    { to: paths.radicals(), label: 'Radicals', count: 0 },
    { to: paths.texts(), label: 'Texts', count: texts },
    { to: paths.settings(), label: 'Settings', count: 0 },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <Link to={paths.review()} className="brand" aria-label="Hanzi Workshop">
          <span className="mark">写</span>
          Hanzi Workshop
        </Link>
        <nav className="tabs" aria-label="Sections">
          {sections.map((s) => (
            <NavLink key={s.to} to={s.to}>
              {s.label}
              {s.count ? ` (${s.count})` : ''}
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <ProgressMeter />
        <SyncIndicator />
        <AccountMenu />
      </header>

      <main className="main" ref={main}>
        <div className="page">
          <LegacyWorkNotice />
          <Outlet />
        </div>
      </main>

      {drawer.item && <ItemDrawer id={drawer.item} onClose={drawer.close} />}
    </div>
  );
}
