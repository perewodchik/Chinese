import { useEffect, useState } from 'react';
import type { Dashboard } from '../../../shared/activity';
import { request } from '../../api/http';

const pct = (n: number | null, of: number) => (n === null ? '—' : of ? `${n} (${Math.round((n / of) * 100)}%)` : '0');
const weekOf = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Whether the site is used (A7), at the top of the admin page: who was here
 * today, this week and this month, who came back, what they use, and how
 * each of the last six weeks' newcomers stayed — numbers, no charts.
 *
 * States: loading (the same shape, with dashes); the numbers.
 */
export function DashboardBlock() {
  const [d, setD] = useState<Dashboard | null>(null);
  useEffect(() => {
    void request<Dashboard>('GET', '/api/admin/dashboard').then(setD, () => undefined);
  }, []);
  // Drawn at its full size from the start, dashes until the numbers come, so the page under it does not move.
  if (!d) return <DashboardShape />;
  const week = d.active.week;
  return (
    <section className="block admin-dashboard">
      <h2 className="block-title">Who is using it</h2>
      <div className="admin-tiles">
        <span>
          <b>{d.active.day}</b>
          <small>today</small>
        </span>
        <span>
          <b>{d.active.week}</b>
          <small>this week</small>
        </span>
        <span>
          <b>{d.active.month}</b>
          <small>in 30 days</small>
        </span>
        <span>
          <b>{d.joined.week}</b>
          <small>new this week</small>
        </span>
      </div>
      <p className="small muted admin-dash-line">
        {d.returned} came back this week from before it. Of this week’s {week}: {d.uses.reading} read, {d.uses.cards} did cards, {d.uses.speaking} spoke, {d.uses.videos} watched.
      </p>
      <table className="admin-cohorts">
        <thead>
          <tr>
            <th>Joined the week of</th>
            <th>Joined</th>
            <th>2nd week</th>
            <th>3rd week</th>
            <th>5th week</th>
          </tr>
        </thead>
        <tbody>
          {d.cohorts.map((c) => (
            <tr key={c.week}>
              <td>{weekOf(c.week)}</td>
              <td>{c.joined}</td>
              <td>{c.joined ? pct(c.week1, c.joined) : '—'}</td>
              <td>{c.joined ? pct(c.week2, c.joined) : '—'}</td>
              <td>{c.joined ? pct(c.week4, c.joined) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DashboardShape() {
  return (
    <section className="block admin-dashboard" aria-busy="true">
      <h2 className="block-title">Who is using it</h2>
      <div className="admin-tiles">
        {['today', 'this week', 'in 30 days', 'new this week'].map((l) => (
          <span key={l}>
            <b>—</b>
            <small>{l}</small>
          </span>
        ))}
      </div>
      <p className="small muted admin-dash-line">&nbsp;<br />&nbsp;</p>
      <table className="admin-cohorts">
        <thead>
          <tr>
            <th>Joined the week of</th>
            <th>Joined</th>
            <th>2nd week</th>
            <th>3rd week</th>
            <th>5th week</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
