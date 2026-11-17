import { useEffect, useState } from 'react';
import { USAGE_UNIT, type SiteUsage, type UsageService } from '../../../shared/usage';
import { request } from '../../api/http';
import { plural } from './format';

const NAME: Record<UsageService, string> = { speechsuper: 'SpeechSuper', iflytek: 'iFlytek', minimax: 'MiniMax' };
const units = (service: UsageService, n: number) =>
  USAGE_UNIT[service] === 'seconds' ? `${Math.round(n / 60).toLocaleString('en')} min of speech scored` : `${n.toLocaleString('en')} characters read aloud`;

/**
 * The site's use of the services on the admin page (A10): this month and
 * today a line a service, and who used most this month. The keys are each
 * learner's own for now; the switches and the site's own ceilings come with
 * credits (M1).
 *
 * States: loading (nothing drawn); nothing used this month; the lines.
 */
export function CostsBlock() {
  const [data, setData] = useState<SiteUsage | null>(null);
  useEffect(() => {
    void request<SiteUsage>('GET', '/api/admin/costs').then(setData, () => undefined);
  }, []);
  if (!data) return null;
  return (
    <section className="block">
      <h2 className="block-title">Services this month</h2>
      {data.lines.length === 0 ? (
        <p className="small muted">Nothing scored or read aloud this month.</p>
      ) : (
        <ul className="list admin-list">
          {data.lines.map((l) => (
            <li key={l.service} className="admin-row">
              <b>{NAME[l.service]}</b>
              <span className="small muted">
                {plural(l.month.calls, 'call')} · {units(l.service, l.month.units)} · today {plural(l.today.calls, 'call')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data.top.length > 0 && (
        <p className="small muted admin-top">
          Most this month: {data.top.slice(0, 5).map((t) => `${t.username} (${NAME[t.service]}, ${plural(t.calls, 'call')})`).join(', ')}.
        </p>
      )}
    </section>
  );
}
