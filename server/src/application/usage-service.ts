import { USAGE_UNIT, type UsageCount, type UsageLine, type UsageResponse, type UsageService } from '../../../shared/usage';
import type { Clock, UsageRepository } from './ports';

const DAY = 86_400_000;
const dayOf = (at: number) => new Date(at).toISOString().slice(0, 10);

/**
 * Counting what the learner's keys are spent on, where the server spends it.
 *
 * A count that fails to be written never fails what was asked for: the
 * learner's phrase was scored and their text was read, and a missing line in
 * a tally is worth less than either.
 */
export class UsageMeter {
  constructor(private readonly deps: { usage: UsageRepository; clock: Clock; log?: (line: string) => void }) {}

  async record(userId: string, service: UsageService, units: number): Promise<void> {
    try {
      await this.deps.usage.add(userId, dayOf(this.deps.clock.now()), service, 1, Math.max(0, Math.round(units)));
    } catch (err) {
      this.deps.log?.(`usage: could not count a ${service} call: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Today, this month and the last thirty days, for each service; the services with a key saved first. */
  async summary(userId: string, keys: Record<UsageService, boolean>): Promise<UsageResponse> {
    const now = this.deps.clock.now();
    const today = dayOf(now);
    const monthStart = `${today.slice(0, 8)}01`;
    const from = dayOf(now - 29 * DAY);
    const rows = await this.deps.usage.since(userId, from < monthStart ? from : monthStart);
    const days = Array.from({ length: 30 }, (_, i) => dayOf(now - (29 - i) * DAY));
    const sum = (list: UsageCount[]): UsageCount => list.reduce((a, b) => ({ calls: a.calls + b.calls, units: a.units + b.units }), { calls: 0, units: 0 });
    const lines: UsageLine[] = (Object.keys(USAGE_UNIT) as UsageService[]).map((service) => {
      const mine = rows.filter((r) => r.service === service);
      const on = (day: string) => sum(mine.filter((r) => r.day === day));
      return {
        service,
        keySet: keys[service],
        today: on(today),
        month: sum(mine.filter((r) => r.day >= monthStart)),
        days: days.map((day) => ({ day, ...on(day) })),
      };
    });
    // A service with no key and nothing spent is not worth a line.
    const shown = lines.filter((l) => l.keySet || l.month.calls > 0 || l.days.some((d) => d.calls > 0));
    return { today, lines: shown.sort((a, b) => Number(b.keySet) - Number(a.keySet)) };
  }
}
