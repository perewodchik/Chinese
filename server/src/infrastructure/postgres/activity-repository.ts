import type pg from 'pg';
import type { ActivityRepository, DayCounts } from '../../application/ports';
import { toCounts, type Row } from '../sqlite/activity-repository';

/** Each account's day in numbers (A7), in Postgres. */
export class PostgresActivityRepository implements ActivityRepository {
  constructor(private readonly db: pg.Pool) {}

  async record(userId: string, day: string, c: DayCounts, at: number): Promise<void> {
    await this.db.query(
      `INSERT INTO daily_activity (user_id, day, minutes, texts_read, answers, spoken, videos, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, day) DO UPDATE SET minutes = GREATEST(daily_activity.minutes, EXCLUDED.minutes), texts_read = GREATEST(daily_activity.texts_read, EXCLUDED.texts_read),
         answers = GREATEST(daily_activity.answers, EXCLUDED.answers), spoken = GREATEST(daily_activity.spoken, EXCLUDED.spoken), videos = GREATEST(daily_activity.videos, EXCLUDED.videos), updated_at = EXCLUDED.updated_at`,
      [userId, day, c.minutes, c.textsRead, c.answers, c.spoken, c.videos, at],
    );
  }

  async since(fromDay: string): Promise<Array<{ userId: string; day: string } & DayCounts>> {
    const { rows } = await this.db.query<Row>('SELECT * FROM daily_activity WHERE day >= $1', [fromDay]);
    return rows.map(toCounts);
  }
}
