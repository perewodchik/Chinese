import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { AccountMenu } from '../features/auth/AccountMenu';
import { useUser } from '../features/auth/session';
import { useSignOut } from '../features/auth/useSignOut';
import { CharViewer } from '../features/library/CharViewer';
import { ItemDrawer } from '../features/library/ItemDrawer';
import { ProgressDrawer } from '../features/library/ProgressDrawer';
import { LegacyWorkNotice } from '../features/settings/LegacyWorkNotice';
import { WordDrawer } from '../features/words/WordDrawer';
import { isWordId } from '../domain/ids';
import { useItemDrawer } from '../navigation/itemDrawer';
import { useProgressDrawer } from '../navigation/progressDrawer';
import { paths } from '../navigation/paths';
import { useScrollRestoration } from '../navigation/useScrollRestoration';
import { preloadFonts } from '../pdf/fonts';
import { useStore, useSyncStatus } from '../store/store';
import { useColorScheme } from '../ui/colorScheme';
import { useSheetDrag } from '../ui/useSheetDrag';
import { Icon } from '../ui/Icon';
import { feedbackUrl } from '../platform/feedback';

/** A review sitting's address: one drill, the words, the daily session, the cards, or the day's lesson. */
const SITTING = /^\/(review\/(recognise|sound|tone|confuse|word|write|words|session)|learn|cards\/session)\/?$/;

/** Where each section of More lives, so its tab stays lit while you are in one of them. */
const MORE_PATHS = ['/cards', '/review', '/learn', '/videos', '/play', '/account', '/settings'];

/**
 * The frame every signed-in page sits in: the sections, the page, and the
 * drawer for a character or a word.
 *
 * Four places and a fifth for everything else. On a phone they sit along the
 * bottom edge, where a thumb already is, and never scroll: seven tabs across
 * the top had to scroll sideways and hid where you were. On an iPad or a
 * computer the same five stand in a narrow rail on the left, out of the
 * reading column's way. Each is named in English with its character above
 * it — 今 读 说 字 — which is one more thing read every day.
 */
export function AppLayout() {
  const theme = useStore((s) => s.settings.theme);
  const { pathname } = useLocation();
  const drawer = useItemDrawer();
  const viewing = new URLSearchParams(useLocation().search).has('view');
  const progress = useProgressDrawer();
  const main = useRef<HTMLElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [more, setMore] = useState(false);
  // A sitting has the whole screen: the question and its own way out, nothing
  // else to glance at or tap by mistake.
  const sitting = SITTING.test(pathname) || pathname.startsWith('/speaking/say/');
  // Reading has the screen edge to edge; on a phone the text page has its own
  // bar and dock, and the sections wait behind its back button.
  const immersive = /^\/texts\/(?!session)/.test(pathname);

  useColorScheme(theme);
  useScrollRestoration(main);
  useEffect(() => {
    preloadFonts().catch(() => undefined);
  }, []);
  // Going somewhere closes the sheet that took you there.
  useEffect(() => setMore(false), [pathname]);

  const sections = [
    { to: paths.today(), han: '今', label: 'Today', also: [] },
    { to: paths.read(), han: '读', label: 'Read', also: ['/texts'] },
    { to: paths.speaking(), han: '说', label: 'Speak', also: [] },
    { to: paths.library(), han: '字', label: 'Library', also: ['/collections', '/families'] },
  ];
  const lit = (s: (typeof sections)[number]) =>
    pathname.startsWith(s.to) || s.also.some((p) => pathname.startsWith(p));
  const inMore = !sections.some(lit) && MORE_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="app" data-focus={sitting || undefined} data-immersive={immersive || undefined}>
      <nav className="nav" aria-label="Sections">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="nav-tab" aria-current={lit(s) ? 'page' : undefined}>
            <span className="nav-ic hanzi" aria-hidden>
              {s.han}
            </span>
            {s.label}
          </Link>
        ))}
        <button
          ref={moreButton}
          className="nav-tab nav-more"
          aria-haspopup="dialog"
          aria-expanded={more}
          aria-current={inMore ? 'page' : undefined}
          onClick={() => setMore((m) => !m)}
        >
          <span className="nav-ic" aria-hidden>
            <Icon name="more" />
            <SyncDot />
          </span>
          More
        </button>
        <div className="nav-foot">
          <AccountMenu up />
        </div>
      </nav>

      <main className="main" ref={main}>
        <div className="page">
          <LegacyWorkNotice />
          <Outlet />
        </div>
      </main>

      {more && <MoreSheet anchor={moreButton} onClose={() => setMore(false)} />}

      {viewing && <CharViewer />}

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

/** A dot on More when the work on screen has not reached the server: the one thing worth interrupting for. */
function SyncDot() {
  const status = useSyncStatus();
  const trouble = status && (status.phase === 'offline' || status.phase === 'failing' || status.phase === 'signed-out');
  return trouble ? <i className="nav-dot" aria-label="Not saved" /> : null;
}

const MORE = [
  { to: paths.cards(), han: '卡', label: 'Cards', blurb: 'The day’s cards and the drills' },
  { to: paths.videos(), han: '视', label: 'Videos', blurb: 'Watch, write it out, check it' },
  { to: paths.play(), han: '玩', label: 'Play', blurb: 'Games and the walk through Beijing' },
  { to: paths.stats(), han: '进', label: 'Progress', blurb: 'Days, words and characters over time' },
  { to: paths.settings(), han: '设', label: 'Settings', blurb: 'Learning, speaking, keys, printing, the look' },
];

/**
 * Everything that is not one of the four places: a sheet from the bottom on a
 * phone, a panel beside the rail on anything wider. Your name, at the foot of
 * the sheet, is the account: who you are, security and your data.
 */
function MoreSheet({ anchor, onClose }: { anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const user = useUser();
  const feedback = feedbackUrl(window.location.pathname, user.username);
  const { leave, leaving } = useSignOut();
  const panel = useRef<HTMLDivElement>(null);
  // Beside the rail, the panel opens level with More rather than at the foot
  // of the screen, a hand's width away from what was tapped.
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const at = anchor.current?.getBoundingClientRect();
    const el = panel.current;
    if (!at || !el || !window.matchMedia('(min-width: 700px)').matches) return;
    setTop(Math.max(16, Math.min(at.top - 8, window.innerHeight - el.offsetHeight - 16)));
  }, [anchor]);
  // Pulled down, it goes the way it came, like every other sheet on a phone.
  const sheet = useSheetDrag(onClose);
  const { close } = sheet;

  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', escape);
    panel.current?.focus();
    return () => document.removeEventListener('keydown', escape);
  }, [close]);

  return (
    <>
      <div className="more-scrim" data-leaving={sheet.leaving || undefined} onClick={close} onTouchMove={(e) => e.preventDefault()} />
      <div
        className="more-sheet"
        role="dialog"
        aria-label="More"
        ref={panel}
        tabIndex={-1}
        {...sheet.sheetProps}
        style={top === null ? sheet.sheetProps.style : { ...sheet.sheetProps.style, top, bottom: 'auto' }}
      >
        <span className="sheet-grab" aria-hidden {...sheet.gripProps} />
        <div className="more-list">
          {MORE.map((m) => (
            <Link key={m.to} to={m.to} className="more-row">
              <span className="more-ic hanzi" aria-hidden>
                {m.han}
              </span>
              <span className="more-text">
                <b>{m.label}</b>
                <span className="small muted">{m.blurb}</span>
              </span>
              <Icon name="chevron" className="muted" />
            </Link>
          ))}
          {feedback && (
            <a href={feedback} className="more-row" target="_blank" rel="noreferrer">
              <span className="more-ic hanzi" aria-hidden>
                言
              </span>
              <span className="more-text">
                <b>Send feedback</b>
                <span className="small muted">Something wrong, missing or good: say it in a short form</span>
              </span>
              <Icon name="chevron" className="muted" />
            </a>
          )}
        </div>
        <div className="more-foot">
          <Link to={paths.account()} className="more-row">
            <span className="more-ic" aria-hidden>
              <span className="avatar">{[...user.username][0]?.toUpperCase()}</span>
            </span>
            <span className="more-text">
              <b>{user.username}</b>
              <span className="small muted">Your account, security and data</span>
            </span>
            <Icon name="chevron" className="muted" />
          </Link>
          {/* Whether the work is saved is said in Account › Your data, and by the dot on More when it is not (P18). */}
          <div className="row more-sync">
            <span className="spacer" />
            <button className="btn quiet sm" onClick={() => void leave()} disabled={leaving}>
              {leaving ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
