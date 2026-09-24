import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { AccountMenu } from '../features/auth/AccountMenu';
import { ItemDrawer } from '../features/library/ItemDrawer';
import { ProgressDrawer } from '../features/library/ProgressDrawer';
import { ProgressMeter } from '../features/library/ProgressMeter';
import { useDueCount } from '../features/review/useDueCount';
import { LegacyWorkNotice } from '../features/settings/LegacyWorkNotice';
import { WordDrawer } from '../features/words/WordDrawer';
import { isWordId } from '../domain/ids';
import { useItemDrawer } from '../navigation/itemDrawer';
import { useProgressDrawer } from '../navigation/progressDrawer';
import { paths } from '../navigation/paths';
import { useScrollRestoration } from '../navigation/useScrollRestoration';
import { preloadFonts } from '../pdf/fonts';
import { useStore } from '../store/store';
import { useColorScheme } from '../ui/colorScheme';
import { SyncIndicator } from './SyncIndicator';

/** A review sitting's address: one drill, or the words. */
const SITTING = /^\/review\/(recognise|sound|tone|confuse|word|write|words)\/?$/;

/** The frame every signed-in page sits in: the bar across the top, the page, and the drawer for a character or a word. */
export function AppLayout() {
  const theme = useStore((s) => s.settings.theme);
  const collections = useStore((s) => s.collections.length);
  const textSets = useStore((s) => s.sets.filter((set) => s.texts.some((t) => t.setId === set.id)).length);
  const { pathname } = useLocation();
  const due = useDueCount();
  const drawer = useItemDrawer();
  const progress = useProgressDrawer();
  const main = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLElement>(null);
  // A sitting has the whole screen: the question and its own way out, nothing
  // else to glance at or tap by mistake. Sheets and the sweep keep the bar.
  const sitting = SITTING.test(pathname);

  useColorScheme(theme);

  // On a phone the tabs scroll sideways and the last ones start off-screen;
  // the section you are in is always brought into view, so the bar never
  // hides where you are.
  useEffect(() => {
    const current = tabs.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const bar = tabs.current;
    if (!current || !bar || bar.scrollWidth <= bar.clientWidth) return;
    const left = current.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + current.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - 12, behavior: 'smooth' });
    }
  }, [pathname]);

  useScrollRestoration(main);
  useEffect(() => {
    preloadFonts().catch(() => undefined);
  }, []);

  // Today comes first because it is the one page that knows what you should be
  // doing, all of it in order, with Review inside it — hence the count. The
  // rest are places you go once you have decided for yourself.
  //
  // A count is a badge beside the name: cinnabar where it is something to do
  // (reviews due), quiet where it is only how many there are.
  const sections = [
    // Review is part of Today, so its sittings under /review keep this tab lit.
    { to: paths.today(), label: 'Today', count: due, alert: true, also: '/review' },
    { to: paths.library(), label: 'Library', count: 0 },
    // Texts live in collections now; reading or writing one is still being
    // in Collections, so the tab stays lit there too.
    { to: paths.collections(), label: 'Collections', count: collections + textSets, also: '/texts' },
    { to: paths.speaking(), label: 'Speaking', count: 0 },
    { to: paths.settings(), label: 'Settings', count: 0 },
  ];

  return (
    <div className="app" data-focus={sitting || undefined}>
      <header className="topbar">
        <Link to={paths.today()} className="brand" aria-label="Hanzi Workshop">
          <span className="mark">写</span>
          Hanzi Workshop
        </Link>
        <nav className="tabs" aria-label="Sections" ref={tabs}>
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

      {drawer.item &&
        (isWordId(drawer.item) ? (
          <WordDrawer id={drawer.item} onClose={drawer.close} />
        ) : (
          <ItemDrawer id={drawer.item} onClose={drawer.close} />
        ))}
      {progress.open && !drawer.item && <ProgressDrawer onClose={progress.close} />}
    </div>
  );
}
