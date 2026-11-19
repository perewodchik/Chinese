/**
 * A7: an account's day in numbers, sent by the page — never what was read
 * or said, only how much — and what the admin page makes of them.
 *
 *   POST /api/activity        DayReport → 204
 *   GET  /api/admin/dashboard  Dashboard
 */
export interface DayReport {
  /** the learner's own calendar day, "2026-11-17" */
  day: string;
  minutes: number;
  textsRead: number;
  answers: number;
  spoken: number;
  videos: number;
}

export interface Dashboard {
  /** accounts that did anything, in the last 1, 7 and 30 days */
  active: { day: number; week: number; month: number };
  /** accounts made in the last 7 and 30 days */
  joined: { week: number; month: number };
  /** of the accounts older than a week, how many worked in the last 7 days */
  returned: number;
  /** of those active this week, how many read, answered cards, spoke, watched */
  uses: { reading: number; cards: number; speaking: number; videos: number };
  /** the last six weeks of new accounts, and how many of each worked in their 2nd, 3rd and 5th week */
  cohorts: Array<{ week: string; joined: number; week1: number | null; week2: number | null; week4: number | null }>;
  /**
   * A7: the accounts made in the last 30 days, and how far each got — did
   * anything, read a text, answered a card, came back on a later day — so the
   * admin page shows where newcomers stop. Each step counts those who did it,
   * whatever they did before it.
   */
  funnel: { joined: number; worked: number; read: number; answered: number; cameBack: number };
}
