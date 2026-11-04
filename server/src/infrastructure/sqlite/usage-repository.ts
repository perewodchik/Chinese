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

  async since(userId: string, fromDay: string): Promise<UsageRow[]> {
    const rows = this.db
      .prepare('SELECT day, service, calls, units FROM api_usage WHERE user_id = ? AND day >= ? ORDER BY day, service')
      .all(userId, fromDay) as unknown as UsageRow[];
    return rows.map((r) => ({ day: r.day, service: r.service, calls: Number(r.calls), units: Number(r.units) }));
  }
}
