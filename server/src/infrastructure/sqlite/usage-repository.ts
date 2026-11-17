import type { DatabaseSync } from 'node:sqlite';
import type { UsageRepository, UsageRow } from '../../application/ports';

/** What the learner's keys were spent on, a row a day a service, in the one SQLite file. */
export class SqliteUsageRepository implements UsageRepository {
  constructor(private readonly db: DatabaseSync) {}

  async add(userId: string, day: string, service: string, calls: number, units: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO api_usage (user_id, day, service, calls, units) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, day, service) DO UPDATE SET calls = calls + excluded.calls, units = units + excluded.units`,
      )
      .run(userId, day, service, calls, units);
  }

  async siteSince(fromDay: string): Promise<UsageRow[]> {
    const rows = this.db
      .prepare('SELECT day, service, SUM(calls) AS calls, SUM(units) AS units FROM api_usage WHERE day >= ? GROUP BY day, service ORDER BY day, service')
      .all(fromDay) as unknown as UsageRow[];
    return rows.map((r) => ({ day: r.day, service: r.service, calls: Number(r.calls), units: Number(r.units) }));
  }

  async topSince(fromDay: string, limit: number): Promise<Array<{ userId: string; service: string; calls: number; units: number }>> {
    const rows = this.db
      .prepare('SELECT user_id, service, SUM(calls) AS calls, SUM(units) AS units FROM api_usage WHERE day >= ? GROUP BY user_id, service ORDER BY calls DESC LIMIT ?')
      .all(fromDay, limit) as unknown as Array<{ user_id: string; service: string; calls: number; units: number }>;
    return rows.map((r) => ({ userId: r.user_id, service: r.service, calls: Number(r.calls), units: Number(r.units) }));
  }

  async since(userId: string, fromDay: string): Promise<UsageRow[]> {
    const rows = this.db
      .prepare('SELECT day, service, calls, units FROM api_usage WHERE user_id = ? AND day >= ? ORDER BY day, service')
      .all(userId, fromDay) as unknown as UsageRow[];
    return rows.map((r) => ({ day: r.day, service: r.service, calls: Number(r.calls), units: Number(r.units) }));
  }
}
