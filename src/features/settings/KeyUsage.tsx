import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { USAGE_UNIT, type UsageLine, type UsageResponse, type UsageService } from '../../../shared/usage';
import { accountUsage } from '../../api/account';
import { paths } from '../../navigation/paths';
import './settings.css';

const SERVICE: Record<UsageService, { name: string; calls: [string, string]; balance: string; site: string }> = {
  speechsuper: { name: 'SpeechSuper', calls: ['phrase scored', 'phrases scored'], balance: 'https://www.speechsuper.com/', site: 'speechsuper.com' },
  iflytek: { name: 'iFlytek', calls: ['phrase scored', 'phrases scored'], balance: 'https://console.xfyun.cn/', site: 'console.xfyun.cn' },
  minimax: { name: 'MiniMax', calls: ['reading', 'readings'], balance: 'https://platform.minimax.io/', site: 'platform.minimax.io' },
};

const counted = (n: number, [one, many]: [string, string]) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

function amount(service: UsageService, units: number): string {
  if (USAGE_UNIT[service] === 'characters') return `${units.toLocaleString('en')} character${units === 1 ? '' : 's'} read`;
  if (units < 60) return `${units} s of speech`;
  return `${Math.round(units / 60).toLocaleString('en')} min of speech`;
}

/**
 * What the learner's own keys have been spent on this month — counted by the
 * server as it makes each call, so the same on every device. The bill itself
 * is the service's: each line links to where it shows the balance. Beside
 * the keys themselves, in Settings › Keys & services (P12, P14).
 *
 * States: loading (room kept for two services); failed (said in its place);
 * no keys; a line per service with a key, or one used this month.
 */
export function KeyUsage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    accountUsage().then(
      (u) => live && setUsage(u),
      (err: Error) => live && setFailed(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="card">
      <header>
        <h2>Your own keys this month</h2>
      </header>
      <div className="body">
        <div className="ac-usage">
          {usage === null ? (
            <p className="small muted">{failed ?? 'Loading…'}</p>
          ) : usage.lines.length === 0 ? (
            <p className="small muted">
              No keys of your own are saved. Pronunciation checking uses SpeechSuper’s (above), and narrators MiniMax’s (in{' '}
              <Link to={paths.speakingNarrators()}>Speak › Voices</Link>).
            </p>
          ) : (
            <ul className="list">
              {usage.lines.map((l) => (
                <UsageRow key={l.service} line={l} />
              ))}
            </ul>
          )}
        </div>
        <p className="tiny muted ac-note">
          Counted by this site as it asks each service: a reading kept from before costs nothing and is not here. Days run
          midnight to midnight UTC. What you have left is on the service’s own page.
        </p>
      </div>
    </section>
  );
}

function UsageRow({ line }: { line: UsageLine }) {
  const s = SERVICE[line.service];
  const most = Math.max(1, ...line.days.map((d) => d.calls));
  return (
    <li className="ac-row">
      <div className="ac-row-head">
        <b>{s.name}</b>
        {!line.keySet && <span className="tiny muted">no key saved now</span>}
        <span className="spacer" />
        <span className="small muted ac-today">Today {line.today.calls.toLocaleString('en')}</span>
      </div>
      <span className="small">{line.month.calls ? `${counted(line.month.calls, s.calls)} · ${amount(line.service, line.month.units)}` : 'Nothing yet this month'}</span>
      <span className="ac-days" aria-hidden>
        {line.days.map((d) => (
          <i key={d.day} title={`${d.day}: ${counted(d.calls, s.calls)}`} style={{ height: d.calls ? `${Math.max(12, (d.calls / most) * 100)}%` : undefined }} data-none={d.calls ? undefined : ''} />
        ))}
      </span>
      <a className="tiny ac-balance" href={s.balance} target="_blank" rel="noreferrer">
        Your balance at {s.site}
      </a>
    </li>
  );
}
