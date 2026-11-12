import { Link, Navigate, useParams } from 'react-router';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { SECTIONS } from './sections';
import './settings.css';

/**
 * Settings, as a short list of sections, each a page of its own with its
 * own address (P11): on a phone the list, then the section with its way
 * back; from 900 px the list beside the section, the first one open.
 *
 * States: the list (/settings); a section (/settings/printing); a section
 * that is not one (back to the list); a wide screen, list and section side
 * by side, with the section shown marked in the list.
 */
export function SettingsPage() {
  const { section } = useParams();
  const open = SECTIONS.find((s) => s.id === section) ?? null;
  useTitle(open ? open.label : 'Settings');
  if (section && !open) return <Navigate to={paths.settings()} replace />;
  // On a wide screen the list stands beside a section, so one is always open there.
  const shown = open ?? SECTIONS[0]!;
  const Body = shown.body;

  return (
    <section className="settings-page" data-open={open ? '' : undefined}>
      <nav className="settings-list" aria-label="Settings">
        <h1>Settings</h1>
        <div className="list">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={paths.settings(s.id)} className="more-row settings-row" aria-current={s.id === shown.id ? 'page' : undefined}>
              <span className="more-ic hanzi" aria-hidden>
                {s.han}
              </span>
              <span className="more-text">
                <b>{s.label}</b>
                <span className="small muted">{s.blurb}</span>
              </span>
              <Icon name="chevron" className="muted" />
            </Link>
          ))}
        </div>
      </nav>
      <div className="settings-section">
        <header className="page-head settings-head">
          <Link className="back-link" to={paths.settings()}>
            <Icon name="back" />
            Settings
          </Link>
        </header>
        <h2 className="settings-title">{shown.label}</h2>
        <div className="settings-cards">
          <Body />
        </div>
      </div>
    </section>
  );
}
