import type pg from 'pg';
import type { UsageRepository, UsageRow } from '../../application/ports';

/** What the learner's keys were spent on, a row a day a service, in Postgres. */
export class PostgresUsageRepository implements UsageRepository {
  constructor(private readonly db: pg.Pool) {}

  async add(userId: string, day: string, service: string, calls: number, units: number): Promise<void> {
    await this.db.query(
      `INSERT INTO api_usage (user_id, day, service, calls, units) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, day, service) DO UPDATE SET calls = api_usage.calls + EXCLUDED.calls, units = api_usage.units + EXCLUDED.units`,
      [userId, day, service, calls, units],
    );
  }

  async since(userId: string, fromDay: string): Promise<UsageRow[]> {
    const { rows } = await this.db.query<{ day: string; service: string; calls: string; units: string }>(
      'SELECT day, service, calls, units FROM api_usage WHERE user_id = $1 AND day >= $2 ORDER BY day, service',
      [userId, fromDay],
    );
    // BIGINT comes back from pg as a string.
    return rows.map((r) => ({ day: r.day, service: r.service, calls: Number(r.calls), units: Number(r.units) }));
  }
}
