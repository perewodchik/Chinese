/**
 * Feedback sent from the site itself (A12): what someone found wrong,
 * missing or good, the page they were on, and where it stands. Shown to
 * admins as text, never as markup.
 *
 *   POST  /api/feedback                { kind, message, page } → 201
 *   GET   /api/admin/feedback?status=  → { items }
 *   PATCH /api/admin/feedback/:id      { status } → 204
 */
export const FEEDBACK_KINDS = ['wrong', 'missing', 'good'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_STATUSES = ['new', 'answered', 'closed'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_MAX = 2000;

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  message: string;
  page: string;
  /** who sent it, by name; null once the account is gone */
  username: string | null;
  createdAt: number;
  status: FeedbackStatus;
}
