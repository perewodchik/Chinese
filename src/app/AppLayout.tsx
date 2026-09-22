import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
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
  const textSets = useStore((s) => s.sets.filter((set) => s.texts.some((t) => t.setId === set.id)).length);
  const { pathname } = useLocation();
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
  //
  // A count is a badge beside the name: cinnabar where it is something to do
  // (reviews due), quiet where it is only how many there are.
  const sections = [
    { to: paths.review(), label: 'Review', count: due, alert: true },
    { to: paths.library(), label: 'Library', count: 0 },
    // Texts live in collections now; reading or writing one is still being
    // in Collections, so the tab stays lit there too.
    { to: paths.collections(), label: 'Collections', count: collections + textSets, also: '/texts' },
    { to: paths.speaking(), label: 'Speaking', count: 0 },
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
            <Link
              key={s.to}
              to={s.to}
              aria-current={
                pathname.startsWith(s.to) || (s.also && pathname.startsWith(s.also)) ? 'page' : undefined
              }
            >
              {s.label}
              {s.count > 0 && (
                <span className="nav-badge" data-alert={s.alert || undefined} aria-label={`, ${s.count}`}>
                  {s.count > 99 ? '99+' : s.count}
                </span>
              )}
            </Link>
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
