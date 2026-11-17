import type { DatabaseSync } from 'node:sqlite';
import type { ActivityRepository, DayCounts } from '../../application/ports';

/** Each account's day in numbers (A7), in the one SQLite file. */
export class SqliteActivityRepository implements ActivityRepository {
  constructor(private readonly db: DatabaseSync) {}

  async record(userId: string, day: string, c: DayCounts, at: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO daily_activity (user_id, day, minutes, texts_read, answers, spoken, videos, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, day) DO UPDATE SET minutes = MAX(minutes, excluded.minutes), texts_read = MAX(texts_read, excluded.texts_read),
           answers = MAX(answers, excluded.answers), spoken = MAX(spoken, excluded.spoken), videos = MAX(videos, excluded.videos), updated_at = excluded.updated_at`,
      )
      .run(userId, day, c.minutes, c.textsRead, c.answers, c.spoken, c.videos, at);
  }

  async since(fromDay: string): Promise<Array<{ userId: string; day: string } & DayCounts>> {
    const rows = this.db.prepare('SELECT * FROM daily_activity WHERE day >= ?').all(fromDay) as unknown as Row[];
    return rows.map(toCounts);
  }
}

export interface Row {
  user_id: string;
  day: string;
  minutes: number | string;
  texts_read: number | string;
  answers: number | string;
  spoken: number | string;
  videos: number | string;
}

export const toCounts = (r: Row) => ({
  userId: r.user_id,
  day: r.day,
  minutes: Number(r.minutes),
  textsRead: Number(r.texts_read),
  answers: Number(r.answers),
  spoken: Number(r.spoken),
  videos: Number(r.videos),
});
