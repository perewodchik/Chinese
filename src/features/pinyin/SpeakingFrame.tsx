import { Link, Outlet, useLocation } from 'react-router';
import { paths } from '../../navigation/paths';
import './speaking.css';

const TABS = [
  { to: paths.speaking(), han: '句', label: 'Phrases', on: (p: string) => p === '/speaking' || p === '/speaking/' },
  { to: paths.speakingNarrators(), han: '声', label: 'Voices', on: (p: string) => p.startsWith('/speaking/voices') },
  { to: paths.speakingTalkFront(), han: '谈', label: 'Talk', long: 'Talk with Claude', on: (p: string) => p.startsWith('/speaking/talk') },
  { to: paths.speakingTones(), han: '调', label: 'Tones', long: 'Tones and sounds', on: (p: string) => p.startsWith('/speaking/pinyin') },
];

/**
 * Speaking's four parts as tabs of their own — phrases scored, the voices
 * that read, talking with Claude, the tones and sounds — down the left on an
 * iPad, beside the page, and across the top on a phone, where Speaking itself
 * is reached from More.
 */
export function SpeakingFrame() {
  const { pathname } = useLocation();
  return (
    <div className="sp-frame">
      <nav className="sp-nav" aria-label="Speaking">
        <h1 className="sp-nav-title">Speaking</h1>
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className="sp-tab" aria-current={t.on(pathname) ? 'page' : undefined}>
            <span className="sp-tab-mark hanzi" aria-hidden>
              {t.han}
            </span>
            <span className="sp-tab-short">{t.label}</span>
            <span className="sp-tab-long">{t.long ?? t.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sp-body">
        <Outlet />
      </div>
    </div>
  );
}
