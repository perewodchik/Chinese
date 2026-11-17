import { useEffect, useState } from 'react';
import { ANNOUNCEMENT_MAX, type Registration, type SiteSettingsView } from '../../../shared/site';
import { changeSiteSettings, siteSettings } from '../../api/site';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed } from '../auth/useFreshPassword';

const SIGN_UPS: Array<{ id: Registration; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'invite', label: 'By invitation' },
  { id: 'closed', label: 'Closed' },
];
const ROOMS: Array<{ id: string; label: string }> = [
  { id: '100', label: '100 MB' },
  { id: '300', label: '300 MB' },
  { id: '1000', label: '1 GB' },
  { id: 'none', label: 'No ceiling' },
];

/**
 * The site's own settings on the admin page (A11): how people sign up, the
 * room each account has, and one line shown over Read. A change takes hold
 * within a minute everywhere, with no deploy, and goes in the admins' log.
 *
 * States: loading; as set (with who changed each last); saving; refused.
 */
export function SiteSettingsBlock({ confirm, onChanged }: { confirm: <T>(run: () => Promise<T>) => Promise<T>; onChanged: () => void }) {
  const toast = useToast();
  const [view, setView] = useState<SiteSettingsView | null>(null);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void siteSettings().then((v) => {
      setView(v);
      setLine(v.settings.announcement);
    }, () => undefined);
  }, []);

  async function change(patch: Parameters<typeof changeSiteSettings>[0], said: string) {
    setBusy(true);
    try {
      const v = await confirm(() => changeSiteSettings(patch));
      setView(v);
      setLine(v.settings.announcement);
      toast(said);
      onChanged();
    } catch (err) {
      if (!(err instanceof NotConfirmed)) toast(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const s = view?.settings;
  const room = s ? (s.storageLimitMb === null ? 'none' : String(s.storageLimitMb)) : '300';
  const rooms = ROOMS.some((r) => r.id === room) ? ROOMS : [...ROOMS.slice(0, 3), { id: room, label: `${room} MB` }, ROOMS[3]!];
  return (
    <section className="block admin-site">
      <h2 className="block-title">The site</h2>
      <div className="list">
        <div className="admin-setting">
          <span className="grow">
            New accounts
            <small>{view?.changed.registration ? `Set here by ${view.changed.registration.by}` : 'As the server was started with'}</small>
          </span>
          <Seg value={s?.registration ?? 'open'} options={SIGN_UPS} onChange={(r) => void change({ registration: r }, `New accounts: ${SIGN_UPS.find((x) => x.id === r)!.label.toLowerCase()}`)} label="New accounts" size="sm" />
        </div>
        <div className="admin-setting">
          <span className="grow">
            Room for each account
            <small>Texts, pictures, readings and tries together.</small>
          </span>
          <Seg value={room} options={rooms} onChange={(r) => void change({ storageLimitMb: r === 'none' ? null : Number(r) }, 'Room for each account changed')} label="Room for each account" size="sm" />
        </div>
        <form
          className="admin-announce"
          onSubmit={(e) => {
            e.preventDefault();
            void change({ announcement: line }, line.trim() ? 'The line over Read is up' : 'The line over Read is gone');
          }}
        >
          <label className="field">
            A line over Read, for everyone
            <input type="text" value={line} maxLength={ANNOUNCEMENT_MAX} placeholder="Nothing shown" onChange={(e) => setLine(e.target.value)} />
          </label>
          <button className="btn tonal sm" type="submit" disabled={busy || !view || line.trim() === s?.announcement}>
            {line.trim() ? 'Show it' : 'Take it down'}
          </button>
        </form>
      </div>
    </section>
  );
}
