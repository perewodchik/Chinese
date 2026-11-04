/**
 * What the learner's own keys have been spent on, as the server counted it.
 *
 *   GET /api/account/usage  → UsageResponse
 *
 * Only calls this site made, and only the ones that went through: a reading
 * kept from before, or a call the service refused, costs nothing and is not
 * here. The bill itself is the service's to show.
 */

/** The outside services the learner pays for with keys of their own. */
export type UsageService = 'speechsuper' | 'iflytek' | 'minimax';

/** What a service's `units` are: seconds of speech scored, or characters read aloud. */
export const USAGE_UNIT: Record<UsageService, 'seconds' | 'characters'> = {
  speechsuper: 'seconds',
  iflytek: 'seconds',
  minimax: 'characters',
};

export interface UsageCount {
  calls: number;
  units: number;
}

export interface UsageLine {
  service: UsageService;
  /** whether a key for it is saved now */
  keySet: boolean;
  today: UsageCount;
  /** since the first of this month (UTC) */
  month: UsageCount;
  /** the last thirty days, oldest first, a count a day (UTC) */
  days: Array<{ day: string } & UsageCount>;
}

export interface UsageResponse {
  /** today, in UTC, as the counts are kept */
  today: string;
  lines: UsageLine[];
}
