import type { DayReport, Dashboard } from '../../../shared/activity';
import { ValidationError } from '../domain/errors';
import type { ActivityRepository, Clock, UserRepository } from './ports';

const DAY = 86_400_000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);
const worked = (r: { minutes: number; textsRead: number; answers: number; spoken: number; videos: number }) => r.minutes > 0 || r.textsRead > 0 || r.answers > 0 || r.spoken > 0 || r.videos > 0;

/**
 * A7: each account's day in numbers, and the admin page's answer to "is the
 * site being used": who was here, who came back, which weeks' newcomers
 * stayed, and what they use. Nothing of what anyone read or said.
 */
export class ActivityService {
  constructor(private readonly deps: { activity: ActivityRepository; users: UserRepository; clock: Clock }) {}

  async record(userId: string, r: DayReport): Promise<void> {
    const now = this.deps.clock.now();
    // The learner's own day: within a day either side of the server's.
    const near = [dayOf(now - DAY), dayOf(now), dayOf(now + DAY)];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !near.includes(r.day)) throw new ValidationError('Only today can be reported.');
    const cap = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)));
    await this.deps.activity.record(
      userId,
      r.day,
      { minutes: cap(r.minutes, 1440), textsRead: cap(r.textsRead, 2000), answers: cap(r.answers, 20_000), spoken: cap(r.spoken, 20_000), videos: cap(r.videos, 500) },
      now,
    );
  }

  async dashboard(): Promise<Dashboard> {
    const now = this.deps.clock.now();
    const today = dayOf(now);
    const back = (days: number) => dayOf(now - days * DAY);
    const [rows, users] = await Promise.all([this.deps.activity.since(back(70)), this.deps.users.list()]);
    const live = rows.filter(worked);
    const activeSince = (from: string) => new Set(live.filter((r) => r.day >= from).map((r) => r.userId));
    const week = activeSince(back(6));
    const thisWeek = live.filter((r) => r.day >= back(6));
    const share = (pick: (r: (typeof live)[number]) => boolean) => new Set(thisWeek.filter(pick).map((r) => r.userId)).size;

    // Weeks of new accounts, newest first, each counted in its 2nd, 3rd and 5th week.
    const daysOf = new Map<string, Set<string>>();
    for (const r of live) daysOf.set(r.userId, (daysOf.get(r.userId) ?? new Set()).add(r.day));
    const cohorts: Dashboard['cohorts'] = [];
    for (let w = 0; w < 6; w++) {
      const end = now - w * 7 * DAY;
      const start = end - 7 * DAY;
      const joined = users.filter((u) => u.createdAt >= start && u.createdAt < end);
      const inWeek = (n: number) => {
        // A week not over yet is not counted.
        if (start + (n + 1) * 7 * DAY > now) return null;
        return joined.filter((u) => {
          const from = dayOf(u.createdAt + n * 7 * DAY);
          const to = dayOf(u.createdAt + (n + 1) * 7 * DAY);
          return [...(daysOf.get(u.id) ?? [])].some((d) => d >= from && d < to);
        }).length;
      };
      cohorts.push({ week: dayOf(start), joined: joined.length, week1: inWeek(1), week2: inWeek(2), week4: inWeek(4) });
    }

    return {
      active: { day: activeSince(today).size, week: week.size, month: activeSince(back(29)).size },
      joined: { week: users.filter((u) => u.createdAt >= now - 7 * DAY).length, month: users.filter((u) => u.createdAt >= now - 30 * DAY).length },
      returned: users.filter((u) => u.createdAt < now - 7 * DAY && week.has(u.id)).length,
      uses: { reading: share((r) => r.textsRead > 0), cards: share((r) => r.answers > 0), speaking: share((r) => r.spoken > 0), videos: share((r) => r.videos > 0) },
      cohorts,
    };
  }
}
